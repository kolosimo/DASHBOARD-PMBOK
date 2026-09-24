/**
 * Calendario dell'app: settimane ISO con lunedì in Europe/Rome.
 *
 * - Una settimana si identifica con la data 'YYYY-MM-DD' del suo lunedì.
 * - Gli istanti (timestamptz) si convertono in data **nel fuso di Roma**
 *   prima di calcolare la settimana: domenica 23:30 UTC in estate è già
 *   lunedì a Roma.
 * - Gli anni ISO con 53 settimane (per esempio 2020, 2026) sono gestiti.
 */
import { DateTime } from 'luxon'
import type { DataIso, Lunedi } from '#domain/types'

export const FUSO = 'Europe/Rome'

type Istante = Date | DateTime | string

/** Converte un istante o una data ISO in DateTime nel fuso di Roma */
function aRoma(valore: Istante): DateTime {
  let dt: DateTime
  if (DateTime.isDateTime(valore)) {
    dt = valore
  } else if (valore instanceof Date) {
    dt = DateTime.fromJSDate(valore)
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(valore)) {
    // Data senza ora: è già una data di calendario romana
    dt = DateTime.fromISO(valore, { zone: FUSO })
  } else {
    dt = DateTime.fromISO(valore, { setZone: true })
  }
  if (!dt.isValid) {
    throw new Error(`Data non valida: ${String(valore)}`)
  }
  return dt.setZone(FUSO)
}

/** Data di calendario (Europe/Rome) di un istante */
export function dataRoma(valore: Istante): DataIso {
  return aRoma(valore).toISODate()!
}

/** Oggi a Roma */
export function oggiRoma(adesso: Date = new Date()): DataIso {
  return dataRoma(adesso)
}

/** Lunedì della settimana ISO che contiene l'istante o la data */
export function lunediDellaSettimana(valore: Istante): Lunedi {
  return aRoma(valore).startOf('day').set({ weekday: 1 }).toISODate()!
}

/** true se la data 'YYYY-MM-DD' è un lunedì */
export function eLunedi(data: DataIso): boolean {
  const dt = DateTime.fromISO(data, { zone: FUSO })
  return dt.isValid && dt.weekday === 1 && dt.toISODate() === data
}

/** Anno ISO e numero di settimana (1–53) */
export function settimanaIso(valore: Istante): { anno: number; settimana: number } {
  const dt = aRoma(valore)
  return { anno: dt.weekYear, settimana: dt.weekNumber }
}

/** Numero di settimane ISO dell'anno (52 o 53) */
export function settimaneNellAnno(anno: number): number {
  return DateTime.fromObject({ weekYear: anno, weekNumber: 1 }, { zone: FUSO }).weeksInWeekYear
}

/** Lunedì della settimana ISO indicata. Errore se la settimana non esiste. */
export function lunediDaSettimanaIso(anno: number, settimana: number): Lunedi {
  if (!Number.isInteger(settimana) || settimana < 1 || settimana > settimaneNellAnno(anno)) {
    throw new Error(`La settimana ${settimana} non esiste nell'anno ISO ${anno}`)
  }
  return DateTime.fromObject(
    { weekYear: anno, weekNumber: settimana, weekday: 1 },
    { zone: FUSO }
  ).toISODate()!
}

/** Sposta un lunedì di n settimane (n può essere negativo) */
export function aggiungiSettimane(lunedi: Lunedi, n: number): Lunedi {
  controllaLunedi(lunedi)
  return DateTime.fromISO(lunedi, { zone: FUSO }).plus({ weeks: n }).toISODate()!
}

/** Domenica della settimana che inizia con il lunedì dato */
export function domenicaDi(lunedi: Lunedi): DataIso {
  controllaLunedi(lunedi)
  return DateTime.fromISO(lunedi, { zone: FUSO }).plus({ days: 6 }).toISODate()!
}

/** Giorni da lunedì a venerdì della settimana */
export function giorniLavorativi(lunedi: Lunedi): DataIso[] {
  controllaLunedi(lunedi)
  const inizio = DateTime.fromISO(lunedi, { zone: FUSO })
  return [0, 1, 2, 3, 4].map((d) => inizio.plus({ days: d }).toISODate()!)
}

/** Elenco di n lunedì consecutivi a partire da `lunedi` (lookahead) */
export function settimaneDa(lunedi: Lunedi, n: number): Lunedi[] {
  return Array.from({ length: n }, (_, i) => aggiungiSettimane(lunedi, i))
}

/** Numero di settimane tra due lunedì (b − a) */
export function differenzaSettimane(a: Lunedi, b: Lunedi): number {
  controllaLunedi(a)
  controllaLunedi(b)
  const da = DateTime.fromISO(a, { zone: 'UTC' })
  const al = DateTime.fromISO(b, { zone: 'UTC' })
  return Math.round(al.diff(da, 'weeks').weeks)
}

/** Giorni di calendario tra due date 'YYYY-MM-DD' (b − a) */
export function differenzaGiorni(a: DataIso, b: DataIso): number {
  const da = DateTime.fromISO(a, { zone: 'UTC' })
  const al = DateTime.fromISO(b, { zone: 'UTC' })
  return Math.round(al.diff(da, 'days').days)
}

/** Etichetta breve "W39" */
export function etichettaSettimana(lunedi: Lunedi): string {
  const { settimana } = settimanaIso(lunedi)
  return `W${settimana}`
}

/** Etichetta estesa "W39 2026" */
export function etichettaSettimanaAnno(lunedi: Lunedi): string {
  const { anno, settimana } = settimanaIso(lunedi)
  return `W${settimana} ${anno}`
}

function controllaLunedi(data: string) {
  if (!eLunedi(data)) {
    throw new Error(`Non è un lunedì: ${data}`)
  }
}
