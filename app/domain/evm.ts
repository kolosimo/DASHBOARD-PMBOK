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

/**
 * BAC = Σ budget degli elaborati (in minuti).
 */
export function calcolaBac(elaborati: readonly ElaboratoEvm[]): Minuti {
  void elaborati
  throw new Error('non implementato')
}

/**
 * EV = Σ budget × peso cumulativo dello stato attuale / 100.
 *
 * Il peso viene dalla baseline congelata (non dalla configurazione corrente).
 * Arrotondamento: al minuto intero più vicino sulla somma, non per riga.
 */
export function calcolaEv(elaborati: readonly ElaboratoEvm[]): Minuti {
  void elaborati
  throw new Error('non implementato')
}

/**
 * PV alla data di stato = Σ budget × peso dello stato pianificato alla data / 100,
 * oppure il PV cumulato congelato in `baseline_pv_settimana` per la settimana.
 * Stesso arrotondamento di EV.
 */
export function calcolaPv(elaborati: readonly ElaboratoEvm[]): Minuti {
  void elaborati
  throw new Error('non implementato')
}

/**
 * AC = Σ minuti registrati fino alla data di stato.
 */
export function calcolaAc(elaborati: readonly ElaboratoEvm[]): Minuti {
  void elaborati
  throw new Error('non implementato')
}

/**
 * SPI = EV / PV. **null se PV = 0** (l'interfaccia mostra "n.d.").
 */
export function calcolaSpi(evMinuti: Minuti, pvMinuti: Minuti): Indice {
  void evMinuti
  void pvMinuti
  throw new Error('non implementato')
}

/**
 * CPI = EV / AC. **null se AC = 0**.
 * Con EV = 0 e AC > 0 il CPI vale 0 (e quindi EAC è null).
 */
export function calcolaCpi(evMinuti: Minuti, acMinuti: Minuti): Indice {
  void evMinuti
  void acMinuti
  throw new Error('non implementato')
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
  void valori
  throw new Error('non implementato')
}

/**
 * Comodità: BAC, PV, EV, AC e indicatori da un elenco di elaborati.
 * Equivale a calcolaIndicatori({ bac, pv, ev, ac }).
 */
export function evmDaElaborati(elaborati: readonly ElaboratoEvm[]): IndicatoriEvm {
  void elaborati
  throw new Error('non implementato')
}
