/**
 * Password degli account locali: generazione delle password temporanee,
 * regole per la nuova password, hash con scrypt (hasher di AdonisJS,
 * built-in di Node: nessuna dipendenza nativa).
 */
import { randomInt } from 'node:crypto'
import hash from '@adonisjs/core/services/hash'

export const LUNGHEZZA_MINIMA = 12
export const LUNGHEZZA_MASSIMA = 200

/** Caratteri senza ambiguità di lettura (niente 0/O, 1/l/I) */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/**
 * Password temporanea casuale, da mostrare una sola volta all'admin.
 * 16 caratteri in 4 gruppi separati da trattino (es. "aB3k-9QwZ-..."),
 * circa 94 bit di entropia.
 */
export function generaPasswordTemporanea(): string {
  const gruppi: string[] = []
  for (let g = 0; g < 4; g++) {
    let s = ''
    for (let i = 0; i < 4; i++) s += ALFABETO[randomInt(ALFABETO.length)]
    gruppi.push(s)
  }
  return gruppi.join('-')
}

/** Errore in italiano se la nuova password non va bene, altrimenti null */
export function erroreNuovaPassword(password: string, conferma: string): string | null {
  if (password.length < LUNGHEZZA_MINIMA) {
    return `La nuova password deve avere almeno ${LUNGHEZZA_MINIMA} caratteri.`
  }
  if (password.length > LUNGHEZZA_MASSIMA) {
    return `La nuova password può avere al massimo ${LUNGHEZZA_MASSIMA} caratteri.`
  }
  if (password.trim().length === 0) {
    return 'La nuova password non può essere fatta solo di spazi.'
  }
  if (password !== conferma) {
    return 'Le due password non coincidono.'
  }
  return null
}

export function calcolaHash(password: string): Promise<string> {
  return hash.make(password)
}

let hashFittizio: string | null = null

/**
 * Verifica la password. Senza hash (utente inesistente o senza password)
 * esegue comunque un confronto su un hash fittizio, così i tempi di risposta
 * non rivelano se l'email esiste.
 */
export async function verificaPassword(hashSalvato: string | null, password: string) {
  if (!hashSalvato) {
    hashFittizio ??= await hash.make('password-fittizia-per-tempi-costanti')
    await hash.verify(hashFittizio, password)
    return false
  }
  try {
    return await hash.verify(hashSalvato, password)
  } catch {
    return false
  }
}
