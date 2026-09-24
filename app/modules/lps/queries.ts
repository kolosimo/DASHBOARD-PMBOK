/**
 * Query di lettura del Last Planner. Proprietario: agente A2.
 * Le formule sono in #domain/lps (contratto di Fase 0).
 */
import type { Indice, Lunedi, StatoPiano, VoceParetoCausa } from '#domain/types'

export interface RiepilogoLps {
  commessaId: number
  settimana: Lunedi
  statoPiano: StatoPiano | null
  promessi: number
  fatti: number
  /** Rapporto 0–1, null se nessun impegno promesso */
  ppc: Indice
  vincoliAperti: number
  pcr: Indice
  tmr: Indice
  ta: Indice
  /** Serie storica dagli snapshot_lps (settimane chiuse) più la settimana corrente */
  storicoPpc: { settimana: Lunedi; ppc: Indice; daSnapshot: boolean }[]
}

/** Riepilogo LPS della commessa per la settimana indicata (lunedì) */
export async function riepilogoLps(commessaId: number, settimana: Lunedi): Promise<RiepilogoLps> {
  void commessaId
  void settimana
  throw new Error('non implementato')
}

/**
 * Pareto delle cause di non completamento nelle settimane da `daSettimana`
 * ad `aSettimana` incluse (impegni con fatto = false).
 */
export async function paretoCause(
  commessaId: number,
  daSettimana: Lunedi,
  aSettimana: Lunedi
): Promise<VoceParetoCausa[]> {
  void commessaId
  void daSettimana
  void aSettimana
  throw new Error('non implementato')
}
