import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Modulo EVM (A5), migrazione additiva: rettifica tardiva degli snapshot.
 *
 * Uno snapshot non si riscrive mai. Se dopo lo scatto le ore della settimana
 * cambiano (rettifica oltre la scadenza), il job segna lo snapshot come
 * `rettificato` e annota l'AC ricalcolato, lasciando intatti i valori storici.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('snapshot_evm', (t) => {
      t.boolean('rettificato').notNullable().defaultTo(false)
      t.integer('ac_rettificato_minuti').nullable()
      t.timestamp('rettificato_il', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable('snapshot_evm', (t) => {
      t.dropColumn('rettificato_il')
      t.dropColumn('ac_rettificato_minuti')
      t.dropColumn('rettificato')
    })
  }
}
