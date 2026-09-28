/**
 * Estensione locale del modello AttivitaLookahead con la colonna
 * `disciplina_id` aggiunta dalla migrazione additiva del modulo LPS.
 *
 * Il modello condiviso (app/models/attivita_lookahead.ts) è dell'orchestratore:
 * la colonna è chiesta nell'handoff A2. Fino ad allora il modulo scrive le
 * attività con questa sottoclasse (stessa tabella, stesse relazioni).
 */
import { column } from '@adonisjs/lucid/orm'
import AttivitaLookahead from '#models/attivita_lookahead'

export class AttivitaLps extends AttivitaLookahead {
  static table = 'attivita_lookahead'

  @column()
  declare disciplinaId: number | null
}
