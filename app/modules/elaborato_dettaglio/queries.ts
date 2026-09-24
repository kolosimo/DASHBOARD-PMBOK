/**
 * Scheda dell'elaborato (Fase 2, agente B4): collega Kanban, ore, EVM e LPS.
 */
import type { Minuti } from '#domain/types'

export interface SchedaElaborato {
  elaboratoId: number
  codice: string
  titolo: string
  statoNome: string
  budgetMinuti: Minuti
  acMinuti: Minuti
  transizioni: { daStato: string | null; aStato: string; il: string; motivo: string | null }[]
}

export async function schedaElaborato(commessaId: number, elaboratoId: number): Promise<SchedaElaborato | null> {
  void commessaId
  void elaboratoId
  throw new Error('non implementato')
}
