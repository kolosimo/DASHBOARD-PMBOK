/**
 * Query di lettura del flusso (Kanban). Proprietario: agente A3.
 * Formule in #domain/flusso (contratto di Fase 0).
 *
 * Nota: gli stati si passano alle formule per **posizione** nella sequenza
 * ordinata (0 = iniziale): con i dati di esempio coincide con `ordine`.
 */
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { minutiPerElaborato } from '#modules/ore/queries'
import type {
  ClasseServizio,
  DataIso,
  Lunedi,
  Minuti,
  PuntoCfd,
  TransizioneFlusso,
} from '#domain/types'
import { cfd, cycleTime, sforaWip, throughput, workItemAge } from '#domain/flusso'
import { aggiungiSettimane, lunediDellaSettimana } from '#shared/calendario'
import { configurazioneFlusso, type ConfigurazioneFlusso } from './stati.js'

export interface SchedaKanban {
  elaboratoId: number
  codice: string
  titolo: string
  disciplina: string
  classeServizio: ClasseServizio
  /** Data della classe "data fissa" (null per le altre classi) */
  dataFissa: DataIso | null
  statoId: number
  statoNome: string
  statoOrdine: number
  /** Work Item Age in giorni; null per gli elaborati in stato finale */
  etaGiorni: number | null
  budgetMinuti: Minuti
  acMinuti: Minuti
  version: number
}

export interface ColonnaRiepilogo {
  colonnaId: number
  codice: string
  nome: string
  limiteWip: number | null
  schede: SchedaKanban[]
  oltreLimite: boolean
}

export interface RiepilogoFlusso {
  commessaId: number
  colonne: ColonnaRiepilogo[]
  /** Elaborati emessi per settimana (ultime 8 settimane) */
  throughput: { settimana: Lunedi; conteggio: number }[]
  /** Cycle time medio in giorni sugli elaborati emessi, null se nessuno */
  cycleTimeMedioGiorni: number | null
}

/** Settimane mostrate per il throughput e il CFD */
export const SETTIMANE_STORICO = 8

function istanteIso(valore: Date | string): string {
  return valore instanceof Date ? valore.toISOString() : String(valore)
}

/** Storico delle transizioni della commessa, con gli stati come posizioni */
export async function transizioniCommessa(
  commessaId: number,
  conf?: ConfigurazioneFlusso
): Promise<TransizioneFlusso[]> {
  const configurazione = conf ?? (await configurazioneFlusso(commessaId))
  const righe = await db
    .from('transizioni_elaborato as t')
    .join('elaborati as e', 'e.id', 't.elaborato_id')
    .where('e.commessa_id', commessaId)
    .select('t.elaborato_id', 't.da_stato_id', 't.a_stato_id', 't.avvenuta_il')
    .orderBy('t.avvenuta_il', 'asc')
    .orderBy('t.id', 'asc')
  const posizione = (id: number | null) =>
    id === null ? null : (configurazione.statoPerId.get(id)?.posizione ?? null)
  const esito: TransizioneFlusso[] = []
  for (const r of righe) {
    const a = posizione(r.a_stato_id)
    if (a === null) continue
    esito.push({
      elaboratoId: r.elaborato_id,
      daStatoOrdine: posizione(r.da_stato_id),
      aStatoOrdine: a,
      avvenutaIl: istanteIso(r.avvenuta_il),
    })
  }
  return esito
}

/** Elaborati della commessa con stato e disciplina, in ordine di board */
function righeKanban(commessaId: number) {
  return db
    .from('elaborati as e')
    .join('stati_elaborato as s', 's.id', 'e.stato_id')
    .join('discipline as d', 'd.id', 'e.disciplina_id')
    .where('e.commessa_id', commessaId)
    .select(
      'e.id',
      'e.codice',
      'e.titolo',
      'e.classe_servizio',
      'e.data_fissa',
      'e.stato_id',
      'e.stato_dal',
      'e.budget_minuti',
      'e.version',
      's.nome as stato_nome',
      's.ordine as stato_ordine',
      'd.codice as disciplina'
    )
    .orderBy('s.ordine', 'asc')
    .orderBy('e.stato_dal', 'asc')
    .orderBy('e.codice', 'asc')
}

