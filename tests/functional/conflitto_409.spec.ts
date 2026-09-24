import { test } from '@japa/runner'
import Commessa from '#models/commessa'
import Impostazione from '#models/impostazione'
import AuditLog from '#models/audit_log'
import { aggiornaConVersione, ConflittoVersione } from '#shared/optimistic'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

test.group('Optimistic locking · servizio', (group) => {
  conTransazione(group)

  test('due modifiche partite dalla stessa versione: la seconda è 409', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const versioneVista = c.version

    const prima = await aggiornaConVersione(Commessa, c.id, versioneVista, {
      note: 'modifica di Anna',
    })
    assert.equal(prima.version, versioneVista + 1)

    try {
      await aggiornaConVersione(Commessa, c.id, versioneVista, { note: 'modifica di Bruno' })
      assert.fail('doveva lanciare ConflittoVersione')
    } catch (errore) {
      assert.instanceOf(errore, ConflittoVersione)
      const conflitto = errore as ConflittoVersione<Commessa>
      assert.equal(conflitto.status, 409)
      assert.equal(conflitto.attuale!.note, 'modifica di Anna')
      assert.equal(conflitto.attuale!.version, versioneVista + 1)
    }
    const ora = await Commessa.findOrFail(c.id)
    assert.equal(ora.note, 'modifica di Anna')
  })

  test('con audit registra prima e dopo nella stessa transazione', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2025-077')
    await aggiornaConVersione(
      Commessa,
      c.id,
      c.version,
      { nome: 'RSA – nome aggiornato' },
      { audit: { utenteId: null, azione: 'commessa.aggiornata', commessaId: c.id } }
    )
    const voce = await AuditLog.query().where('azione', 'commessa.aggiornata').firstOrFail()
    assert.equal((voce.datiPrima as { nome: string }).nome, 'RSA – antincendio e idrico-sanitario')
    assert.equal((voce.datiDopo as { nome: string }).nome, 'RSA – nome aggiornato')
  })

  test('riga cancellata: 409 con attuale null', async ({ assert }) => {
    try {
      await aggiornaConVersione(Commessa, 999999, 1, { note: 'x' })
      assert.fail('doveva lanciare')
    } catch (errore) {
      assert.instanceOf(errore, ConflittoVersione)
      assert.isNull((errore as ConflittoVersione).attuale)
    }
  })
})

test.group('Optimistic locking · HTTP (impostazioni admin)', (group) => {
  conTransazione(group)

  test('modifica concorrente: 409 con messaggio e frammento aggiornato (HTMX)', async ({
    assert,
  }) => {
    const imp = await Impostazione.findByOrFail('chiave', 'flusso.giorni_elaborato_fermo')
    const versioneVista = String(imp.version)

    // Due amministratori aprono la pagina con la stessa versione
    const anna = new Browser()
    await anna.loginSviluppo('admin')
    const csrfAnna = Browser.csrfDa(await (await anna.vai('/admin')).text())
    const bruno = new Browser()
    await bruno.loginSviluppo('admin')
    const csrfBruno = Browser.csrfDa(await (await bruno.vai('/admin')).text())

    const htmx = (csrf: string) => ({ 'hx-request': 'true', 'x-csrf-token': csrf })

    const r1 = await anna.post(
      `/admin/impostazioni/${imp.id}`,
      { version: versioneVista, valore: '12' },
      htmx(csrfAnna)
    )
    assert.equal(r1.status, 200)
    const html1 = await r1.text()
    assert.include(html1, 'versione 2')
    assert.include(r1.headers.get('hx-trigger') ?? '', 'toast')

    const r2 = await bruno.post(
      `/admin/impostazioni/${imp.id}`,
      { version: versioneVista, valore: '15' },
      htmx(csrfBruno)
    )
    assert.equal(r2.status, 409)
    const html2 = await r2.text()
    assert.include(html2, 'data-testid="conflitto"')
    assert.include(html2, 'Qualcun altro ha modificato questo dato')
    assert.include(html2, 'versione 2')
    assert.include(html2, 'value="12"')
    assert.include(r2.headers.get('hx-trigger') ?? '', 'conflitto')

    const ora = await Impostazione.findOrFail(imp.id)
    assert.equal(ora.valore, 12)
    assert.isFalse(ora.diEsempio)
  })

  test('senza HTMX il 409 mostra una pagina completa', async ({ assert }) => {
    const imp = await Impostazione.findByOrFail('chiave', 'lps.settimane_lookahead')
    const b = new Browser()
    await b.loginSviluppo('admin')
    const csrf = Browser.csrfDa(await (await b.vai('/admin')).text())
    await b.post(`/admin/impostazioni/${imp.id}`, {
      _csrf: csrf,
      version: String(imp.version),
      valore: '5',
    })
    const r = await b.post(`/admin/impostazioni/${imp.id}`, {
      _csrf: csrf,
      version: String(imp.version),
      valore: '7',
    })
    assert.equal(r.status, 409)
    const html = await r.text()
    assert.include(html, '<html lang="it">')
    assert.include(html, 'Qualcun altro ha modificato questo dato')
  })

  test('valore non valido: 422 senza salvare', async ({ assert }) => {
    const imp = await Impostazione.findByOrFail('chiave', 'soglie.spi')
    const b = new Browser()
    await b.loginSviluppo('admin')
    const csrf = Browser.csrfDa(await (await b.vai('/admin')).text())
    const r = await b.post(
      `/admin/impostazioni/${imp.id}`,
      { version: String(imp.version), verde: 'abc', giallo: '0,85' },
      { 'hx-request': 'true', 'x-csrf-token': csrf }
    )
    assert.equal(r.status, 422)
    assert.equal((await Impostazione.findOrFail(imp.id)).version, imp.version)
  })

  test('soglia con la virgola italiana', async ({ assert }) => {
    const imp = await Impostazione.findByOrFail('chiave', 'soglie.cpi')
    const b = new Browser()
    await b.loginSviluppo('admin')
    const csrf = Browser.csrfDa(await (await b.vai('/admin')).text())
    const r = await b.post(
      `/admin/impostazioni/${imp.id}`,
      { version: String(imp.version), verde: '0,97', giallo: '0,9' },
      { 'hx-request': 'true', 'x-csrf-token': csrf }
    )
    assert.equal(r.status, 200)
    assert.deepEqual((await Impostazione.findOrFail(imp.id)).valore, {
      verde: 0.97,
      giallo: 0.9,
      verso: 'alto',
    })
  })

  test('senza token CSRF la modifica è rifiutata', async ({ assert }) => {
    const imp = await Impostazione.findByOrFail('chiave', 'soglie.ppc')
    const b = new Browser()
    await b.loginSviluppo('admin')
    const r = await b.post(`/admin/impostazioni/${imp.id}`, {
      version: String(imp.version),
      verde: '0,8',
      giallo: '0,6',
    })
    assert.notEqual(r.status, 200)
    assert.equal((await Impostazione.findOrFail(imp.id)).version, imp.version)
  })
})
