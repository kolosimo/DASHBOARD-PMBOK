/**
 * Scheda dell'elaborato (Fase 2, agente B4): collega anagrafica, Kanban, ore,
 * EVM e Last Planner. Il modulo non ha tabelle proprie: legge `elaborati`
 * (tabella condivisa) e compone le funzioni di `queries.ts` degli altri moduli.
 */
import db from '@adonisjs/lucid/services/db'
import type { ClasseServizio, DataIso, Lunedi, Minuti } from '#domain/types'
import { workItemAge } from '#domain/flusso'
import {
  posizioneNelFlusso,
  storicoElaborato,
  type PosizioneNelFlusso,
  type TransizioneStorico,
} from '#modules/flusso/queries'
import {
  minutiElaborato,
  orePerPersonaElaborato,
  oreSettimanaliElaborato,
  type OrePersonaElaborato,
} from '#modules/ore/queries'
import { riepilogoEvm, type RigaEvmElaborato } from '#modules/evm/queries'
import { collegamentiElaborato, type CollegamentiElaborato } from '#modules/lps/queries'

export interface SchedaElaborato {
  elaboratoId: number
  commessaId: number
  codice: string
  titolo: string
  disciplina: string
  classeServizio: ClasseServizio
  dataFissa: DataIso | null
  responsabileNome: string | null
  milestone: { titolo: string; dataPrevista: DataIso | null } | null
  version: number
  statoId: number
  statoNome: string
  /** Da quando è nello stato attuale (ISO) */
  statoDal: string
  /** Work Item Age in giorni; null se è nello stato finale */
  etaGiorni: number | null
  flusso: PosizioneNelFlusso | null
  budgetMinuti: Minuti
  /** Ore registrate da tutti, dall'inizio (AC dell'elaborato) */
  acMinuti: Minuti
  /** AC / budget (0–1+), null con budget 0 */
  consumoBudget: number | null
  oreSettimanali: { settimana: Lunedi; minuti: Minuti }[]
  transizioni: TransizioneStorico[]
  /** Riga EVM dell'elaborato alla data di oggi (null se non calcolabile) */
  evm: Omit<RigaEvmElaborato, 'codice' | 'titolo'> | null
  lps: CollegamentiElaborato
}

function istanteIso(valore: Date | string): string {
  return valore instanceof Date ? valore.toISOString() : String(valore)
}

/**
 * Tutti i dati della scheda, null se l'elaborato non esiste o è di un'altra
 * commessa. Le ore per persona non ci sono: si leggono a parte con
 * `orePerPersona`, solo se l'abilità `vedeOrePerPersona` lo consente.
 * Le query vanno in sequenza: nei test condividono una sola connessione.
 */
export async function schedaElaborato(
  commessaId: number,
  elaboratoId: number,
  oggi: DataIso
): Promise<SchedaElaborato | null> {
  const r = await db
    .from('elaborati as e')
    .join('stati_elaborato as s', 's.id', 'e.stato_id')
    .join('discipline as d', 'd.id', 'e.disciplina_id')
    .leftJoin('utenti as u', 'u.id', 'e.responsabile_id')
    .leftJoin('milestone as m', 'm.id', 'e.milestone_id')
    .where('e.id', elaboratoId)
    .where('e.commessa_id', commessaId)
    .select(
      'e.id',
      'e.codice',
      'e.titolo',
      'e.classe_servizio',
      'e.data_fissa',
      'e.budget_minuti',
      'e.stato_id',
      'e.stato_dal',
      'e.version',
      's.nome as stato_nome',
      'd.nome as disciplina_nome',
      'd.codice as disciplina_codice',
      'u.nome as responsabile_nome',
      'm.titolo as milestone_titolo',
      'm.data_prevista as milestone_data'
    )
    .first()
  if (!r) return null

  const flusso = await posizioneNelFlusso(commessaId, Number(r.stato_id))
  const transizioni = await storicoElaborato(elaboratoId)
  const acMinuti = await minutiElaborato(elaboratoId)
  const oreSettimanali = await oreSettimanaliElaborato(elaboratoId)
  const riepilogo = await riepilogoEvm(commessaId, oggi)
  const lps = await collegamentiElaborato(commessaId, elaboratoId)

  const rigaEvm = riepilogo.perElaborato.find((e) => e.elaboratoId === elaboratoId)
  const statoDal = istanteIso(r.stato_dal)
  const budget = Number(r.budget_minuti)

  return {
    elaboratoId,
    commessaId,
    codice: String(r.codice),
    titolo: String(r.titolo),
    disciplina: `${r.disciplina_codice} · ${r.disciplina_nome}`,
    classeServizio: r.classe_servizio,
    dataFissa: r.data_fissa ?? null,
    responsabileNome: r.responsabile_nome ?? null,
    milestone: r.milestone_titolo
      ? { titolo: String(r.milestone_titolo), dataPrevista: r.milestone_data ?? null }
      : null,
    version: Number(r.version),
    statoId: Number(r.stato_id),
    statoNome: String(r.stato_nome),
    statoDal,
    etaGiorni: flusso && !flusso.inFinale ? workItemAge(statoDal, oggi) : null,
    flusso,
    budgetMinuti: budget,
    acMinuti,
    consumoBudget: budget > 0 ? acMinuti / budget : null,
    oreSettimanali,
    transizioni,
    evm: rigaEvm ? (({ codice: _c, titolo: _t, ...resto }) => resto)(rigaEvm) : null,
    lps,
  }
}

/** Ore per persona sull'elaborato: SOLO dopo il controllo di `vedeOrePerPersona` */
export async function orePerPersona(elaboratoId: number): Promise<OrePersonaElaborato[]> {
  return orePerPersonaElaborato(elaboratoId)
}