/**
 * Stato di ogni elaborato della commessa in vigore a un istante (ISO o Date):
 * lo stato attuale se `stato_dal` è precedente, altrimenti la destinazione
 * dell'ultima transizione precedente all'istante. `null` se all'istante
 * l'elaborato non aveva ancora uno stato (nato dopo).
 * Serve all'EVM per l'EV a fine settimana negli snapshot.
 */
export async function statiAllIstante(
  commessaId: number,
  istante: string | Date,
  client: TransactionClientContract | typeof db = db
): Promise<Map<number, number | null>> {
  const quando = istante instanceof Date ? istante.toISOString() : istante
  const risultato = await client.rawQuery(
    `SELECT e.id,
            CASE WHEN e.stato_dal < :istante THEN e.stato_id ELSE (
              SELECT t.a_stato_id FROM transizioni_elaborato t
               WHERE t.elaborato_id = e.id AND t.avvenuta_il < :istante
               ORDER BY t.avvenuta_il DESC, t.id DESC LIMIT 1
            ) END AS stato_id
       FROM elaborati e
      WHERE e.commessa_id = :commessaId`,
    { commessaId, istante: quando }
  )
  return new Map(
    (risultato.rows as { id: number; stato_id: number | null }[]).map((r) => [
      Number(r.id),
      r.stato_id === null ? null : Number(r.stato_id),
    ])
  )
}

export interface PosizioneNelFlusso {
  attuale: { id: number; nome: string; colonnaNome: string }
  /** Stato precedente (per tornare indietro con un motivo), null se è il primo */
  precedente: { id: number; nome: string } | null
  /** Stato successivo, null se è l'ultimo */
  successivo: { id: number; nome: string } | null
  inFinale: boolean
  /** Numero dello stato nella sequenza (1 = iniziale) e totale degli stati */
  numero: number
  totale: number
}

/** Dove si trova uno stato nel flusso della commessa: per la scheda elaborato */
export async function posizioneNelFlusso(
  commessaId: number,
  statoId: number
): Promise<PosizioneNelFlusso | null> {
  const conf = await configurazioneFlusso(commessaId)
  const stato = conf.statoPerId.get(statoId)
  if (!stato) return null
  const prima = conf.stati[stato.posizione - 1]
  const dopo = conf.stati[stato.posizione + 1]
  return {
    attuale: {
      id: stato.id,
      nome: stato.nome,
      colonnaNome: conf.colonne.find((c) => c.id === stato.colonnaId)?.nome ?? '',
    },
    precedente: prima ? { id: prima.id, nome: prima.nome } : null,
    successivo: dopo ? { id: dopo.id, nome: dopo.nome } : null,
    inFinale: stato.posizione >= conf.posizioneFinale,
    numero: stato.posizione + 1,
    totale: conf.stati.length,
  }
}

export interface TransizioneStorico {
  id: number
  daStatoNome: string | null
  aStatoNome: string
  avvenutaIl: string
  utenteNome: string | null
  motivo: string | null
  wipSforato: boolean
  /** true se si è tornati indietro (rilavorazione) */
  indietro: boolean
}

/** Storico delle transizioni di un elaborato, dalla più recente */
export async function storicoElaborato(elaboratoId: number): Promise<TransizioneStorico[]> {
  const righe = await db
    .from('transizioni_elaborato as t')
    .join('stati_elaborato as a', 'a.id', 't.a_stato_id')
    .leftJoin('stati_elaborato as d', 'd.id', 't.da_stato_id')
    .leftJoin('utenti as u', 'u.id', 't.utente_id')
    .where('t.elaborato_id', elaboratoId)
    .select(
      't.id',
      't.avvenuta_il',
      't.motivo',
      't.wip_sforato',
      'a.nome as a_nome',
      'a.ordine as a_ordine',
      'd.nome as da_nome',
      'd.ordine as da_ordine',
      'u.nome as utente_nome'
    )
    .orderBy('t.avvenuta_il', 'desc')
    .orderBy('t.id', 'desc')
  return righe.map((r) => ({
    id: Number(r.id),
    daStatoNome: r.da_nome ?? null,
    aStatoNome: String(r.a_nome),
    avvenutaIl: istanteIso(r.avvenuta_il),
    utenteNome: r.utente_nome ?? null,
    motivo: r.motivo ?? null,
    wipSforato: Boolean(r.wip_sforato),
    indietro: r.da_ordine !== null && Number(r.da_ordine) > Number(r.a_ordine),
  }))
}

