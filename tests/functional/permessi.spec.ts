import { test } from '@japa/runner'
import { Bouncer } from '@adonisjs/bouncer'
import * as abilita from '#abilities/main'
import Commessa from '#models/commessa'
import Utente from '#models/utente'
import Impostazione from '#models/impostazione'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

async function utente(slug: string) {
  return Utente.findByOrFail('email', `${slug}@climosfera.example`)
}
function bouncerPer(u: Utente) {
  return new Bouncer(u, abilita, {})
}

test.group('Permessi · abilità Bouncer', (group) => {
  conTransazione(group)

  test('vedeCommessa: ruolo globale e appartenenza', async ({ assert }) => {
    const scuola = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const uffici = await Commessa.findByOrFail('codice', 'CL-2026-018')
    assert.isTrue(await bouncerPer(await utente('admin')).allows(abilita.vedeCommessa, uffici))
    assert.isTrue(await bouncerPer(await utente('direzione')).allows(abilita.vedeCommessa, uffici))
    assert.isTrue(await bouncerPer(await utente('mec1')).allows(abilita.vedeCommessa, scuola))
    assert.isFalse(await bouncerPer(await utente('mec1')).allows(abilita.vedeCommessa, uffici))
    assert.isTrue(
      await bouncerPer(await utente('pm2')).allows(abilita.vedeCommessa, scuola),
      'osservatore'
    )
  })

  test('modificaCommessa e gestisceLps: solo admin e PM della commessa', async ({ assert }) => {
    const scuola = await Commessa.findByOrFail('codice', 'CL-2026-031')
    for (const [slug, atteso] of [
      ['admin', true],
      ['pm1', true],
      ['pm2', false],
      ['direzione', false],
      ['mec1', false],
      ['qualita', false],
    ] as const) {
      const b = bouncerPer(await utente(slug))
      assert.equal(
        await b.allows(abilita.modificaCommessa, scuola),
        atteso,
        `modificaCommessa ${slug}`
      )
      assert.equal(await b.allows(abilita.gestisceLps, scuola), atteso, `gestisceLps ${slug}`)
    }
  })

  test('registraOre: solo per sé, anche per l’admin', async ({ assert }) => {
    const mec1 = await utente('mec1')
    const admin = await utente('admin')
    assert.isTrue(await bouncerPer(mec1).allows(abilita.registraOre, mec1.id))
    assert.isFalse(await bouncerPer(mec1).allows(abilita.registraOre, admin.id))
    assert.isFalse(await bouncerPer(admin).allows(abilita.registraOre, mec1.id))
  })

  test('vedeOrePerPersona: disattivata di default, poi solo admin e PM', async ({ assert }) => {
    const scuola = await Commessa.findByOrFail('codice', 'CL-2026-031')
    assert.isFalse(
      await bouncerPer(await utente('admin')).allows(abilita.vedeOrePerPersona, scuola)
    )
    assert.isFalse(await bouncerPer(await utente('pm1')).allows(abilita.vedeOrePerPersona, scuola))
    await Impostazione.query()
      .where('chiave', 'ore.per_persona_visibili')
      .update({ valore: 'true' })
    assert.isTrue(await bouncerPer(await utente('pm1')).allows(abilita.vedeOrePerPersona, scuola))
    assert.isFalse(
      await bouncerPer(await utente('direzione')).allows(abilita.vedeOrePerPersona, scuola)
    )
    assert.isFalse(await bouncerPer(await utente('mec1')).allows(abilita.vedeOrePerPersona, scuola))
  })

  test('utente disattivato: nessun permesso', async ({ assert }) => {
    const a = await utente('admin')
    a.attivo = false
    const scuola = await Commessa.findByOrFail('codice', 'CL-2026-031')
    assert.isFalse(await bouncerPer(a).allows(abilita.admin))
    assert.isFalse(await bouncerPer(a).allows(abilita.vedeCommessa, scuola))
  })
})

test.group('Permessi · rotte', (group) => {
  conTransazione(group)

  test('commessa non visibile: 403; commessa inesistente: 404', async ({ assert }) => {
    const uffici = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const b = new Browser()
    await b.loginSviluppo('mec1')
    assert.equal((await b.get(`/commesse/${uffici.id}`)).status, 403)
    assert.equal((await b.get(`/commesse/${uffici.id}/flusso`)).status, 403)
    assert.equal((await b.get('/commesse/999999')).status, 404)
  })

  test('tutte le pagine dei moduli rispondono per un membro della commessa', async ({ assert }) => {
    const scuola = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const b = new Browser()
    await b.loginSviluppo('mec1')
    for (const p of [
      '',
      '/lps/settimana',
      '/lps/lookahead',
      '/flusso',
      '/ore',
      '/evm',
      '/anagrafica',
    ]) {
      const r = await b.get(`/commesse/${scuola.id}${p}`)
      assert.equal(r.status, 200, `/commesse/${scuola.id}${p}`)
    }
    for (const p of ['/', '/portafoglio', '/ore']) {
      assert.equal((await b.get(p)).status, 200, p)
    }
  })

  test('amministrazione solo per admin', async ({ assert }) => {
    const b = new Browser()
    await b.loginSviluppo('pm1')
    assert.equal((await b.get('/admin')).status, 403)
    const a = new Browser()
    await a.loginSviluppo('admin')
    const r = await a.get('/admin')
    assert.equal(r.status, 200)
    assert.include(await r.text(), 'valore di esempio')
  })
})
