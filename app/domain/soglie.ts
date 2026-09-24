/**
 * Semaforo unico dell'app: tutte le viste (Obeya, portafoglio, EVM, LPS)
 * usano questa funzione, con soglie lette da `impostazioni`.
 */
import type { Indice, Semaforo, Soglia } from '#domain/types'

/**
 * Colore del semaforo per un valore.
 *
 * - verso 'alto' (più alto è meglio): verde se valore ≥ verde, giallo se ≥ giallo, altrimenti rosso;
 * - verso 'basso' (più basso è meglio): verde se valore ≤ verde, giallo se ≤ giallo, altrimenti rosso;
 * - valore null o non finito: 'nd'.
 */
export function semaforo(valore: Indice | undefined, soglia: Soglia): Semaforo {
  if (valore === null || valore === undefined || !Number.isFinite(valore)) return 'nd'
  if (soglia.verso === 'alto') {
    if (valore >= soglia.verde) return 'verde'
    if (valore >= soglia.giallo) return 'giallo'
    return 'rosso'
  }
  if (valore <= soglia.verde) return 'verde'
  if (valore <= soglia.giallo) return 'giallo'
  return 'rosso'
}

/** Classe CSS del prototipo per il semaforo (pill .g .w .c .n) */
export function classeSemaforo(s: Semaforo): 'g' | 'w' | 'c' | 'n' {
  switch (s) {
    case 'verde':
      return 'g'
    case 'giallo':
      return 'w'
    case 'rosso':
      return 'c'
    default:
      return 'n'
  }
}

/** Etichetta italiana del semaforo */
export function etichettaSemaforo(s: Semaforo): string {
  switch (s) {
    case 'verde':
      return 'in linea'
    case 'giallo':
      return 'attenzione'
    case 'rosso':
      return 'critico'
    default:
      return 'n.d.'
  }
}

/** Soglie di esempio (usate se le impostazioni non sono leggibili) */
export const SOGLIE_DEFAULT = {
  spi: { verde: 0.95, giallo: 0.85, verso: 'alto' },
  cpi: { verde: 0.95, giallo: 0.85, verso: 'alto' },
  ppc: { verde: 0.7, giallo: 0.55, verso: 'alto' },
  pcr: { verde: 0.8, giallo: 0.6, verso: 'alto' },
} as const satisfies Record<string, Soglia>
