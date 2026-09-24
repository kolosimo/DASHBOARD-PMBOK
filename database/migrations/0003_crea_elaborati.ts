import { BaseSchema } from '@adonisjs/lucid/schema'
import { checkValori, colonneModificabili } from '#database/colonne_comuni'

/**
 * Elaborati e storico delle transizioni di stato (flusso).
 * Budget in minuti interi. `stato_dal` serve al Work Item Age.
 */
export default class extends BaseSchema {
  async up() {
    const now = () => this.now()

    this.schema.createTable('elaborati', (t) => {
      t.increments('id')
      t.integer('commessa_id').notNullable().references('id').inTable('commesse').onDelete('CASCADE')
      t.string('codice', 40).notNullable()
      t.string('titolo', 300).notNullable()
      t.integer('disciplina_id')
        .notNullable()
        .references('id')
        .inTable('discipline')
        .onDelete('RESTRICT')
      t.integer('budget_minuti').notNullable().defaultTo(0)
      t.string('classe_servizio', 20).notNullable().defaultTo('standard')
      t.date('data_fissa').nullable()
      t.integer('responsabile_id').nullable().references('id').inTable('utenti').onDelete('SET NULL')
      t.integer('stato_id')
        .notNullable()
        .references('id')
        .inTable('stati_elaborato')
        .onDelete('RESTRICT')
      t.timestamp('stato_dal', { useTz: true }).notNullable().defaultTo(now())
      colonneModificabili(t, now)
      t.unique(['commessa_id', 'codice'])
      t.index(['commessa_id', 'stato_id'])
      t.index(['responsabile_id'])
    })
    this.schema.raw(
      'ALTER TABLE elaborati ADD CONSTRAINT elaborati_budget_non_negativo CHECK (budget_minuti >= 0)'
    )
    this.schema.raw(
      checkValori('elaborati', 'classe_servizio', ['standard', 'data_fissa', 'urgente', 'intangibile'])
    )

    // Storico: solo inserimenti, niente version.
    this.schema.createTable('transizioni_elaborato', (t) => {
      t.increments('id')
      t.integer('elaborato_id').notNullable().references('id').inTable('elaborati').onDelete('CASCADE')
      t.integer('da_stato_id').nullable().references('id').inTable('stati_elaborato')
      t.integer('a_stato_id').notNullable().references('id').inTable('stati_elaborato')
      t.integer('utente_id').nullable().references('id').inTable('utenti').onDelete('SET NULL')
      t.text('motivo').nullable()
      t.boolean('wip_sforato').notNullable().defaultTo(false)
      t.timestamp('avvenuta_il', { useTz: true }).notNullable().defaultTo(now())
      t.index(['elaborato_id', 'avvenuta_il'])
    })
  }

  async down() {
    this.schema.dropTable('transizioni_elaborato')
    this.schema.dropTable('elaborati')
  }
}