/** Kanban della commessa con WIP, età e throughput, alla data `oggi` */
export async function riepilogoFlusso(commessaId: number, oggi: DataIso): Promise<RiepilogoFlusso> {
  const conf = await configurazioneFlusso(commessaId)

  // Elaborati con stato e disciplina; le ore registrate (AC) dal modulo ore
  // In sequenza: nei test tutte le query condividono una sola connessione
  const righe = await righeKanban(commessaId)
  const acPerElaborato = await minutiPerElaborato(commessaId)

  const schedePerColonna = new Map<number, SchedaKanban[]>()
  for (const r of righe) {
    const stato = conf.statoPerId.get(r.stato_id)
    if (!stato) continue
    const inFinale = stato.posizione >= conf.posizioneFinale
    const scheda: SchedaKanban = {
      elaboratoId: r.id,
      codice: r.codice,
      titolo: r.titolo,
      disciplina: r.disciplina,
      classeServizio: r.classe_servizio,
      dataFissa: r.data_fissa ?? null,
      statoId: r.stato_id,
      statoNome: r.stato_nome,
      statoOrdine: r.stato_ordine,
      etaGiorni: inFinale ? null : workItemAge(istanteIso(r.stato_dal), oggi),
      budgetMinuti: r.budget_minuti,
      acMinuti: acPerElaborato.get(r.id) ?? 0,
      version: r.version,
    }
    const elenco = schedePerColonna.get(stato.colonnaId) ?? []
    elenco.push(scheda)
    schedePerColonna.set(stato.colonnaId, elenco)
  }

  const colonne: ColonnaRiepilogo[] = conf.colonne.map((c) => {
    const schede = schedePerColonna.get(c.id) ?? []
    return {
      colonnaId: c.id,
      codice: c.codice,
      nome: c.nome,
      limiteWip: c.limiteWip,
      schede,
      // oltre il limite = già più schede del limite (sforaWip dice se aggiungerne una sfora)
      oltreLimite: schede.length > 0 && sforaWip(schede.length - 1, c.limiteWip),
    }
  })

  const transizioni = await transizioniCommessa(commessaId, conf)
  const ultimaSettimana = lunediDellaSettimana(oggi)
  const settimane = Array.from({ length: SETTIMANE_STORICO }, (_, i) =>
    aggiungiSettimane(ultimaSettimana, i - (SETTIMANE_STORICO - 1))
  )

  const perElaborato = new Map<number, TransizioneFlusso[]>()
  for (const t of transizioni) {
    const elenco = perElaborato.get(t.elaboratoId) ?? []
    elenco.push(t)
    perElaborato.set(t.elaboratoId, elenco)
  }
  const tempi: number[] = []
  for (const storia of perElaborato.values()) {
    const ct = cycleTime(storia, conf.posizioneFinale)
    if (ct !== null) tempi.push(ct)
  }

  return {
    commessaId,
    colonne,
    throughput: settimane.map((settimana) => ({
      settimana,
      conteggio: throughput(transizioni, settimana, conf.posizioneFinale),
    })),
    cycleTimeMedioGiorni:
      tempi.length === 0 ? null : tempi.reduce((a, b) => a + b, 0) / tempi.length,
  }
}

export interface SerieCfd {
  colonne: { codice: string; nome: string }[]
  punti: PuntoCfd[]
}

/** Dati del diagramma di flusso cumulativo tra `dal` e `al` (inclusi) */
export async function serieCfd(commessaId: number, dal: DataIso, al: DataIso): Promise<SerieCfd> {
  const conf = await configurazioneFlusso(commessaId)
  const transizioni = await transizioniCommessa(commessaId, conf)
  const colonnaDiOrdine: Record<number, string> = {}
  for (const s of conf.stati) colonnaDiOrdine[s.posizione] = s.colonnaCodice
  return {
    colonne: conf.colonne.map((c) => ({ codice: c.codice, nome: c.nome })),
    punti: cfd(transizioni, colonnaDiOrdine, dal, al),
  }
}
