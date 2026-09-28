import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Modulo LPS (agente A2), migrazione additiva: disciplina facoltativa
 * dell'attività del lookahead. Se è vuota si usa quella dell'elaborato
 * collegato (vedi app/modules/lps/queries.ts).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('attivita_lookahead', (t) => {
      t.integer('disciplina_id')
        .nullable()
        .references('id')
        .inTable('discipline')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('attivita_lookahead', (t) => {
      t.dropColumn('disciplina_id')
    })
  }
}
