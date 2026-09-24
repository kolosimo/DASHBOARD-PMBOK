import { BaseSchema } from '@adonisjs/lucid/schema'
import { checkLunedi, checkValori, colonneModificabili } from '#database/colonne_comuni'

/**
 * Last Planner System: lookahead, vincoli (molti-a-molti con le attività),
 * piani settimanali, impegni e snapshot settimanali.
 * Le settimane sono DATE del lunedì (Europe/Rome).
 */
export default class extends BaseSchema {
  async up() {
    const now = () => this.now()

    this.schema.createTable('attivita_lookahead', (t) => {
      t.increments('id')
      t.integer('commessa_id').notNullable().references('id').inTable('commesse').onDelete('CASCADE')
      t.string('codice', 20).notNullable()
      t.string('titolo', 300).notNullable()
      t.string('tipo', 20).notNullable().defaultTo('attivita')
      t.integer('elaborato_id').nullable().references('id').inTable('elaborati').onDelete('SET NULL')
      t.integer('milestone_id').nullable().references('id').inTable('milestone').onDelete('SET NULL')
      t.integer('responsabile_id').nullable().references('id').inTable('utenti').onDelete('SET NULL')
      t.date('settimana_inizio').notNullable()
      t.date('settimana_fine').notNullable()
      colonneModificabili(t, now)
      t.unique(['commessa_id', 'codice'])
      t.index(['commessa_id', 'settimana_inizio'])
    })
    this.schema.raw(checkValori('attivita_lookahead', 'tipo', ['attivita', 'milestone']))
    this.schema.raw(checkLunedi('attivita_lookahead', 'settimana_inizio'))
    this.schema.raw(checkLunedi('attivita_lookahead', 'settimana_fine'))
    this.schema.raw(
      'ALTER TABLE attivita_lookahead ADD CONSTRAINT attivita_lookahead_intervallo CHECK (settimana_fine >= settimana_inizio)'
    )

    this.schema.createTable('vincoli', (t) => {
      t.increments('id')
      t.integer('commessa_id').notNullable().references('id').inTable('commesse').onDelete('CASCADE')
      t.string('codice', 20).notNullable()
      t.string('descrizione', 500).notNullable()
      t.string('categoria', 30).notNullable()
      t.string('stato', 20).notNullable().defaultTo('da_analizzare')
      t.integer('responsabile_id').nullable().references('id').inTable('utenti').onDelete('SET NULL')
      t.string('responsabile_esterno', 200).nullable()
      t.date('data_necessaria').nullable()
      t.date('identificato_il').notNullable()
      t.timestamp('rimosso_il', { useTz: true }).nullable()
      t.timestamp('annullato_il', { useTz: true }).nullable()
      t.text('note').nullable()
      colonneModificabili(t, now)
      t.unique(['commessa_id', 'codice'])
      t.index(['commessa_id', 'stato'])
    })
    this.schema.raw(
      checkValori('vincoli', 'stato', ['da_analizzare', 'aperto', 'rimosso', 'annullato'])
    )
    this.schema.raw(
      checkValori('vincoli', 'categoria', [
        'input_da_altri',
        'approvazione',
        'risorsa',
        'criteri',
        'informazioni',
        'altro',
      ])
    )

    // Collegamento molti-a-molti: si inseriscono e si cancellano righe, niente version.
    this.schema.createTable('vincoli_attivita', (t) => {
      t.integer('vincolo_id').notNullable().references('id').inTable('vincoli').onDelete('CASCADE')
      t.integer('attivita_id')
        .notNullable()
        .references('id')
        .inTable('attivita_lookahead')
        .onDelete('CASCADE')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(now())
      t.primary(['vincolo_id', 'attivita_id'])
      t.index(['attivita_id'])
    })

    this.schema.createTable('piani_settimanali', (t) => {
      t.increments('id')
      t.integer('commessa_id').notNullable().references('id').inTable('commesse').onDelete('CASCADE')
      t.date('settimana').notNullable()
      t.string('stato', 20).notNullable().defaultTo('bozza')
      t.timestamp('promesso_il', { useTz: true }).nullable()
      t.timestamp('chiuso_il', { useTz: true }).nullable()
      colonneModificabili(t, now)
      t.unique(['commessa_id', 'settimana'])
    })
    this.schema.raw(checkValori('piani_settimanali', 'stato', ['bozza', 'promesso', 'chiuso']))
    this.schema.raw(checkLunedi('piani_settimanali', 'settimana'))

    this.schema.createTable('impegni', (t) => {
      t.increments('id')
      t.integer('piano_id')
        .notNullable()
        .references('id')
        .inTable('piani_settimanali')
        .onDelete('CASCADE')
      t.integer('attivita_id')
        .nullable()
        .references('id')
        .inTable('attivita_lookahead')
        .onDelete('SET NULL')
      t.integer('elaborato_id').nullable().references('id').inTable('elaborati').onDelete('SET NULL')
      t.string('descrizione', 500).notNullable()
      t.integer('last_planner_id').nullable().references('id').inTable('utenti').onDelete('SET NULL')
      // null = non ancora segnato; true = fatto; false = non fatto (serve la causa)
      t.boolean('fatto').nullable()
      t.integer('causa_id')
        .nullable()
        .references('id')
        .inTable('cause_non_completamento')
        .onDelete('RESTRICT')
      // Analisi "5 perché": elenco ordinato di risposte
      t.jsonb('cinque_perche').nullable()
      t.boolean('aggiunto_dopo_promessa').notNullable().defaultTo(false)
      t.integer('ordine').notNullable().defaultTo(0)
      colonneModificabili(t, now)
      t.index(['piano_id'])
    })

    // Fotografia settimanale del lookahead (base per TMR/TA a w−2)
    this.schema.createTable('snapshot_lookahead', (t) => {
      t.increments('id')
      t.integer('commessa_id').notNullable().references('id').inTable('commesse').onDelete('CASCADE')
      t.date('settimana').notNullable()
      t.integer('attivita_id')
        .nullable()
        .references('id')
        .inTable('attivita_lookahead')
        .onDelete('SET NULL')
      t.string('codice_attivita', 20).notNullable()
      t.string('titolo_attivita', 300).notNullable()
      t.date('settimana_inizio').notNullable()
      t.date('settimana_fine').notNullable()
      t.integer('vincoli_aperti').notNullable().defaultTo(0)
      t.boolean('pronta').notNullable()
      t.timestamp('creato_il', { useTz: true }).notNullable().defaultTo(now())
      t.unique(['commessa_id', 'settimana', 'codice_attivita'])
    })
    this.schema.raw(checkLunedi('snapshot_lookahead', 'settimana'))

    // Indicatori LPS congelati a fine settimana
    this.schema.createTable('snapshot_lps', (t) => {
      t.increments('id')
      t.integer('commessa_id').notNullable().references('id').inTable('commesse').onDelete('CASCADE')
      t.date('settimana').notNullable()
      t.integer('impegni_promessi').notNullable()
      t.integer('impegni_fatti').notNullable()
      t.decimal('ppc', 7, 4).nullable()
      t.integer('vincoli_da_rimuovere').notNullable().defaultTo(0)
      t.integer('vincoli_rimossi').notNullable().defaultTo(0)
      t.decimal('pcr', 7, 4).nullable()
      t.decimal('tmr', 7, 4).nullable()
      t.decimal('ta', 7, 4).nullable()
      t.timestamp('creato_il', { useTz: true }).notNullable().defaultTo(now())
      t.unique(['commessa_id', 'settimana'])
    })
    this.schema.raw(checkLunedi('snapshot_lps', 'settimana'))
  }

  async down() {
    this.schema.dropTable('snapshot_lps')
    this.schema.dropTable('snapshot_lookahead')
    this.schema.dropTable('impegni')
    this.schema.dropTable('piani_settimanali')
    this.schema.dropTable('vincoli_attivita')
    this.schema.dropTable('vincoli')
    this.schema.dropTable('attivita_lookahead')
  }
}
