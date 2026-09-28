import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Anagrafiche (A1), migrazione additiva: milestone di riferimento
 * dell'elaborato (facoltativa). Se la milestone viene eliminata,
 * l'elaborato resta senza milestone.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('elaborati', (t) => {
      t.integer('milestone_id')
        .nullable()
        .references('id')
        .inTable('milestone')
        .onDelete('SET NULL')
      t.index(['milestone_id'])
    })
  }

  async down() {
    this.schema.alterTable('elaborati', (t) => {
      t.dropIndex(['milestone_id'])
      t.dropColumn('milestone_id')
    })
  }
}
