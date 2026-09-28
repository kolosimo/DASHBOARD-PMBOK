/**
 * Calcoli puri del modulo EVM (niente DB): distribuzione delle date della
 * baseline, stato pianificato a una data, PV settimanale da congelare.
 * Le formule EVM vere e proprie sono in #domain/evm.
 */
import { DateTime } from 'luxon'
import { calcolaPv } from '#domain/evm'
import type { DataIso, ElaboratoEvm, Lunedi, Minuti } from '#domain/types'
import { aggiungiSettimane, domenicaDi, lunediDellaSettimana } from '#shared/calendario'

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/

/** true se la stringa è una data 'YYYY-MM-DD' valida */
export function dataValida(valore: unknown): valore is DataIso {
  if (typeof valore !== 'string' || !RE_DATA.test(valore)) return false
  const dt = DateTime.fromISO(valore, { zone: 'UTC' })
  return dt.isValid && dt.toISODate() === valore
}

/**
 * Distribuisce `n` date tra `inizio` e `fine` (incluse), il più uniformi
 * possibile, arrotondate al giorno. Con n = 1 restituisce la sola fine.
 * Se fine < inizio le date coincidono con l'inizio.
 */
export function distribuisciDate(inizio: DataIso, fine: DataIso, n: number): DataIso[] {
  if (n <= 0) return []
  if (n === 1) return [fine]
  const a = DateTime.fromISO(inizio, { zone: 'UTC' })
  const b = DateTime.fromISO(fine, { zone: 'UTC' })
  const giorni = Math.max(0, Math.round(b.diff(a, 'days').days))
  return Array.from({ length: n }, (_, i) =>
    a.plus({ days: Math.round((i * giorni) / (n - 1)) }).toISODate()!
  )
}

/** Data prevista di uno stato nella baseline */
export interface DataPrevista {
  ordine: number
  data: DataIso
}

/**
 * Ordine dello stato pianificato alla data: il più alto con data prevista
 * ≤ data. 0 (non iniziato) se nessuno stato è previsto entro la data.
 */
export function ordinePianificatoAlla(date: readonly DataPrevista[], data: DataIso): number {
  let ordine = 0
  for (const d of date) {
    if (d.data <= data && d.ordine > ordine) ordine = d.ordine
  }
  return ordine
}

/**
 * Controlla che le date siano non decrescenti con l'ordine dello stato.
 * Restituisce il messaggio d'errore oppure null.
 */
export function controllaSequenzaDate(date: readonly DataPrevista[]): string | null {
  const ordinate = [...date].sort((x, y) => x.ordine - y.ordine)
  for (let i = 1; i < ordinate.length; i++) {
    if (ordinate[i].data < ordinate[i - 1].data) {
      return 'Le date devono seguire l’ordine degli stati: ogni stato non può essere previsto prima del precedente.'
    }
  }
  return null
}

/** Elaborato della baseline con il budget congelato e le date per stato */
export interface ElaboratoBaseline {
  elaboratoId: number
  budgetMinuti: Minuti
  date: DataPrevista[]
}

/**
 * PV cumulato congelato a fine settimana (domenica) per ogni settimana da
 * `primaSettimana` all'ultima con una data prevista (inclusa).
 * `pesoPerOrdine` sono i pesi congelati nella baseline, per ordine di stato.
 */
export function pvSettimanali(
  elaborati: readonly ElaboratoBaseline[],
  pesoPerOrdine: ReadonlyMap<number, number>,
  primaSettimana: Lunedi,
  massimoSettimane = 520
): { settimana: Lunedi; pvMinuti: Minuti }[] {
  let ultima: DataIso | null = null
  for (const e of elaborati) {
    for (const d of e.date) if (ultima === null || d.data > ultima) ultima = d.data
  }
  if (ultima === null) return []
  const ultimaSettimana = lunediDellaSettimana(ultima)
  const serie: { settimana: Lunedi; pvMinuti: Minuti }[] = []
  let w = primaSettimana
  for (let i = 0; i < massimoSettimane && w <= ultimaSettimana; i++) {
    const domenica = domenicaDi(w)
    serie.push({ settimana: w, pvMinuti: pvAlla(elaborati, pesoPerOrdine, domenica) })
    w = aggiungiSettimane(w, 1)
  }
  return serie
}

/** PV alla data (Σ budget × peso dello stato pianificato), arrotondato sulla somma */
export function pvAlla(
  elaborati: readonly ElaboratoBaseline[],
  pesoPerOrdine: ReadonlyMap<number, number>,
  data: DataIso
): Minuti {
  const righe: ElaboratoEvm[] = elaborati.map((e) => ({
    elaboratoId: e.elaboratoId,
    budgetMinuti: e.budgetMinuti,
    pesoStatoPercento: 0,
    pesoPianificatoPercento: pesoPerOrdine.get(ordinePianificatoAlla(e.date, data)) ?? 0,
    acMinuti: 0,
  }))
  return calcolaPv(righe)
}

/**
 * PV congelato della settimana: il valore della tabella se c'è, 0 prima
 * dell'inizio della baseline, l'ultimo valore dopo la fine.
 */
export function pvDellaSettimana(
  serie: readonly { settimana: Lunedi; pvMinuti: Minuti }[],
  settimana: Lunedi
): Minuti {
  if (serie.length === 0) return 0
  let valore = 0
  for (const p of serie) {
    if (p.settimana <= settimana) valore = p.pvMinuti
    else break
  }
  return valore
}
