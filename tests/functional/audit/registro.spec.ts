import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Utente from '#models/utente'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

// Finché start/routes.ts non importa il modulo, le rotte le registra il test
// prima che il server di test chiuda il router (import idempotente).
import '#modules/audit/routes'

async function utente(slug: string) {
  return Utente.findByOrFail('email', `${slug}@climosfera.example`)
}

/** Inserisce voci di prova con istante esplicito (l'audit accetta inserimenti) */
async function inserisci(
  voci: {
    utenteId?: number | null
    azione?: string
    entita?: string
    entitaId?: string
    creatoIl: string
    dopo?: unknown
  }[]
) {
  await db.table('audit_log').multiInsert(
    voci.map((v) => ({
      utente_id: v.utenteId ?? null,
      azione: v.azione ?? 'prova.b3',
      entita: v.entita ?? 'prova_b3',
      entita_id: v.entitaId ?? null,
      dati_dopo: v.dopo === undefined ? null : JSON.stringify(v.dopo),
      creato_il: v.creatoIl,
    }))
  )
}

function righe(html: string) {
  return (html.match(/data-testid="voce-registro"/g) ?? []).length
}

async function admin() {
  const b = new Browser()
  await b.loginSviluppo('admin')
  return b
}

test.group('Registro attività', (group) => {
  conTransazione(group)

  test('solo l’amministratore; anonimi al login', async ({ assert }) => {
    for (const come of ['pm1', 'direzione', 'mec1']) {
      const b = new Browser()
      await b.loginSviluppo(come)
      assert.equal((await b.get('/admin/registro')).status, 403, come)
    }
    const anonimo = await new Browser().get('/admin/registro')
    assert.equal(anonimo.status, 302)
    assert.match(anonimo.headers.get('location') ?? '', /^\/accesso/)
    const r = await (await admin()).get('/admin/registro')
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'Registro attività')
    assert.include(html, 'data-testid="tabella-registro"')
    // Sottomenu dell'amministrazione con la voce del registro attiva
    assert.match(html, /<a href="\/admin\/registro" aria-current="page">/)
  })

  test('filtro per data: giorni interi nell’ora di Roma', async ({ assert }) => {
    // 23:30 UTC del 10 marzo = 00:30 dell'11 marzo a Roma (CET)
    await inserisci([
      { creatoIl: '2026-03-10T23:30:00Z', entitaId: 'notte' },
      { creatoIl: '2026-03-10T12:00:00Z', entitaId: 'giorno' },
    ])
    const b = await admin()
    const undici = await (
      await b.get('/admin/registro?entita=prova_b3&dal=2026-03-11&al=2026-03-11')
    ).text()
    assert.equal(righe(undici), 1)
    assert.include(undici, '#notte')
    assert.include(undici, '11/03/2026 00:30')
    const dieci = await (
      await b.get('/admin/registro?entita=prova_b3&dal=2026-03-10&al=2026-03-10')
    ).text()
    assert.equal(righe(dieci), 1)
    assert.include(dieci, '#giorno')
    const soloDal = await (await b.get('/admin/registro?entita=prova_b3&dal=2026-03-11')).text()
    assert.equal(righe(soloDal), 1)
    const soloAl = await (await b.get('/admin/registro?entita=prova_b3&al=2026-03-10')).text()
    assert.equal(righe(soloAl), 1)
  })

  test('filtri per utente ed entità', async ({ assert }) => {
    const pm1 = await utente('pm1')
    const mec1 = await utente('mec1')
    await inserisci([
      { utenteId: pm1.id, entita: 'prova_b3', creatoIl: '2026-04-01T08:00:00Z' },
      { utenteId: mec1.id, entita: 'prova_b3', creatoIl: '2026-04-01T09:00:00Z' },
      { utenteId: mec1.id, entita: 'altra_b3', creatoIl: '2026-04-01T10:00:00Z' },
    ])
    const b = await admin()
    const perUtente = await (
      await b.get(`/admin/registro?utente=${mec1.id}&dal=2026-04-01&al=2026-04-01`)
    ).text()
    assert.equal(righe(perUtente), 2)
    assert.notInclude(perUtente, '>PM 1<')
    const perEntita = await (
      await b.get(`/admin/registro?utente=${mec1.id}&entita=altra_b3`)
    ).text()
    assert.equal(righe(perEntita), 1)
    // Le entità presenti compaiono nella tendina
    assert.include(perEntita, '<option value="altra_b3" selected>')
  })

  test('paginazione: 50 voci per pagina, dalla più recente', async ({ assert }) => {
    const voci = Array.from({ length: 60 }, (_, i) => ({
      entitaId: `n${String(i).padStart(2, '0')}`,
      creatoIl: new Date(Date.UTC(2026, 4, 1, 8, i)).toISOString(),
    }))
    await inserisci(voci)
    const b = await admin()
    const p1 = await (await b.get('/admin/registro?entita=prova_b3')).text()
    assert.equal(righe(p1), 50)
    assert.include(p1, '#n59')
    assert.notInclude(p1, '#n09')
    assert.include(p1, 'href="/admin/registro?entita=prova_b3&amp;pagina=2"')
    assert.match(p1, /60\s+voci\s+·\s+pagina\s+1\s+di\s+2/)
    const p2 = await (await b.get('/admin/registro?entita=prova_b3&pagina=2')).text()
    assert.equal(righe(p2), 10)
    assert.include(p2, '#n00')
    assert.include(p2, 'href="/admin/registro?entita=prova_b3"')
    const oltre = await b.get('/admin/registro?entita=prova_b3&pagina=9')
    assert.equal(oltre.status, 200)
    assert.equal(righe(await oltre.text()), 0)
  })

  test('filtri non validi: messaggio, niente errore; dati mostrati come testo', async ({
    assert,
  }) => {
    await inserisci([{ creatoIl: '2026-05-02T08:00:00Z', dopo: { nota: '<script>x</script>' } }])
    const b = await admin()
    const r = await b.get('/admin/registro?dal=31-12-2026&al=ieri&utente=abc&pagina=-3')
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'Data “dal” non valida.')
    assert.include(html, 'Data “al” non valida.')
    const invertite = await (await b.get('/admin/registro?dal=2026-05-03&al=2026-05-01')).text()
    assert.include(invertite, 'successiva alla data')
    const dati = await (await b.get('/admin/registro?entita=prova_b3')).text()
    assert.notInclude(dati, '<script>x</script>')
    assert.include(dati, '&lt;script&gt;')
  })
})
