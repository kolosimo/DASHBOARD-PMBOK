/**
 * Formattazione per l'interfaccia, in italiano (it-IT).
 * Ogni valore null, undefined o non finito diventa "n.d.".
 * Disponibile nei template Edge come `formato.<funzione>(...)`.
 */
import { DateTime } from 'luxon'
import { FUSO, etichettaSettimana } from '#shared/calendario'
import { classeSemaforo, etichettaSemaforo, semaforo } from '#domain/soglie'
import type { Soglia } from '#domain/types'

export const ND = 'n.d.'

type Numero = number | null | undefined

function valido(x: Numero): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

/** Numero con separatori italiani: 1234,5 → "1.234,5" */
export function numero(x: Numero, decimali = 0): string {
  if (!valido(x)) return ND
  return x.toLocaleString('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
    useGrouping: 'always',
  })
}

/** Indice con due decimali: 0.9523 → "0,95" (SPI, CPI) */
export function indice(x: Numero): string {
  return numero(x, 2)
}

/** Rapporto 0–1 come percentuale intera: 0.714 → "71%" (PPC, PCR) */
export function percento(x: Numero, decimali = 0): string {
  if (!valido(x)) return ND
  return `${numero(x * 100, decimali)}%`
}

/** Minuti in ore intere: 1500 → "25 h" */
export function ore(minuti: Numero): string {
  if (!valido(minuti)) return ND
  return `${numero(minuti / 60, 0)} h`
}

/** Minuti in ore con decimali se servono: 90 → "1,5 h", 120 → "2 h" */
export function oreEsatte(minuti: Numero): string {
  if (!valido(minuti)) return ND
  const h = minuti / 60
  const decimali = Number.isInteger(h) ? 0 : Number.isInteger(h * 10) ? 1 : 2
  return `${numero(h, decimali)} h`
}

/** Minuti in "h:mm": 95 → "1:35" */
export function oreMinuti(minuti: Numero): string {
  if (!valido(minuti)) return ND
  const segno = minuti < 0 ? '−' : ''
  const m = Math.abs(Math.round(minuti))
  return `${segno}${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

function aData(valore: string | Date | DateTime | null | undefined): DateTime | null {
  if (valore === null || valore === undefined || valore === '') return null
  let dt: DateTime
  if (DateTime.isDateTime(valore)) dt = valore
  else if (valore instanceof Date) dt = DateTime.fromJSDate(valore)
  else if (/^\d{4}-\d{2}-\d{2}$/.test(valore)) dt = DateTime.fromISO(valore, { zone: FUSO })
  else dt = DateTime.fromISO(valore)
  return dt.isValid ? dt.setZone(FUSO) : null
}

/** "24/09/2026" */
export function data(valore: string | Date | DateTime | null | undefined): string {
  const dt = aData(valore)
  return dt ? dt.toFormat('dd/LL/yyyy') : ND
}

/** "24/09" */
export function dataBreve(valore: string | Date | DateTime | null | undefined): string {
  const dt = aData(valore)
  return dt ? dt.toFormat('dd/LL') : ND
}

/** "24/09/2026 14:05" (ora di Roma) */
export function dataOra(valore: string | Date | DateTime | null | undefined): string {
  const dt = aData(valore)
  return dt ? dt.toFormat('dd/LL/yyyy HH:mm') : ND
}

/** "giovedì 24 settembre 2026" */
export function dataEstesa(valore: string | Date | DateTime | null | undefined): string {
  const dt = aData(valore)
  return dt ? dt.setLocale('it').toFormat('cccc d LLLL yyyy') : ND
}

/** Settimana dal lunedì: "W39" */
export function settimana(lunedi: string | null | undefined): string {
  if (!lunedi) return ND
  try {
    return etichettaSettimana(lunedi)
  } catch {
    return ND
  }
}

/** Classe CSS del semaforo (g, w, c, n) per un valore e una soglia */
export function classe(valore: Numero, soglia: Soglia): string {
  return classeSemaforo(semaforo(valore ?? null, soglia))
}

/** Etichetta del semaforo ("in linea", "attenzione", "critico", "n.d.") */
export function statoSemaforo(valore: Numero, soglia: Soglia): string {
  return etichettaSemaforo(semaforo(valore ?? null, soglia))
}

/** Testo sicuro per valori opzionali */
export function testo(valore: string | null | undefined): string {
  return valore === null || valore === undefined || valore === '' ? ND : valore
}
