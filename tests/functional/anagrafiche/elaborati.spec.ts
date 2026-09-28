import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import AuditLog from '#models/audit_log'
import { analizzaImport } from '#modules/anagrafiche/import_elaborati'
import { numeroItaliano, oreInMinuti, dataIso } from '#modules/anagrafiche/validazione'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

async function entra(come: string, commessaId: number) {
  const b = new Browser()
  await b.loginSviluppo(come)
  const html = await (await b.vai(`/commesse/${commessaId}/anagrafica`)).text()
  return { b, csrf: Browser.csrfDa(html) }
}

async function disciplina(codice: string) {
  return db.from('discipline').where('codice', codice).firstOrFail()
}

async function elaborato(commessaId: number, codice: string) {
  return db
    .from('elaborati')
    .where('commessa_id', commessaId)
    .where('codice', codice)
    .first()
}

test.group('Anagrafiche · conversioni e analisi dell’import (senza DB)', () => {
  test('numeri all’italiana, ore in minuti, date', ({ assert }) => {
    assert.equal(numeroItaliano('12,5'), 12.5)
    assert.equal(numeroItaliano('1.234,5'), 1234.5)
    assert.equal(numeroItaliano('1.234'), 1234)
    assert.equal(numeroItaliano('12.5'), 12.5)
    assert.isNull(numeroItaliano('dodici'))
    assert.isNull(numeroItaliano(''))
    assert.equal(oreInMinuti('12,5'), 750)
    assert.equal(oreInMinuti('0,25'), 15)
    assert.equal(dataIso('05/10/2026'), '2026-10-05')
    assert.equal(dataIso('2026-10-05'), '2026-10-05')
    assert.isNull(dataIso('31/02/2026'))
  })

  test('righe errate segnalate in italiano, intestazione ignorata', ({ assert }) => {
    const discipline = [
      { id: 1, codice: 'MEC', nome: 'Impianti meccanici', attiva: true },
      { id: 2, codice: 'ELE', nome: 'Impianti elettrici', attiva: true },
      { id: 3, codice: 'VEC', nome: 'Vecchia', attiva: false },
    ]
    const testo = [
      'Codice\tTitolo\tDisciplina\tBudget ore',
      'N-01\tCentrale termica\tMEC\t24',
      'N-02;Quadri;impianti elettrici;16,5',
      'N-01;Doppione;MEC;4',
      'E-01;Esistente;MEC;4',
      'N-03;;XYZ;abc',
      'N-04;Vecchia disciplina;VEC;-2',
      'N-05;Solo tre colonne;MEC',
      '',
    ].join('\r\n')
    const esito = analizzaImport(testo, discipline, new Set(['E-01']))
    assert.lengthOf(esito.righe, 7)
    assert.deepEqual(
      esito.valide.map((r) => [r.codice, r.disciplinaId, r.budgetMinuti]),
      [
        ['N-01', 1, 1440],
        ['N-02', 2, 990],
      ]
    )
    const errori = Object.fromEntries(esito.errate.map((r) => [r.numero, r.errori.join(' | ')]))
    assert.include(errori[4], 'codice N-01 ripetuto (già alla riga 2)')
    assert.include(errori[5], 'il codice E-01 esiste già nella commessa')
    assert.include(errori[6], 'manca il titolo')
    assert.include(errori[6], 'disciplina "XYZ" sconosciuta')
    assert.include(errori[6], 'budget "abc" non è un numero di ore')
    assert.include(errori[7], 'non più attiva')
    assert.include(errori[7], 'il budget non può essere negativo')
    assert.include(errori[8], 'servono 4 colonne')
  })
})

