/**
 * Tipi condivisi del dominio. File di proprietà dell'orchestratore:
 * i moduli li importano, non li modificano (vedi docs/sviluppo/proprieta-file.md).
 *
 * Convenzioni:
 * - durate, ore e budget in **minuti interi** (`Minuti`);
 * - date senza ora come stringa ISO 'YYYY-MM-DD' (`DataIso`);
 * - settimane indicate dalla data del loro lunedì in Europe/Rome (`Lunedi`);
 * - rapporti (SPI, CPI, PPC, PCR…) come numeri decimali, `null` se il
 *   divisore è 0: l'interfaccia mostra "n.d.".
 */

/** Minuti interi (ore × 60) */
export type Minuti = number

/** Data 'YYYY-MM-DD' senza ora */
export type DataIso = string

/** Data 'YYYY-MM-DD' di un lunedì (Europe/Rome): identifica una settimana ISO */
export type Lunedi = string

/** Rapporto decimale oppure null quando non calcolabile ("n.d.") */
export type Indice = number | null

export const RUOLI_GLOBALI = ['admin', 'direzione', 'pm', 'progettista'] as const
export type RuoloGlobale = (typeof RUOLI_GLOBALI)[number]

export const RUOLI_COMMESSA = ['pm', 'progettista', 'verificatore', 'osservatore'] as const
export type RuoloCommessa = (typeof RUOLI_COMMESSA)[number]

export const STATI_COMMESSA = ['attiva', 'sospesa', 'chiusa'] as const
export type StatoCommessa = (typeof STATI_COMMESSA)[number]

export const CLASSI_SERVIZIO = ['standard', 'data_fissa', 'urgente', 'intangibile'] as const
export type ClasseServizio = (typeof CLASSI_SERVIZIO)[number]

export const STATI_VINCOLO = ['da_analizzare', 'aperto', 'rimosso', 'annullato'] as const
export type StatoVincolo = (typeof STATI_VINCOLO)[number]

export const CATEGORIE_VINCOLO = [
  'input_da_altri',
  'approvazione',
  'risorsa',
  'criteri',
  'informazioni',
  'altro',
] as const
export type CategoriaVincolo = (typeof CATEGORIE_VINCOLO)[number]

export const STATI_PIANO = ['bozza', 'promesso', 'chiuso'] as const
export type StatoPiano = (typeof STATI_PIANO)[number]

export const TIPI_ATTIVITA_LOOKAHEAD = ['attivita', 'milestone'] as const
export type TipoAttivitaLookahead = (typeof TIPI_ATTIVITA_LOOKAHEAD)[number]

export const STATI_BASELINE = ['bozza', 'approvata', 'superata'] as const
export type StatoBaseline = (typeof STATI_BASELINE)[number]

/** Esito di un semaforo. 'nd' quando il valore non è calcolabile */
export type Semaforo = 'verde' | 'giallo' | 'rosso' | 'nd'

/** Soglia di un semaforo. `verso: 'alto'` = più alto è meglio */
export interface Soglia {
  verde: number
  giallo: number
  verso: 'alto' | 'basso'
}

// ---------------------------------------------------------------------------
// EVM
// ---------------------------------------------------------------------------

/** Dati minimi di un elaborato per il calcolo EVM */
export interface ElaboratoEvm {
  elaboratoId: number
  budgetMinuti: Minuti
  /** Peso cumulativo dello stato attuale, 0–100, preso dalla baseline congelata */
  pesoStatoPercento: number
  /** Peso cumulativo dello stato pianificato alla data di stato, 0–100 */
  pesoPianificatoPercento: number
  /** Ore registrate sull'elaborato fino alla data di stato */
  acMinuti: Minuti
}

/** Valori EVM di base, in minuti */
export interface ValoriEvm {
  bacMinuti: Minuti
  pvMinuti: Minuti
  evMinuti: Minuti
  acMinuti: Minuti
}

/** Indicatori EVM derivati */
export interface IndicatoriEvm extends ValoriEvm {
  spi: Indice
  cpi: Indice
  /** Stima a completamento (BAC / CPI) */
  eacMinuti: Minuti | null
  /** Ore ancora necessarie (EAC − AC) */
  etcMinuti: Minuti | null
  /** Scarto a completamento (BAC − EAC) */
  vacMinuti: Minuti | null
}

/** Punto della curva S (valori cumulati a fine settimana) */
export interface PuntoCurvaS {
  settimana: Lunedi
  pvMinuti: Minuti
  evMinuti: Minuti | null
  acMinuti: Minuti | null
  /** true se il punto viene da uno snapshot (storia), false se calcolato ora */
  daSnapshot: boolean
}

// ---------------------------------------------------------------------------
// Last Planner
// ---------------------------------------------------------------------------

export interface ImpegnoLps {
  impegnoId: number
  fatto: boolean | null
  causaId: number | null
  aggiuntoDopoPromessa: boolean
}

export interface VincoloLps {
  vincoloId: number
  stato: StatoVincolo
  identificatoIl: DataIso
  dataNecessaria: DataIso | null
  /** Data (Europe/Rome) di rimozione, null se non rimosso */
  rimossoIl: DataIso | null
  /** Data (Europe/Rome) di annullamento, null se non annullato */
  annullatoIl: DataIso | null
}

/** Riga di snapshot_lookahead usata per TMR/TA */
export interface AttivitaSnapshotLps {
  codiceAttivita: string
  settimanaInizio: Lunedi
  settimanaFine: Lunedi
  pronta: boolean
}

export interface RisultatoPpc {
  promessi: number
  fatti: number
  ppc: Indice
}

export interface RisultatoPcr {
  daRimuovere: number
  rimossi: number
  pcr: Indice
}

export interface RisultatoTmrTa {
  /** Tasks Made Ready */
  tmr: Indice
  /** Tasks Anticipated */
  ta: Indice
}

export interface VoceParetoCausa {
  causaId: number
  codice: string
  nome: string
  conteggio: number
}

// ---------------------------------------------------------------------------
// Flusso / Kanban
// ---------------------------------------------------------------------------

export interface TransizioneFlusso {
  elaboratoId: number
  daStatoOrdine: number | null
  aStatoOrdine: number
  /** Istante ISO 8601 con fuso */
  avvenutaIl: string
}

export interface PuntoCfd {
  giorno: DataIso
  /** conteggio elaborati per codice colonna */
  perColonna: Record<string, number>
}

// ---------------------------------------------------------------------------
// Avvisi (Obeya / portafoglio)
// ---------------------------------------------------------------------------

export type GravitaAvviso = 'critico' | 'attenzione'

export interface Avviso {
  gravita: GravitaAvviso
  codice: string
  messaggio: string
}

// ---------------------------------------------------------------------------
// Eventi in tempo reale
// ---------------------------------------------------------------------------

export const TIPI_EVENTO = [
  'commessa.aggiornata',
  'elaborato.aggiornato',
  'elaborato.stato_cambiato',
  'vincolo.aggiornato',
  'lookahead.aggiornato',
  'piano.aggiornato',
  'ore.registrate',
  'baseline.aggiornata',
  'impostazioni.aggiornate',
] as const
export type TipoEvento = (typeof TIPI_EVENTO)[number]
