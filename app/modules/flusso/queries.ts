/**
 * Query di lettura del flusso (Kanban). Proprietario: agente A3.
 * Formule in #domain/flusso (contratto di Fase 0).
 */
import type { ClasseServizio, DataIso, Lunedi, Minuti } from '#domain/types'

export interface SchedaKanban {
  elaboratoId: number
  codice: string
  titolo: string
  disciplina: string
  classeServizio: ClasseServizio
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

/** Kanban della commessa con WIP, età e throughput, alla data `oggi` */
export async function riepilogoFlusso(commessaId: number, oggi: DataIso): Promise<RiepilogoFlusso> {
  void commessaId
  void oggi
  throw new Error('non implementato')
}
