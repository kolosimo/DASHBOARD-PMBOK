/**
 * Avvisi "da affrontare in riunione" (Obeya) e semafori del portafoglio.
 *
 * CONTRATTO fissato in Fase 0: il corpo lo scrive l'agente B1 (Fase 2).
 * Le soglie vengono da `impostazioni` (valori di esempio) tramite soglie.ts.
 */
import type { Avviso, DataIso, Indice, Minuti, Soglia } from '#domain/types'

export interface DatiAvvisi {
  spi: Indice
  cpi: Indice
  pvMinuti: Minuti
  evMinuti: Minuti
  bacMinuti: Minuti
  eacMinuti: Minuti | null
  etcMinuti: Minuti | null
  oggi: DataIso
  vincoliAperti: readonly { codice: string; descrizione: string; dataNecessaria: DataIso | null }[]
  colonne: readonly { nome: string; conteggio: number; limite: number | null }[]
  elaboratiFermi: readonly { codice: string; giorniNelloStato: number }[]
}

export interface SoglieAvvisi {
  spi: Soglia
  cpi: Soglia
  /** Giorni entro cui un vincolo aperto in scadenza diventa avviso */
  giorniPreavvisoVincoli: number
  /** Giorni nello stesso stato oltre i quali un elaborato è "fermo" */
  giorniElaboratoFermo: number
}

/**
 * Genera gli avvisi, in quest'ordine:
 * 1. SPI in rosso → critico: "SPI x: in ritardo di N h di lavoro rispetto al piano" (N = PV − EV);
 * 2. CPI in rosso → critico: "CPI x: a completamento si stimano EAC h contro BAC h a budget (servono ancora ETC h)";
 * 3. vincoli aperti con data necessaria entro `giorniPreavvisoVincoli` → attenzione;
 * 4. colonne oltre il limite WIP → attenzione;
 * 5. elaborati fermi da ≥ `giorniElaboratoFermo` giorni → attenzione.
 * Indici null non generano avvisi. Nessun avviso nomina singole persone.
 */
export function generaAvvisi(dati: DatiAvvisi, soglie: SoglieAvvisi): Avviso[] {
  void dati
  void soglie
  throw new Error('non implementato')
}
