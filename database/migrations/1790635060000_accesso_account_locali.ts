import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Accesso (B6), migrazione additiva: account locali per il pilota.
 * - password_hash: hash scrypt (formato PHC dell'hasher di AdonisJS), null
 *   per chi entra solo con Microsoft 365;
 * - deve_cambiare_password: true dopo la creazione o il reset da admin;
 * - tentativi_falliti e bloccato_fino: blocco dopo troppi errori.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('utenti', (t) => {
      t.string('password_hash', 255).nullable()
      t.boolean('deve_cambiare_password').notNullable().defaultTo(false)
      t.integer('tentativi_falliti').notNullable().defaultTo(0)
      t.timestamp('bloccato_fino', { useTz: true }).nullable()
    })
    this.schema.raw(
      'ALTER TABLE utenti ADD CONSTRAINT utenti_tentativi_non_negativi CHECK (tentativi_falliti >= 0)'
    )
  }

  async down() {
    this.schema.raw('ALTER TABLE utenti DROP CONSTRAINT IF EXISTS utenti_tentativi_non_negativi')
    this.schema.alterTable('utenti', (t) => {
      t.dropColumn('bloccato_fino')
      t.dropColumn('tentativi_falliti')
      t.dropColumn('deve_cambiare_password')
      t.dropColumn('password_hash')
    })
  }
}
