/**
 * Query del portafoglio. Proprietario: agente B1 (Fase 2).
 * La direzione vede solo i totali per commessa.
 */
import type Utente from '#models/utente'
import type { DataIso, Indice } from '#domain/types'

export interface RigaPortafoglio {
  commessaId: number
  codice: string
  nome: string
  spi: Indice
  cpi: Indice
  /** PPC medio delle ultime 4 settimane (rapporto 0–1) */
  ppc4Settimane: Indice
  vincoliAperti: number
  prossimaMilestone: { titolo: string; data: DataIso } | null
}

/** Righe del portafoglio per l'utente (le commesse che vede) */
export async function righePortafoglio(utente: Utente): Promise<RigaPortafoglio[]> {
  void utente
  throw new Error('non implementato')
}
