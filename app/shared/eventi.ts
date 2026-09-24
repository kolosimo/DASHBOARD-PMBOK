/**
 * Eventi in tempo reale (SSE con @adonisjs/transmit).
 *
 * Ogni commessa ha un canale "commesse/<id>". Le pagine iscritte ricevono
 * { tipo, commessaId, ... } e ricaricano i frammenti interessati via HTMX.
 * Se la connessione SSE cade, il client ripiega su un polling ogni 30 s.
 *
 * Regola: chiamare `pubblica` DOPO il commit della transazione.
 */
import transmit from '@adonisjs/transmit/services/main'
import type { TipoEvento } from '#domain/types'

type ValoreEvento = string | number | boolean | null

export interface Evento {
  tipo: TipoEvento
  commessaId: number
  il: string
  [chiave: string]: ValoreEvento
}

type Ascoltatore = (canale: string, evento: Evento) => void
const ascoltatori = new Set<Ascoltatore>()

export function canaleCommessa(commessaId: number) {
  return `commesse/${commessaId}`
}

/** Pubblica un evento sul canale della commessa */
export function pubblica(
  commessaId: number,
  tipo: TipoEvento,
  dati: Record<string, ValoreEvento> = {}
): Evento {
  const evento: Evento = { ...dati, tipo, commessaId, il: new Date().toISOString() }
  const canale = canaleCommessa(commessaId)
  transmit.broadcast(canale, evento)
  for (const a of ascoltatori) a(canale, evento)
  return evento
}

/** Per i test: ascolta gli eventi pubblicati in questo processo */
export function ascoltaEventi(ascoltatore: Ascoltatore): () => void {
  ascoltatori.add(ascoltatore)
  return () => ascoltatori.delete(ascoltatore)
}