test.group('Anagrafiche · elaborati', (group) => {
  conTransazione(group)

  test('crea un elaborato: budget in minuti, stato iniziale, audit ed evento', async ({
    assert,
  }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const mec = await disciplina('MEC')
    const ms = await db.from('milestone').where('commessa_id', c.id).orderBy('id').firstOrFail()
    const { b, csrf } = await entra('pm2', c.id)
    const form = await (await b.vai(`/commesse/${c.id}/elaborati/nuovo`)).text()
    assert.include(form, 'data-testid="form-elaborato"')

    const r = await b.post(`/commesse/${c.id}/elaborati`, {
      _csrf: csrf,
      codice: 'U-MEC-99',
      titolo: 'Sottocentrale – schema',
      disciplina_id: String(mec.id),
      budget_ore: '12,5',
      classe_servizio: 'standard',
      milestone_id: String(ms.id),
    })
    assert.equal(r.status, 302)
    const el = await elaborato(c.id, 'U-MEC-99')
    assert.equal(el.budget_minuti, 750)
    assert.equal(el.milestone_id, ms.id)
    const iniziale = await db.from('stati_elaborato').orderBy('ordine').firstOrFail()
    assert.equal(el.stato_id, iniziale.id)
    const voce = await AuditLog.query()
      .where('azione', 'elaborato.creato')
      .where('entita_id', String(el.id))
      .firstOrFail()
    assert.equal((voce.datiDopo as { budgetMinuti: number }).budgetMinuti, 750)

    const pagina = await (await b.vai(r.headers.get('location')!)).text()
    assert.include(pagina, 'Elaborato U-MEC-99 creato')
    assert.include(pagina, 'data-testid="elaborato-U-MEC-99"')
    assert.include(pagina, '12,5 h')
  })

  test('codice duplicato nella stessa commessa: 422', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const esistente = await db.from('elaborati').where('commessa_id', c.id).firstOrFail()
    const { b, csrf } = await entra('pm1', c.id)
    const r = await b.post(`/commesse/${c.id}/elaborati`, {
      _csrf: csrf,
      codice: esistente.codice,
      titolo: 'Doppione',
      disciplina_id: String(esistente.disciplina_id),
      budget_ore: '8',
    })
    assert.equal(r.status, 422)
    assert.include(
      await r.text(),
      `Codice: esiste già un elaborato ${esistente.codice} in questa commessa.`
    )
  })

  test('validazioni in italiano: obbligatori, ore, data fissa', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const { b, csrf } = await entra('pm1', c.id)
    const r = await b.post(`/commesse/${c.id}/elaborati`, {
      _csrf: csrf,
      codice: '',
      titolo: '',
      disciplina_id: '',
      budget_ore: 'tante',
      classe_servizio: 'data_fissa',
    })
    assert.equal(r.status, 422)
    const html = await r.text()
    assert.include(html, 'Codice: campo obbligatorio.')
    assert.include(html, 'Titolo: campo obbligatorio.')
    assert.include(html, 'Disciplina: scegli un valore.')
    assert.include(html, 'Budget ore: serve un numero di ore (per esempio 12,5).')
    assert.include(html, 'Data fissa: obbligatoria per la classe')
  })

  test('modifica: non tocca lo stato; 409 con la versione vecchia', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const el = await db.from('elaborati').where('commessa_id', c.id).orderBy('id').firstOrFail()
    const { b, csrf } = await entra('pm1', c.id)
    const campi = {
      _csrf: csrf,
      version: String(el.version),
      codice: el.codice,
      titolo: 'Titolo rivisto',
      disciplina_id: String(el.disciplina_id),
      budget_ore: '30',
      classe_servizio: 'urgente',
      stato_id: '999',
    }
    const r1 = await b.post(`/commesse/${c.id}/elaborati/${el.id}`, campi)
    assert.equal(r1.status, 302)
    const ora = await db.from('elaborati').where('id', el.id).firstOrFail()
    assert.equal(ora.titolo, 'Titolo rivisto')
    assert.equal(ora.budget_minuti, 1800)
    assert.equal(ora.classe_servizio, 'urgente')
    assert.equal(ora.stato_id, el.stato_id)
    assert.equal(ora.version, el.version + 1)
    await AuditLog.query().where('azione', 'elaborato.aggiornato').firstOrFail()

    const r2 = await b.post(`/commesse/${c.id}/elaborati/${el.id}`, { ...campi, titolo: 'Altro' })
    assert.equal(r2.status, 409)
    const html = await r2.text()
    assert.include(html, 'Qualcun altro ha modificato questo dato')
    assert.include(html, 'Titolo rivisto')
  })

  test('eliminazione: bloccata con ore registrate, possibile senza', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const { b, csrf } = await entra('pm2', c.id)
    const conOre = await db
      .from('elaborati as e')
      .where('e.commessa_id', c.id)
      .whereExists((q) => q.from('registrazioni_ore as o').whereRaw('o.elaborato_id = e.id'))
      .select('e.*')
      .first()
    if (conOre) {
      const r = await b.post(`/commesse/${c.id}/elaborati/${conOre.id}/elimina`, {
        _csrf: csrf,
        version: String(conOre.version),
        conferma: 'on',
      })
      assert.equal(r.status, 422)
      assert.include(await r.text(), 'ci sono ore registrate')
    }

    const mec = await disciplina('MEC')
    await b.post(`/commesse/${c.id}/elaborati`, {
      _csrf: csrf,
      codice: 'DA-TOGLIERE',
      titolo: 'Da togliere',
      disciplina_id: String(mec.id),
      budget_ore: '1',
    })
    const nuovo = await elaborato(c.id, 'DA-TOGLIERE')
    const senzaConferma = await b.post(`/commesse/${c.id}/elaborati/${nuovo.id}/elimina`, {
      _csrf: csrf,
      version: String(nuovo.version),
    })
    assert.equal(senzaConferma.status, 422)
    const r = await b.post(`/commesse/${c.id}/elaborati/${nuovo.id}/elimina`, {
      _csrf: csrf,
      version: String(nuovo.version),
      conferma: 'on',
    })
    assert.equal(r.status, 302)
    assert.isNull(await elaborato(c.id, 'DA-TOGLIERE'))
    await AuditLog.query().where('azione', 'elaborato.eliminato').firstOrFail()
  })

  test('eliminazione bloccata per un elaborato nella baseline approvata', async ({ assert }) => {
    const riga = await db
      .from('baseline_date_stato as bd')
      .join('baseline as b', 'b.id', 'bd.baseline_id')
      .join('elaborati as e', 'e.id', 'bd.elaborato_id')
      .where('b.stato', 'approvata')
      .select('e.id', 'e.commessa_id', 'e.version')
      .first()
    if (!riga) return
    const c = await Commessa.findOrFail(riga.commessa_id)
    const { b, csrf } = await entra('admin', c.id)
    const r = await b.post(`/commesse/${c.id}/elaborati/${riga.id}/elimina`, {
      _csrf: csrf,
      version: String(riga.version),
      conferma: 'on',
    })
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'baseline approvata')
  })

  test('elaborato di un’altra commessa: 404', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const altro = await db
      .from('elaborati as e')
      .join('commesse as c', 'c.id', 'e.commessa_id')
      .where('c.codice', 'CL-2026-018')
      .select('e.id')
      .first()
    if (!altro) return
    const { b } = await entra('admin', c.id)
    assert.equal((await b.get(`/commesse/${c.id}/elaborati/${altro.id}/modifica`)).status, 404)
  })
})

