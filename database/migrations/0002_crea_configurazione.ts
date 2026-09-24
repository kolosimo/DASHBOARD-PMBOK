import { BaseSchema } from '@adonisjs/lucid/schema'
import { colonneModificabili } from '#database/colonne_comuni'

/**
 * Configurazione modificabile dall'admin (valori iniziali "di esempio"):
 * discipline, colonne Kanban, stati dell'elaborato con peso EV cumulativo,
 * limiti WIP per commessa, cause di non completamento, impostazioni.
 */
export default class extends BaseSchema {
  async up() {
    const now = () => this.now()

    this.schema.createTable('discipline', (t) => {
      t.increments('id')
      t.string('codice', 10).notNullable().unique()
      t.string('nome', 100).notNullable()
      t.integer('ordine').notNullable().defaultTo(0)
      t.boolean('attiva').notNullable().defaultTo(true)
      colonneModificabili(t, now)
    })

    this.schema.createTable('colonne_kanban', (t) => {
      t.increments('id')
      t.string('codice', 30).notNullable().unique()
      t.string('nome', 100).notNullable()
      t.integer('ordine').notNullable().unique()
      t.integer('limite_wip_default').nullable()
      colonneModificabili(t, now)
    })
    this.schema.raw(
      'ALTER TABLE colonne_kanban ADD CONSTRAINT colonne_kanban_wip_positivo CHECK (limite_wip_default IS NULL OR limite_wip_default > 0)'
    )

    this.schema.createTable('stati_elaborato', (t) => {
      t.increments('id')
      t.string('codice', 30).notNullable().unique()
      t.string('nome', 100).notNullable()
      t.integer('ordine').notNullable().unique()
      t.integer('peso_ev_percento').notNullable()
      t.integer('colonna_kanban_id')
        .notNullable()
        .references('id')
        .inTable('colonne_kanban')
        .onDelete('RESTRICT')
      t.boolean('finale').notNullable().defaultTo(false)
      colonneModificabili(t, now)
    })
    this.schema.raw(
      'ALTER TABLE stati_elaborato ADD CONSTRAINT stati_elaborato_peso_0_100 CHECK (peso_ev_percento BETWEEN 0 AND 100)'
    )

    this.schema.createTable('limiti_wip_commessa', (t) => {
      t.increments('id')
      t.integer('commessa_id').notNullable().references('id').inTable('commesse').onDelete('CASCADE')
      t.integer('colonna_kanban_id')
        .notNullable()
        .references('id')
        .inTable('colonne_kanban')
        .onDelete('CASCADE')
      t.integer('limite').notNullable()
      colonneModificabili(t, now)
      t.unique(['commessa_id', 'colonna_kanban_id'])
    })
    this.schema.raw(
      'ALTER TABLE limiti_wip_commessa ADD CONSTRAINT limiti_wip_commessa_positivo CHECK (limite > 0)'
    )

    this.schema.createTable('cause_non_completamento', (t) => {
      t.increments('id')
      t.string('codice', 40).notNullable().unique()
      t.string('nome', 200).notNullable()
      t.integer('ordine').notNullable().defaultTo(0)
      t.boolean('attiva').notNullable().defaultTo(true)
      colonneModificabili(t, now)
    })

    this.schema.createTable('impostazioni', (t) => {
      t.increments('id')
      t.string('chiave', 100).notNullable().unique()
      t.jsonb('valore').notNullable()
      t.string('descrizione', 500).notNullable()
      t.boolean('di_esempio').notNullable().defaultTo(true)
      t.integer('aggiornato_da_id').nullable().references('id').inTable('utenti').onDelete('SET NULL')
      colonneModificabili(t, now)
    })
  }

  async down() {
    this.schema.dropTable('impostazioni')
    this.schema.dropTable('cause_non_completamento')
    this.schema.dropTable('limiti_wip_commessa')
    this.schema.dropTable('stati_elaborato')
    this.schema.dropTable('colonne_kanban')
    this.schema.dropTable('discipline')
  }
}
