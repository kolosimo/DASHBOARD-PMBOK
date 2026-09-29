import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { seminaConfigurazioneProduzione } from '#database/seeders/produzione/configurazione_seeder'
import DbInizializzaProduzione from '../../../commands/db_inizializza_produzione.js'
import { conTransazione } from '#tests/helpers/db'

/**
 * Seeder di produzione: gira sul DB reale del pilota a ogni installazione e a
 * ogni aggiornamento (aggiorna.ps1). Deve essere idempotente, non toccare i
 * valori cambiati dall'admin e rispettare gli `ordine` univoci.
 *
 * Il DB di test contiene i dati di esempio: ogni test li porta prima alla
 * configurazione completa (prima semina) e poi verifica il comportamento.
 */
test.group('Deploy · seeder di configurazione di produzione', (group) => {
  conTransazione(group)

  test('seconda semina su configurazione presente: 0 aggiunte e nessuna differenza', async ({
    assert,
  }) => {
    await db.transaction((trx) => seminaConfigurazioneProduzione(trx))
    const esito = await db.transaction((trx) => seminaConfigurazioneProduzione(trx))

    assert.deepEqual(
      esito.tabelle.map((t) => t.tabella),
      ['discipline', 'colonne_kanban', 'stati_elaborato', 'cause_non_completamento', 'impostazioni']
    )
    for (const t of esito.tabelle) {
      assert.equal(t.aggiunte, 0, `aggiunte in ${t.tabella}`)
      assert.isAbove(t.presenti, 0, `presenti in ${t.tabella}`)
    }
  })

  test('causa cancellata reinserita; peso EV e WIP cambiati dall’admin restano e sono segnalati', async ({
    assert,
  }) => {
    await db.transaction((trx) => seminaConfigurazioneProduzione(trx))

    // La causa "altro" si cancella; i suoi impegni (FK RESTRICT) passano a un'altra causa
    const codiceCausa = 'altro'
    const altro = await db
      .from('cause_non_completamento')
      .where('codice', codiceCausa)
      .firstOrFail()
    const sostituta = await db
      .from('cause_non_completamento')
      .where('codice', 'input_mancante')
      .firstOrFail()
    await db.from('impegni').where('causa_id', altro.id).update({ causa_id: sostituta.id })
    await db.from('cause_non_completamento').where('id', altro.id).delete()

    await db.from('stati_elaborato').where('codice', 'calcoli').update({ peso_ev_percento: 45 })
    await db.from('colonne_kanban').where('codice', 'in_corso').update({ limite_wip_default: 6 })

    const esito = await db.transaction((trx) => seminaConfigurazioneProduzione(trx))

    const cause = esito.tabelle.find((t) => t.tabella === 'cause_non_completamento')!
    assert.equal(cause.aggiunte, 1)
    const reinserita = await db.from('cause_non_completamento').where('codice', codiceCausa).first()
    assert.exists(reinserita)
    assert.isTrue(reinserita.attiva)

    for (const t of esito.tabelle.filter((x) => x.tabella !== 'cause_non_completamento')) {
      assert.equal(t.aggiunte, 0, `aggiunte in ${t.tabella}`)
    }

    const calcoli = await db.from('stati_elaborato').where('codice', 'calcoli').firstOrFail()
    assert.equal(calcoli.peso_ev_percento, 45)
    const inCorso = await db.from('colonne_kanban').where('codice', 'in_corso').firstOrFail()
    assert.equal(inCorso.limite_wip_default, 6)

    assert.isTrue(
      esito.differenze.some((d) => d.includes('"calcoli"') && d.includes('45%')),
      esito.differenze.join('\n')
    )
    assert.isTrue(
      esito.differenze.some((d) => d.includes('"in_corso"') && d.includes('WIP di default 6')),
      esito.differenze.join('\n')
    )
  })

  test('stato con ordine già occupato: non inserito e segnalato', async ({ assert }) => {
    await db.transaction((trx) => seminaConfigurazioneProduzione(trx))

    // L'admin ha rinominato il codice dello stato di ordine 4: il codice
    // confermato "verificato" manca, ma l'ordine 4 è occupato.
    await db
      .from('stati_elaborato')
      .where('codice', 'verificato')
      .update({ codice: 'verificato_interno' })
    const prima = await db.from('stati_elaborato').count('* as n').firstOrFail()

    const esito = await db.transaction((trx) => seminaConfigurazioneProduzione(trx))

    const stati = esito.tabelle.find((t) => t.tabella === 'stati_elaborato')!
    assert.equal(stati.aggiunte, 0)
    const dopo = await db.from('stati_elaborato').count('* as n').firstOrFail()
    assert.equal(Number(dopo.n), Number(prima.n))
    assert.notExists(await db.from('stati_elaborato').where('codice', 'verificato').first())
    const ordine4 = await db.from('stati_elaborato').where('ordine', 4).firstOrFail()
    assert.equal(ordine4.codice, 'verificato_interno')
    assert.isTrue(
      esito.differenze.some(
        (d) => d.includes('"verificato"') && d.includes("l'ordine 4 è già usato")
      ),
      esito.differenze.join('\n')
    )
  })
})

/**
 * Il comando usa la connessione normale (migrazioni comprese), quindi non
 * gira in una transazione globale: si verifica che le tabelle non cambino.
 */
test.group('Deploy · node ace db:inizializza-produzione', () => {
  const TABELLE = [
    'utenti',
    'commesse',
    'discipline',
    'colonne_kanban',
    'stati_elaborato',
    'cause_non_completamento',
    'impostazioni',
  ]

  async function conteggi() {
    const righe: Record<string, number> = {}
    for (const t of TABELLE) {
      const r = await db.from(t).count('* as n').firstOrFail()
      righe[t] = Number(r.n)
    }
    return righe
  }

  test('rifiuta un DB con i dati di esempio: exitCode 1 e tabelle invariate', async ({
    assert,
  }) => {
    const esempio = await db
      .from('utenti')
      .whereILike('email', '%@climosfera.example')
      .count('* as n')
      .firstOrFail()
    assert.isAbove(Number(esempio.n), 0, 'il DB di test deve avere i dati di esempio')

    // L'admin ha rinominato la causa "altro": se il comando seminasse, la
    // reinserirebbe e il numero di cause cambierebbe.
    await db.from('cause_non_completamento').where('codice', 'altro').update({ codice: 'altro_x' })

    try {
      const prima = await conteggi()

      const ace = await app.container.make('ace')
      ace.ui.switchMode('raw')
      const comando = await ace.create(DbInizializzaProduzione, [])
      await comando.exec()

      assert.equal(comando.exitCode, 1)
      const log = comando.logger
        .getLogs()
        .map((l) => l.message)
        .join('\n')
      assert.include(log, 'utenti di esempio')
      assert.deepEqual(await conteggi(), prima)
      assert.notExists(
        await db.from('cause_non_completamento').where('codice', 'altro').first(),
        'la configurazione non deve essere stata seminata'
      )
    } finally {
      await db
        .from('cause_non_completamento')
        .where('codice', 'altro_x')
        .update({ codice: 'altro' })
    }
  }).timeout(30_000)
})
