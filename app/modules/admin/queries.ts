/**
 * Query del pannello di amministrazione. Proprietario: agente A1.
 */
import Impostazione from '#models/impostazione'

/** Impostazioni in ordine di chiave (implementata in Fase 0) */
export async function elencoImpostazioni() {
  return Impostazione.query().orderBy('chiave', 'asc')
}
