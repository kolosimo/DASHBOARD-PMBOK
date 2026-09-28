/**
 * Modelli locali del modulo anagrafiche.
 *
 * `ElaboratoAnagrafica` estende il modello condiviso `Elaborato` con la colonna
 * `milestone_id` (migrazione additiva del modulo). Serve finché l'orchestratore
 * non aggiunge `milestoneId` al modello condiviso: vedi docs/sviluppo/handoff/A1.md.
 */
import { column } from '@adonisjs/lucid/orm'
import Elaborato from '#models/elaborato'

export default class ElaboratoAnagrafica extends Elaborato {
  static table = 'elaborati'

  @column()
  declare milestoneId: number | null
}
