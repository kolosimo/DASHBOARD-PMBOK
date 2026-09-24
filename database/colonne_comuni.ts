import type { Knex } from 'knex'

/**
 * Colonne comuni per le migrazioni.
 *
 * - `version`: optimistic locking (409 se due persone modificano insieme).
 * - `created_at` / `updated_at`: timestamptz.
 */
export function colonneModificabili(table: Knex.CreateTableBuilder, now: () => Knex.Raw) {
  table.integer('version').notNullable().defaultTo(1)
  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(now())
  table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(now())
}

/** Vincolo CHECK: la colonna è una data di lunedì (settimana ISO). */
export function checkLunedi(tabella: string, colonna: string) {
  return `ALTER TABLE ${tabella} ADD CONSTRAINT ${tabella}_${colonna}_lunedi CHECK (extract(isodow from ${colonna}) = 1)`
}

/** Vincolo CHECK su un elenco chiuso di valori testuali. */
export function checkValori(tabella: string, colonna: string, valori: readonly string[]) {
  const elenco = valori.map((v) => `'${v}'`).join(', ')
  return `ALTER TABLE ${tabella} ADD CONSTRAINT ${tabella}_${colonna}_valori CHECK (${colonna} IN (${elenco}))`
}
