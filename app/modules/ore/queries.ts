/**
 * Query di lettura delle ore. Proprietario: agente A4.
 * Regola: nessuna classifica per persona. Le ore per persona compaiono solo
 * se l'abilità `vedeOrePerPersona` lo consente (disattivata di default).
 */
import type { Lunedi, Minuti } from '#domain/types'

export interface OreCommessa {
  commessaId: number
  settimana: Lunedi
  /** Totale della settimana per elaborato */
  perElaborato: { elaboratoId: number; codice: string; minutiSettimana: Minuti; minutiTotali: Minuti; budgetMinuti: Minuti }[]
  totaleSettimanaMinuti: Minuti
  totaleCommessaMinuti: Minuti
}

/** Ore della commessa aggregate per elaborato, per la settimana indicata */
export async function oreCommessa(commessaId: number, settimana: Lunedi): Promise<OreCommessa> {
  void commessaId
  void settimana
  throw new Error('non implementato')
}
