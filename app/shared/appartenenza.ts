/**
 * Appartenenza degli utenti alle commesse (usata dalle abilità Bouncer).
 */
import db from '@adonisjs/lucid/services/db'
import type Utente from '#models/utente'
import type Commessa from '#models/commessa'
import type { RuoloCommessa } from '#domain/types'

/** Ruolo dell'utente nella commessa, oppure null se non è membro */
export async function ruoloNellaCommessa(
  utenteId: number,
  commessaId: number
): Promise<RuoloCommessa | null> {
  const riga = await db
    .from('membri_commessa')
    .where('commessa_id', commessaId)
    .where('utente_id', utenteId)
    .select('ruolo_commessa')
    .first()
  return (riga?.ruolo_commessa as RuoloCommessa | undefined) ?? null
}

/** true se l'utente è il PM della commessa (campo pm_id o membro con ruolo pm) */
export async function ePmDellaCommessa(utente: Utente, commessa: Commessa): Promise<boolean> {
  if (commessa.pmId === utente.id) return true
  return (await ruoloNellaCommessa(utente.id, commessa.id)) === 'pm'
}
