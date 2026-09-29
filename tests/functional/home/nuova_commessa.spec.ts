import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Utente from '#models/utente'
import Commessa from '#models/commessa'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

async function entra(come: string) {
  const b = new Browser()
  await b.loginSviluppo(come)
  const r = await b.get('/commesse/nuova')
  const html = await r.text()
  return { b, r, html, csrf: r.status === 200 ? Browser.csrfDa(html) : '' }
}

test.group('Nuova commessa dalla home (PM)', (group) => {
  conTransazione(group)

  test('il PM apre una commessa e ne diventa il PM, anche se indica un altro pm_id', async ({
    assert,
  }) => {
    const pm1 = await Utente.findByOrFail('email', 'pm1@climosfera.example')
    const pm2 = await Utente.findByOrFail('email', 'pm2@climosfera.example')
    const { b, r, html, csrf } = await entra('pm1')
    assert.equal(r.status, 200)
    assert.notInclude(html, 'name="pm_id"')
    const risposta = await b.post(
      '/commesse/nuova',
      { codice: 'CL-2026-900', nome: 'Pilota', pm_id: String(pm2.id) },
      { 'x-csrf-token': csrf }
    )
    assert.equal(risposta.status, 302)
    const c = await Commessa.findByOrFail('codice', 'CL-2026-900')
    assert.equal(risposta.headers.get('location'), `/commesse/${c.id}/anagrafica`)
    assert.equal(c.pmId, pm1.id)
    const membro = await db
      .from('membri_commessa')
      .where({ commessa_id: c.id, utente_id: pm1.id })
      .first()
    assert.equal(membro.ruolo_commessa, 'pm')
    const audit = await db.from('audit_log').where({ entita: 'commesse', entita_id: c.id })
    assert.lengthOf(audit, 1)
    // La home del PM mostra la commessa nuova
    assert.include(await (await b.get('/')).text(), 'CL-2026-900')
  })

  test('codice doppio o nome mancante: 422 con messaggio, nessuna commessa', async ({ assert }) => {
    const { b, csrf } = await entra('pm1')
    const doppio = await b.post(
      '/commesse/nuova',
      { codice: 'CL-2026-031', nome: 'x' },
      { 'x-csrf-token': csrf }
    )
    assert.equal(doppio.status, 422)
    assert.include(await doppio.text(), 'esiste già una commessa CL-2026-031')
    const senzaNome = await b.post(
      '/commesse/nuova',
      { codice: 'CL-2026-901' },
      { 'x-csrf-token': csrf }
    )
    assert.equal(senzaNome.status, 422)
    assert.isNull(await Commessa.findBy('codice', 'CL-2026-901'))
  })

  test('progettisti e direzione: 403 e nessun pulsante in home', async ({ assert }) => {
    for (const come of ['mec1', 'direzione']) {
      const { b, r } = await entra(come)
      assert.equal(r.status, 403, come)
      assert.notInclude(await (await b.get('/')).text(), 'apri-nuova-commessa', come)
    }
    const { b } = await entra('pm1')
    assert.include(await (await b.get('/')).text(), 'apri-nuova-commessa')
  })
})
