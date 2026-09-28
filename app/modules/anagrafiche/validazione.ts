/**
 * Validazione dei moduli (form) con messaggi in italiano.
 *
 * I form arrivano come testo: qui si convertono numeri con la virgola, ore in
 * minuti, date "gg/mm/aaaa" o "aaaa-mm-gg". Ogni errore si associa al nome del
 * campo e la vista lo mostra accanto al campo.
 */
import { DateTime } from 'luxon'
import type { DataIso, Minuti } from '#domain/types'

export type Errori = Record<string, string>

/** Massimo di ore accettato per un budget (evita refusi con zeri in più) */
export const ORE_MASSIME_BUDGET = 100_000

/**
 * Numero scritto all'italiana: "1.234,5" → 1234.5, "12,5" → 12.5.
 * Accetta anche il punto decimale ("12.5") se non sembra un separatore delle migliaia.
 * Restituisce null se il testo non è un numero.
 */
export function numeroItaliano(valore: unknown): number | null {
  if (typeof valore === 'number') return Number.isFinite(valore) ? valore : null
  if (typeof valore !== 'string') return null
  let s = valore.trim().replace(/\s/g, '')
  if (s === '') return null
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Ore scritte dall'utente → minuti interi ("12,5" → 750); null se non valide */
export function oreInMinuti(valore: unknown): Minuti | null {
  const ore = numeroItaliano(valore)
  if (ore === null) return null
  return Math.round(ore * 60)
}

/** Data "aaaa-mm-gg" o "gg/mm/aaaa" → "aaaa-mm-gg"; null se non valida */
export function dataIso(valore: unknown): DataIso | null {
  if (typeof valore !== 'string') return null
  const s = valore.trim()
  let dt: DateTime | null = null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) dt = DateTime.fromISO(s)
  else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) dt = DateTime.fromFormat(s, 'd/M/yyyy')
  if (!dt || !dt.isValid) return null
  return dt.toISODate()
}

interface OpzioniTesto {
  obbligatorio?: boolean
  max?: number
}

interface OpzioniNumero {
  obbligatorio?: boolean
  min?: number
  max?: number
}

/**
 * Lettore dei campi di un form: ogni metodo restituisce il valore convertito
 * (o null) e, se non valido, registra l'errore in italiano in `errori`.
 */
export class Campi {
  errori: Errori = {}

  constructor(private dati: Record<string, unknown>) {}

  get valido() {
    return Object.keys(this.errori).length === 0
  }

  errore(campo: string, messaggio: string) {
    if (!this.errori[campo]) this.errori[campo] = messaggio
  }

  grezzo(campo: string): string {
    const v = this.dati[campo]
    if (Array.isArray(v)) return String(v[v.length - 1] ?? '')
    return v === undefined || v === null ? '' : String(v)
  }

  testo(campo: string, etichetta: string, opz: OpzioniTesto = {}): string | null {
    const s = this.grezzo(campo).trim()
    if (s === '') {
      if (opz.obbligatorio) this.errore(campo, `${etichetta}: campo obbligatorio.`)
      return null
    }
    if (opz.max && s.length > opz.max) {
      this.errore(campo, `${etichetta}: al massimo ${opz.max} caratteri.`)
      return null
    }
    return s
  }

  data(campo: string, etichetta: string, opz: { obbligatorio?: boolean } = {}): DataIso | null {
    const s = this.grezzo(campo).trim()
    if (s === '') {
      if (opz.obbligatorio) this.errore(campo, `${etichetta}: campo obbligatorio.`)
      return null
    }
    const d = dataIso(s)
    if (!d) this.errore(campo, `${etichetta}: data non valida (usa gg/mm/aaaa).`)
    return d
  }

  intero(campo: string, etichetta: string, opz: OpzioniNumero = {}): number | null {
    const s = this.grezzo(campo).trim()
    if (s === '') {
      if (opz.obbligatorio) this.errore(campo, `${etichetta}: campo obbligatorio.`)
      return null
    }
    const n = numeroItaliano(s)
    if (n === null || !Number.isInteger(n)) {
      this.errore(campo, `${etichetta}: serve un numero intero.`)
      return null
    }
    if (opz.min !== undefined && n < opz.min) {
      this.errore(campo, `${etichetta}: il valore minimo è ${opz.min}.`)
      return null
    }
    if (opz.max !== undefined && n > opz.max) {
      this.errore(campo, `${etichetta}: il valore massimo è ${opz.max}.`)
      return null
    }
    return n
  }

  /** Ore (anche con decimali) convertite in minuti interi, non negative */
  ore(campo: string, etichetta: string, opz: { obbligatorio?: boolean } = {}): Minuti | null {
    const s = this.grezzo(campo).trim()
    if (s === '') {
      if (opz.obbligatorio) this.errore(campo, `${etichetta}: campo obbligatorio.`)
      return null
    }
    const ore = numeroItaliano(s)
    if (ore === null) {
      this.errore(campo, `${etichetta}: serve un numero di ore (per esempio 12,5).`)
      return null
    }
    if (ore < 0) {
      this.errore(campo, `${etichetta}: le ore non possono essere negative.`)
      return null
    }
    if (ore > ORE_MASSIME_BUDGET) {
      this.errore(
        campo,
        `${etichetta}: al massimo ${ORE_MASSIME_BUDGET.toLocaleString('it-IT')} ore.`
      )
      return null
    }
    return Math.round(ore * 60)
  }

  scelta<T extends string>(
    campo: string,
    etichetta: string,
    valori: readonly T[],
    opz: { obbligatorio?: boolean } = {}
  ): T | null {
    const s = this.grezzo(campo).trim()
    if (s === '') {
      if (opz.obbligatorio) this.errore(campo, `${etichetta}: scegli un valore.`)
      return null
    }
    if (!(valori as readonly string[]).includes(s)) {
      this.errore(campo, `${etichetta}: valore non previsto.`)
      return null
    }
    return s as T
  }

  /** Identificativo numerico (select); null se vuoto */
  id(campo: string, etichetta: string, opz: { obbligatorio?: boolean } = {}): number | null {
    if (this.grezzo(campo).trim() === '') {
      if (opz.obbligatorio) this.errore(campo, `${etichetta}: scegli un valore.`)
      return null
    }
    const n = numeroItaliano(this.grezzo(campo))
    if (n === null || !Number.isInteger(n) || n < 1) {
      this.errore(campo, `${etichetta}: valore non previsto.`)
      return null
    }
    return n
  }

  /** Checkbox: presente e "on"/"true"/"1" */
  booleano(campo: string): boolean {
    const s = this.grezzo(campo).trim().toLowerCase()
    return s === 'on' || s === 'true' || s === '1'
  }

  /** Versione vista dall'utente (optimistic locking) */
  versione(): number {
    const n = this.intero('version', 'Versione', { obbligatorio: true, min: 1 })
    return n ?? 0
  }
}

/** true se l'errore del DB è una violazione di unicità (codice PostgreSQL 23505) */
export function eViolazioneUnicita(errore: unknown): boolean {
  return (
    typeof errore === 'object' && errore !== null && (errore as { code?: string }).code === '23505'
  )
}

/** true se l'errore del DB è una violazione di chiave esterna (23503) */
export function eViolazioneChiaveEsterna(errore: unknown): boolean {
  return (
    typeof errore === 'object' && errore !== null && (errore as { code?: string }).code === '23503'
  )
}
