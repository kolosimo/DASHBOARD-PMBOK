import { BaseSchema } from '@adonisjs/lucid/schema'
import { checkValori, colonneModificabili } from '#database/colonne_comuni'

/**
 * Anagrafiche: utenti, commesse, membri di commessa, milestone.
 */
export default class extends BaseSchema {
  async up() {
    const now = () => this.now()

    this.schema.createTable('utenti', (t) => {
      t.increments('id')
      t.string('email', 254).notNullable().unique()
      t.string('nome', 200).notNullable()
      t.string('ruolo', 20).notNullable().defaultTo('progettista')
      t.boolean('attivo').notNullable().defaultTo(true)
      t.string('oidc_issuer', 500).nullable()
      t.string('oidc_sub', 255).nullable()
      t.timestamp('ultimo_accesso', { useTz: true }).nullable()
      colonneModificabili(t, now)
      t.unique(['oidc_issuer', 'oidc_sub'])
    })
    this.schema.raw(checkValori('utenti', 'ruolo', ['admin', 'direzione', 'pm', 'progettista']))
    this.schema.raw(
      'ALTER TABLE utenti ADD CONSTRAINT utenti_email_minuscola CHECK (email = lower(email))'
    )

    this.schema.createTable('commesse', (t) => {
      t.increments('id')
      t.string('codice', 30).notNullable().unique()
      t.string('nome', 300).notNullable()
      t.string('cliente', 300).nullable()
      t.string('stato', 20).notNullable().defaultTo('attiva')
      t.integer('pm_id').nullable().references('id').inTable('utenti').onDelete('SET NULL')
      t.date('data_inizio').nullable()
      t.date('data_fine_prevista').nullable()
      t.text('note').nullable()
      colonneModificabili(t, now)
      t.index(['pm_id'])
    })
    this.schema.raw(checkValori('commesse', 'stato', ['attiva', 'sospesa', 'chiusa']))

    this.schema.createTable('membri_commessa', (t) => {
      t.increments('id')
      t.integer('commessa_id')
        .notNullable()
        .references('id')
        .inTable('commesse')
        .onDelete('CASCADE')
      t.integer('utente_id').notNullable().references('id').inTable('utenti').onDelete('CASCADE')
      t.string('ruolo_commessa', 20).notNullable().defaultTo('progettista')
      colonneModificabili(t, now)
      t.unique(['commessa_id', 'utente_id'])
      t.index(['utente_id'])
    })
    this.schema.raw(
      checkValori('membri_commessa', 'ruolo_commessa', [
        'pm',
        'progettista',
        'verificatore',
        'osservatore',
      ])
    )

    this.schema.createTable('milestone', (t) => {
      t.increments('id')
      t.integer('commessa_id')
        .notNullable()
        .references('id')
        .inTable('commesse')
        .onDelete('CASCADE')
      t.string('titolo', 300).notNullable()
      t.date('data_prevista').notNullable()
      t.date('data_effettiva').nullable()
      t.boolean('contrattuale').notNullable().defaultTo(true)
      t.integer('ordine').notNullable().defaultTo(0)
      colonneModificabili(t, now)
      t.index(['commessa_id', 'data_prevista'])
    })
  }

  async down() {
    this.schema.dropTable('milestone')
    this.schema.dropTable('membri_commessa')
    this.schema.dropTable('commesse')
    this.schema.dropTable('utenti')
  }
}
