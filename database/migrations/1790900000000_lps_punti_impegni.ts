import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Modulo LPS, migrazione additiva: punti Fibonacci facoltativi sugli impegni
 * del piano settimanale (1, 2, 3, 5, 8, 13; null = non stimato). Servono solo a
 * non promettere più di quanto il team riesce a fare: non si convertono in ore
 * e non entrano in EVM, curva S o portafoglio. Vedi app/domain/punti.ts.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('impegni', (t) => {
      t.smallint('punti').nullable()
    })
    this.schema.raw(
      'ALTER TABLE impegni ADD CONSTRAINT impegni_punti_fibonacci CHECK (punti IS NULL OR punti IN (1, 2, 3, 5, 8, 13))'
    )
  }

  async down() {
    this.schema.alterTable('impegni', (t) => {
      t.dropColumn('punti')
    })
  }
}
