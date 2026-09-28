/**
 * Flusso degli elaborati (Kanban): Work Item Age, cycle time, throughput, CFD,
 * regola di avanzamento di uno stato alla volta.
 *
 * CONTRATTO fissato in Fase 0: firme e formule sono vincolanti, i corpi li
 * scrive l'agente A3 dopo i test del verificatore T1.
 */
import { DateTime } from 'luxon'
import type { DataIso, Lunedi, PuntoCfd, TransizioneFlusso } from '#domain/types'
import { dataRoma, differenzaGiorni, lunediDellaSettimana } from '#shared/calendario'

/** Millisecondi di un istante ISO (per ordinare le transizioni) */
function ms(istante: string): number {
  return DateTime.fromISO(istante, { setZone: true }).toMillis()
}

/** Transizioni in ordine cronologico (copia, l'originale non si tocca) */
function inOrdine(transizioni: readonly TransizioneFlusso[]): TransizioneFlusso[] {
  return [...transizioni].sort((a, b) => ms(a.avvenutaIl) - ms(b.avvenutaIl))
}

/**
 * Work Item Age = giorni di calendario interi tra `statoDal` e `adesso`,
 * calcolati sulle date in Europe/Rome (stesso giorno = 0).
 * Si mostra solo per gli elaborati non in stato finale.
 */
export function workItemAge(statoDal: string, adesso: string): number {
  return differenzaGiorni(dataRoma(statoDal), dataRoma(adesso))
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
  const storia = inOrdine(transizioni)
  // Uscita dallo stato iniziale; se l'elaborato è nato già avviato (nessuna
  // uscita da 0), vale la sua creazione in uno stato successivo.
  const uscita =
    storia.find((t) => t.daStatoOrdine === 0 && t.aStatoOrdine !== 0) ??
    storia.find((t) => t.daStatoOrdine === null && t.aStatoOrdine > 0)
  if (!uscita) return null
  const inizio = ms(uscita.avvenutaIl)
  const arrivo = storia.find((t) => t.aStatoOrdine === ordineFinale && ms(t.avvenutaIl) >= inizio)
  if (!arrivo) return null
  return differenzaGiorni(dataRoma(uscita.avvenutaIl), dataRoma(arrivo.avvenutaIl))
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
  const emessi = new Set<number>()
  for (const t of transizioni) {
    if (t.aStatoOrdine !== ordineFinale) continue
    if (lunediDellaSettimana(t.avvenutaIl) === settimana) emessi.add(t.elaboratoId)
  }
  return emessi.size
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
  const colonne = [...new Set(Object.values(colonnaDiOrdine))]
  const storia = inOrdine(transizioni).map((t) => ({ ...t, giorno: dataRoma(t.avvenutaIl) }))
  const statoAttuale = new Map<number, number>()
  const punti: PuntoCfd[] = []
  const giorni = differenzaGiorni(dal, al)
  const inizio = DateTime.fromISO(dal, { zone: 'UTC' })
  let k = 0
  for (let g = 0; g <= giorni; g++) {
    const giorno = inizio.plus({ days: g }).toISODate()!
    // Le transizioni avvenute entro la fine del giorno (ora di Roma)
    while (k < storia.length && storia[k].giorno <= giorno) {
      statoAttuale.set(storia[k].elaboratoId, storia[k].aStatoOrdine)
      k++
    }
    const perColonna: Record<string, number> = Object.fromEntries(colonne.map((c) => [c, 0]))
    for (const ordine of statoAttuale.values()) {
      const colonna = colonnaDiOrdine[ordine]
      if (colonna !== undefined) perColonna[colonna] = (perColonna[colonna] ?? 0) + 1
    }
    punti.push({ giorno, perColonna })
  }
  return punti
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
  if (aOrdine === daOrdine) return "L'elaborato è già in questo stato."
  if (aOrdine > daOrdine + 1) {
    return 'Si avanza di uno stato alla volta: completa prima lo stato successivo.'
  }
  if (aOrdine < daOrdine && (motivo === null || motivo.trim() === '')) {
    return 'Per tornare a uno stato precedente serve un motivo (per esempio una rilavorazione).'
  }
  return null
}

/**
 * Sforamento WIP: true se, aggiungendo un elaborato alla colonna, il numero
 * supera il limite (limite null = nessun limite). Lo sforamento va confermato
 * dall'utente e registrato nell'audit.
 */
export function sforaWip(elaboratiInColonna: number, limite: number | null): boolean {
  if (limite === null) return false
  return elaboratiInColonna + 1 > limite
}
