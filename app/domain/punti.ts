/**
 * Punti Fibonacci sugli impegni del piano settimanale (TS puro, senza DB).
 *
 * I punti misurano la dimensione relativa di un impegno e servono solo a non
 * promettere più di quanto il team riesce a fare in una settimana.
 * - Non si convertono in ore e non entrano in EVM, curva S o portafoglio.
 * - Si sommano solo per piano (commessa e settimana), mai per persona
 *   (art. 4 Statuto dei lavoratori).
 * - Il PPC resta il conteggio degli impegni (calcolaPpc in #domain/lps).
 */

/** Valori ammessi. Oltre 13 l'impegno va diviso in impegni più piccoli. */
export const SCALA_PUNTI = [1, 2, 3, 5, 8, 13] as const

export type PuntiFibonacci = (typeof SCALA_PUNTI)[number]

/** Settimane chiuse (con almeno un impegno stimato) usate per la capacità indicativa */
export const SETTIMANE_CAPACITA = 4

export function ePuntoFibonacci(n: unknown): n is PuntiFibonacci {
  return typeof n === 'number' && (SCALA_PUNTI as readonly number[]).includes(n)
}

export interface ImpegnoConPunti {
  punti: number | null
  fatto: boolean | null
  aggiuntoDopoPromessa: boolean
}

export interface PuntiPiano {
  /** Somma dei punti degli impegni promessi (esclusi quelli aggiunti dopo la promessa) */
  promessi: number
  /** Somma dei punti degli impegni promessi e fatti */
  fatti: number
  /** Impegni promessi senza punti */
  nonStimati: number
  /** Impegni promessi con i punti */
  stimati: number
}

/**
 * Punti promessi e fatti di un piano. Come nel PPC, gli impegni aggiunti dopo
 * la promessa non contano.
 */
export function puntiPiano(impegni: readonly ImpegnoConPunti[]): PuntiPiano {
  let promessi = 0
  let fatti = 0
  let stimati = 0
  let nonStimati = 0
  for (const i of impegni) {
    if (i.aggiuntoDopoPromessa) continue
    if (i.punti === null) {
      nonStimati++
      continue
    }
    stimati++
    promessi += i.punti
    if (i.fatto === true) fatti += i.punti
  }
  return { promessi, fatti, stimati, nonStimati }
}

export interface CapacitaIndicativa {
  /** Media dei punti fatti nelle settimane usate, null se non bastano */
  media: number | null
  /** Settimane usate per la media */
  settimane: number
}

/**
 * Capacità indicativa del team: media dei punti fatti nelle ultime
 * SETTIMANE_CAPACITA settimane chiuse in cui almeno un impegno era stimato.
 * Le settimane senza stime non contano (darebbero 0 senza motivo).
 *
 * @param settimaneChiuse dalla più recente alla più vecchia
 * @returns media null finché le settimane utili sono meno di SETTIMANE_CAPACITA
 */
export function capacitaIndicativa(
  settimaneChiuse: readonly PuntiPiano[],
  minimo: number = SETTIMANE_CAPACITA
): CapacitaIndicativa {
  const utili = settimaneChiuse.filter((s) => s.stimati > 0).slice(0, minimo)
  if (utili.length < minimo) return { media: null, settimane: utili.length }
  return { media: utili.reduce((a, s) => a + s.fatti, 0) / utili.length, settimane: utili.length }
}