test.group('Anagrafiche · import elaborati', (group) => {
  conTransazione(group)

  test('anteprima con righe errate: niente viene importato', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const { b, csrf } = await entra('pm2', c.id)
    const prima = await db.from('elaborati').where('commessa_id', c.id).count('* as n')
    const testo = 'I-01;Primo;MEC;10\nI-02;Secondo;XYZ;5\nI-01;Terzo;ELE;dieci'
    const r = await b.post(`/commesse/${c.id}/elaborati/import/anteprima`, { _csrf: csrf, testo })
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'data-testid="import-errori"')
    assert.include(html, '2 righe hanno')
    assert.include(html, 'disciplina &quot;XYZ&quot; sconosciuta')
    assert.include(html, 'codice I-01 ripetuto (già alla riga 1)')
    assert.notInclude(html, 'data-testid="conferma-import"')

    // Anche forzando la conferma, con righe errate non si importa nulla
    const r2 = await b.post(`/commesse/${c.id}/elaborati/import`, { _csrf: csrf, testo })
    assert.equal(r2.status, 422)
    const dopo = await db.from('elaborati').where('commessa_id', c.id).count('* as n')
    assert.equal(dopo[0].n, prima[0].n)
  })

  test('anteprima corretta e conferma: elaborati creati in minuti, con audit', async ({
    assert,
  }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const { b, csrf } = await entra('pm2', c.id)
    const testo = 'Codice\tTitolo\tDisciplina\tBudget ore\nI-10\tSchema UTA\tMEC\t20\nI-11\tQuadro BMS\tImpianti elettrici\t7,5'
    const r = await b.post(`/commesse/${c.id}/elaborati/import/anteprima`, { _csrf: csrf, testo })
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'data-testid="import-pronto"')
    assert.include(html, '27,5 h')
    assert.include(html, 'Importa 2 elaborati')

    const r2 = await b.post(`/commesse/${c.id}/elaborati/import`, { _csrf: csrf, testo })
    assert.equal(r2.status, 302)
    assert.equal((await elaborato(c.id, 'I-10')).budget_minuti, 1200)
    assert.equal((await elaborato(c.id, 'I-11')).budget_minuti, 450)
    const voci = await AuditLog.query().where('azione', 'elaborato.importato')
    assert.lengthOf(voci, 2)
    const pagina = await (await b.vai(r2.headers.get('location')!)).text()
    assert.include(pagina, 'Importati 2 elaborati')
  })

  test('testo vuoto: 422 con messaggio', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const { b, csrf } = await entra('pm2', c.id)
    const r = await b.post(`/commesse/${c.id}/elaborati/import/anteprima`, {
      _csrf: csrf,
      testo: '  \n ',
    })
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'nessuna riga da importare.')
  })
})
