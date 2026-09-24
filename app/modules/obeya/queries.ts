/**
 * Query della vista Obeya. Proprietario: agente B1 (Fase 2).
 * Compone le query degli altri moduli; non scrive su nessuna tabella.
 */
import type { Avviso } from '#domain/types'

/** Avvisi "da affrontare in riunione" per la commessa */
export async function avvisiCommessa(commessaId: number): Promise<Avviso[]> {
  void commessaId
  throw new Error('non implementato')
}
