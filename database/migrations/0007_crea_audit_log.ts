import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Registro di audit: solo inserimenti. Un trigger rifiuta UPDATE e DELETE
 * (TRUNCATE resta possibile per i test e per la manutenzione).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('audit_log', (t) => {
      t.bigIncrements('id')
      t.integer('utente_id').nullable().references('id').inTable('utenti').onDelete('SET NULL')
      t.integer('commessa_id').nullable().references('id').inTable('commesse').onDelete('SET NULL')
      t.string('azione', 100).notNullable()
      t.string('entita', 100).notNullable()
      t.string('entita_id', 100).nullable()
      t.jsonb('dati_prima').nullable()
      t.jsonb('dati_dopo').nullable()
      t.string('ip', 64).nullable()
      t.timestamp('creato_il', { useTz: true }).notNullable().defaultTo(this.now())
      t.index(['commessa_id', 'creato_il'])
      t.index(['entita', 'entita_id'])
    })
    this.schema.raw(`
      CREATE FUNCTION audit_log_solo_inserimenti() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log accetta solo inserimenti';
      END;
      $$ LANGUAGE plpgsql
    `)
    this.schema.raw(`
      CREATE TRIGGER audit_log_blocca_modifiche
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_solo_inserimenti()
    `)
  }

  async down() {
    this.schema.raw('DROP TRIGGER IF EXISTS audit_log_blocca_modifiche ON audit_log')
    this.schema.dropTable('audit_log')
    this.schema.raw('DROP FUNCTION IF EXISTS audit_log_solo_inserimenti()')
  }
}
