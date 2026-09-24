import { BaseSchema } from '@adonisjs/lucid/schema'
import { checkLunedi, checkValori, colonneModificabili } from '#database/colonne_comuni'

/**
 * EVM in ore: baseline con pesi congelati, date pianificate per stato,
 * PV settimanale congelato e snapshot settimanali (la curva S storica si
 * legge dagli snapshot e non si ricalcola).
 */
export default class extends BaseSchema {
  async up() {
    const now = () => this.now()

    this.schema.createTable('baseline', (t) => {
      t.increments('id')
      t.integer('commessa_id')
        .notNullable()
        .references('id')
        .inTable('commesse')
        .onDelete('CASCADE')
      t.integer('numero').notNullable()
      t.string('stato', 20).notNullable().defaultTo('bozza')
      // { "<codice stato>": peso_percento } congelati all'approvazione
      t.jsonb('pesi_stati').notNullable()
      t.integer('bac_minuti').notNullable().defaultTo(0)
      t.integer('approvata_da_id')
        .nullable()
        .references('id')
        .inTable('utenti')
        .onDelete('SET NULL')
      t.timestamp('approvata_il', { useTz: true }).nullable()
      t.text('note').nullable()
      colonneModificabili(t, now)
      t.unique(['commessa_id', 'numero'])
    })
    this.schema.raw(checkValori('baseline', 'stato', ['bozza', 'approvata', 'superata']))
    // Al massimo una baseline approvata per commessa
    this.schema.raw(
      "CREATE UNIQUE INDEX baseline_una_approvata ON baseline (commessa_id) WHERE stato = 'approvata'"
    )

    this.schema.createTable('baseline_date_stato', (t) => {
      t.increments('id')
      t.integer('baseline_id')
        .notNullable()
        .references('id')
        .inTable('baseline')
        .onDelete('CASCADE')
      t.integer('elaborato_id')
        .notNullable()
        .references('id')
        .inTable('elaborati')
        .onDelete('CASCADE')
      t.integer('stato_id').notNullable().references('id').inTable('stati_elaborato')
      // budget dell'elaborato congelato nella baseline
      t.integer('budget_minuti').notNullable()
      t.date('data_prevista').notNullable()
      colonneModificabili(t, now)
      t.unique(['baseline_id', 'elaborato_id', 'stato_id'])
    })

    this.schema.createTable('baseline_pv_settimana', (t) => {
      t.increments('id')
      t.integer('baseline_id')
        .notNullable()
        .references('id')
        .inTable('baseline')
        .onDelete('CASCADE')
      t.date('settimana').notNullable()
      // PV cumulato alla fine della settimana
      t.integer('pv_minuti').notNullable()
      colonneModificabili(t, now)
      t.unique(['baseline_id', 'settimana'])
    })
    this.schema.raw(checkLunedi('baseline_pv_settimana', 'settimana'))

    this.schema.createTable('snapshot_evm', (t) => {
      t.increments('id')
      t.integer('commessa_id')
        .notNullable()
        .references('id')
        .inTable('commesse')
        .onDelete('CASCADE')
      t.integer('baseline_id')
        .notNullable()
        .references('id')
        .inTable('baseline')
        .onDelete('CASCADE')
      t.date('settimana').notNullable()
      t.integer('bac_minuti').notNullable()
      t.integer('pv_minuti').notNullable()
      t.integer('ev_minuti').notNullable()
      t.integer('ac_minuti').notNullable()
      t.decimal('spi', 10, 4).nullable()
      t.decimal('cpi', 10, 4).nullable()
      t.integer('eac_minuti').nullable()
      t.integer('etc_minuti').nullable()
      t.integer('vac_minuti').nullable()
      t.timestamp('creato_il', { useTz: true }).notNullable().defaultTo(now())
      t.unique(['commessa_id', 'settimana'])
    })
    this.schema.raw(checkLunedi('snapshot_evm', 'settimana'))

    this.schema.createTable('snapshot_evm_elaborato', (t) => {
      t.increments('id')
      t.integer('snapshot_id')
        .notNullable()
        .references('id')
        .inTable('snapshot_evm')
        .onDelete('CASCADE')
      t.integer('elaborato_id')
        .notNullable()
        .references('id')
        .inTable('elaborati')
        .onDelete('CASCADE')
      t.integer('stato_id').notNullable().references('id').inTable('stati_elaborato')
      t.integer('budget_minuti').notNullable()
      t.integer('pv_minuti').notNullable()
      t.integer('ev_minuti').notNullable()
      t.integer('ac_minuti').notNullable()
      t.unique(['snapshot_id', 'elaborato_id'])
    })
  }

  async down() {
    this.schema.dropTable('snapshot_evm_elaborato')
    this.schema.dropTable('snapshot_evm')
    this.schema.dropTable('baseline_pv_settimana')
    this.schema.dropTable('baseline_date_stato')
    this.schema.dropTable('baseline')
  }
}
