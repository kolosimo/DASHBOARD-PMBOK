/**
 * Query di lettura del flusso (Kanban). Proprietario: agente A3.
 * Formule in #domain/flusso (contratto di Fase 0).
 *
 * Nota: gli stati si passano alle formule per **posizione** nella sequenza
 * ordinata (0 = iniziale): con i dati di esempio coincide con `ordine`.
 */
import db from '@adonisjs/lucid/services/db'
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

/** Kanban della commessa con WIP, età e throughput, alla data `oggi` */
export async function riepilogoFlusso(commessaId: number, oggi: DataIso): Promise<RiepilogoFlusso> {
  const conf = await configurazioneFlusso(commessaId)

  // Una query: elaborati con stato, disciplina e ore registrate (AC)
  const righe = await db
    .from('elaborati as e')
    .join('stati_elaborato as s', 's.id', 'e.stato_id')
    .join('discipline as d', 'd.id', 'e.disciplina_id')
    .joinRaw(
      `LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(r.minuti), 0) AS minuti
         FROM registrazioni_ore r WHERE r.elaborato_id = e.id
       ) AS ac ON TRUE`
    )
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
      'd.codice as disciplina',
      'ac.minuti as ac_minuti'
    )
    .orderBy('s.ordine', 'asc')
    .orderBy('e.stato_dal', 'asc')
    .orderBy('e.codice', 'asc')

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
      acMinuti: Number(r.ac_minuti ?? 0),
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
