/**
 * Flusso degli elaborati (Kanban): Work Item Age, cycle time, throughput, CFD,
 * regola di avanzamento di uno stato alla volta.
 *
 * CONTRATTO fissato in Fase 0: firme e formule sono vincolanti, i corpi li
 * scrive l'agente A3 dopo i test del verificatore T1.
 */
import type { DataIso, Lunedi, PuntoCfd, TransizioneFlusso } from '#domain/types'

/**
 * Work Item Age = giorni di calendario interi tra `statoDal` e `adesso`,
 * calcolati sulle date in Europe/Rome (stesso giorno = 0).
 * Si mostra solo per gli elaborati non in stato finale.
 */
export function workItemAge(statoDal: string, adesso: string): number {
  void statoDal
  void adesso
  throw new Error('non implementato')
}

/**
 * Cycle time di un elaborato = giorni di calendario (Europe/Rome) tra la
 * prima transizione che esce dallo stato iniziale (ordine 0) e la prima
 * transizione che raggiunge lo stato finale. null se non ancora finito.
 */
export function cycleTime(
  transizioni: readonly TransizioneFlusso[],
  ordineFinale: number
): number | null {
  void transizioni
  void ordineFinale
  throw new Error('non implementato')
}

/**
 * Throughput della settimana w = numero di elaborati distinti che hanno
 * raggiunto lo stato finale tra il lunedì e la domenica di w (Europe/Rome).
 */
export function throughput(
  transizioni: readonly TransizioneFlusso[],
  settimana: Lunedi,
  ordineFinale: number
): number {
  void transizioni
  void settimana
  void ordineFinale
  throw new Error('non implementato')
}

/**
 * Diagramma di flusso cumulativo: per ogni giorno tra `dal` e `al` (inclusi)
 * il numero di elaborati in ciascuna colonna a fine giornata (Europe/Rome),
 * ricostruito dallo storico delle transizioni.
 *
 * @param colonnaDiOrdine mappa ordine stato → codice colonna Kanban
 */
export function cfd(
  transizioni: readonly TransizioneFlusso[],
  colonnaDiOrdine: Readonly<Record<number, string>>,
  dal: DataIso,
  al: DataIso
): PuntoCfd[] {
  void transizioni
  void colonnaDiOrdine
  void dal
  void al
  throw new Error('non implementato')
}

/**
 * Regola di avanzamento: si avanza di **uno** stato alla volta.
 * Per tornare indietro (di uno o più stati) serve un motivo non vuoto.
 * Restituisce null se il passaggio è ammesso, altrimenti il messaggio d'errore
 * in italiano.
 */
export function controllaPassaggioStato(
  daOrdine: number,
  aOrdine: number,
  motivo: string | null
): string | null {
  void daOrdine
  void aOrdine
  void motivo
  throw new Error('non implementato')
}

/**
 * Sforamento WIP: true se, aggiungendo un elaborato alla colonna, il numero
 * supera il limite (limite null = nessun limite). Lo sforamento va confermato
 * dall'utente e registrato nell'audit.
 */
export function sforaWip(elaboratiInColonna: number, limite: number | null): boolean {
  void elaboratiInColonna
  void limite
  throw new Error('non implementato')
}
