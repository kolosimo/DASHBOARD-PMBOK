/**
 * EVM in ore (ANSI/PMI 19-006-2019 adattato alle ore di progettazione).
 *
 * CONTRATTO fissato in Fase 0: firme e formule sono vincolanti, i corpi li
 * scrive l'agente A5 dopo i test del verificatore T1.
 * Formule e casi di prova: docs/formule/formule.md.
 *
 * Tutti i valori sono in minuti interi; gli indici sono decimali o null.
 */
import type { ElaboratoEvm, Indice, IndicatoriEvm, Minuti, ValoriEvm } from '#domain/types'

/** Σ budget × peso / 100 arrotondato al minuto sulla somma (non per riga) */
function sommaPesata(
  elaborati: readonly ElaboratoEvm[],
  peso: (e: ElaboratoEvm) => number
): Minuti {
  // Si somma budget × peso (interi) e si divide per 100 una volta sola:
  // niente errori di virgola mobile e arrotondamento unico sulla somma.
  let centesimi = 0
  for (const e of elaborati) centesimi += e.budgetMinuti * peso(e)
  return Math.round(centesimi / 100)
}

/**
 * BAC = Σ budget degli elaborati (in minuti).
 */
export function calcolaBac(elaborati: readonly ElaboratoEvm[]): Minuti {
  let totale = 0
  for (const e of elaborati) totale += e.budgetMinuti
  return totale
}

/**
 * EV = Σ budget × peso cumulativo dello stato attuale / 100.
 *
 * Il peso viene dalla baseline congelata (non dalla configurazione corrente).
 * Arrotondamento: al minuto intero più vicino sulla somma, non per riga.
 */
export function calcolaEv(elaborati: readonly ElaboratoEvm[]): Minuti {
  return sommaPesata(elaborati, (e) => e.pesoStatoPercento)
}

/**
 * PV alla data di stato = Σ budget × peso dello stato pianificato alla data / 100,
 * oppure il PV cumulato congelato in `baseline_pv_settimana` per la settimana.
 * Stesso arrotondamento di EV.
 */
export function calcolaPv(elaborati: readonly ElaboratoEvm[]): Minuti {
  return sommaPesata(elaborati, (e) => e.pesoPianificatoPercento)
}

/**
 * AC = Σ minuti registrati fino alla data di stato.
 */
export function calcolaAc(elaborati: readonly ElaboratoEvm[]): Minuti {
  let totale = 0
  for (const e of elaborati) totale += e.acMinuti
  return totale
}

/**
 * SPI = EV / PV. **null se PV = 0** (l'interfaccia mostra "n.d.").
 */
export function calcolaSpi(evMinuti: Minuti, pvMinuti: Minuti): Indice {
  if (pvMinuti === 0) return null
  return evMinuti / pvMinuti
}

/**
 * CPI = EV / AC. **null se AC = 0**.
 * Con EV = 0 e AC > 0 il CPI vale 0 (e quindi EAC è null).
 */
export function calcolaCpi(evMinuti: Minuti, acMinuti: Minuti): Indice {
  if (acMinuti === 0) return null
  return evMinuti / acMinuti
}

/**
 * Indicatori completi a partire dai valori di base:
 * - SPI = EV / PV (null se PV = 0);
 * - CPI = EV / AC (null se AC = 0);
 * - EAC "stima a completamento" = BAC / CPI (null se CPI è null o 0),
 *   arrotondato al minuto;
 * - ETC "ore ancora necessarie" = EAC − AC (null se EAC è null);
 * - VAC "scarto a completamento" = BAC − EAC (null se EAC è null).
 */
export function calcolaIndicatori(valori: ValoriEvm): IndicatoriEvm {
  const { bacMinuti, pvMinuti, evMinuti, acMinuti } = valori
  const spi = calcolaSpi(evMinuti, pvMinuti)
  const cpi = calcolaCpi(evMinuti, acMinuti)
  // BAC / CPI = BAC × AC / EV: stessa grandezza, senza passare dal quoziente arrotondato
  const eacMinuti =
    cpi === null || cpi === 0 ? null : Math.round((bacMinuti * acMinuti) / evMinuti)
  const etcMinuti = eacMinuti === null ? null : eacMinuti - acMinuti
  const vacMinuti = eacMinuti === null ? null : bacMinuti - eacMinuti
  return { bacMinuti, pvMinuti, evMinuti, acMinuti, spi, cpi, eacMinuti, etcMinuti, vacMinuti }
}

/**
 * Comodità: BAC, PV, EV, AC e indicatori da un elenco di elaborati.
 * Equivale a calcolaIndicatori({ bac, pv, ev, ac }).
 */
export function evmDaElaborati(elaborati: readonly ElaboratoEvm[]): IndicatoriEvm {
  return calcolaIndicatori({
    bacMinuti: calcolaBac(elaborati),
    pvMinuti: calcolaPv(elaborati),
    evMinuti: calcolaEv(elaborati),
    acMinuti: calcolaAc(elaborati),
  })
}
