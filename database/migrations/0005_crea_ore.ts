import { BaseSchema } from '@adonisjs/lucid/schema'
import { colonneModificabili } from '#database/colonne_comuni'

/**
 * Registrazioni ore: una riga per utente, elaborato e giorno, in minuti interi.
 * Ognuno registra solo per sé (controllato dal Bouncer).
 */
export default class extends BaseSchema {
  async up() {
    const now = () => this.now()

    this.schema.createTable('registrazioni_ore', (t) => {
      t.increments('id')
      t.integer('utente_id').notNullable().references('id').inTable('utenti').onDelete('RESTRICT')
      t.integer('elaborato_id').notNullable().references('id').inTable('elaborati').onDelete('RESTRICT')
      t.date('data').notNullable()
      t.integer('minuti').notNullable()
      t.string('nota', 500).nullable()
      colonneModificabili(t, now)
      t.unique(['utente_id', 'elaborato_id', 'data'])
      t.index(['elaborato_id', 'data'])
    })
    this.schema.raw(
      'ALTER TABLE registrazioni_ore ADD CONSTRAINT registrazioni_ore_minuti CHECK (minuti > 0 AND minuti <= 1440)'
    )
  }

  async down() {
    this.schema.dropTable('registrazioni_ore')
  }
}
