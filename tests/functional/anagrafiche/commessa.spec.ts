import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import Utente from '#models/utente'
import AuditLog from '#models/audit_log'
import { ascoltaEventi, type Evento } from '#shared/eventi'
import { commessaConTeam, milestoneProssime } from '#modules/anagrafiche/queries'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

const HTMX = (csrf: string) => ({ 'hx-request': 'true', 'x-csrf-token': csrf })

async function entra(come: string, percorso: string) {
  const b = new Browser()
  await b.loginSviluppo(come)
  const r = await b.vai(percorso)
  const html = await r.text()
  return { b, r, html, csrf: r.status === 200 ? Browser.csrfDa(html) : '' }
}

async function scuola() {
  return Commessa.findByOrFail('codice', 'CL-2026-031')
}

function datiCommessa(c: Commessa, extra: Record<string, string> = {}) {
  return {
    version: String(c.version),
    codice: c.codice,
    nome: c.nome,
    cliente: c.cliente ?? '',
    pm_id: String(c.pmId ?? ''),
    stato: c.stato,
    data_inizio: c.dataInizio ?? '',
    data_fine_prevista: c.dataFinePrevista ?? '',
    note: c.note ?? '',
    ...extra,
  }
}

test.group('Anagrafiche · query', (group) => {
  conTransazione(group)

  test('commessaConTeam: PM e membri ordinati per ruolo', async ({ assert }) => {
    const c = await scuola()
    const t = await commessaConTeam(c.id)
    assert.isNotNull(t)
    assert.equal(t!.codice, 'CL-2026-031')
    assert.equal(t!.pm!.nome, 'PM 1')
    assert.lengthOf(t!.membri, 8)
    assert.equal(t!.membri[0].ruoloCommessa, 'pm')
    assert.equal(t!.membri[t!.membri.length - 1].ruoloCommessa, 'osservatore')
    assert.isNull(await commessaConTeam(999999))
  })

  test('milestoneProssime: solo non completate da una data, in ordine', async ({ assert }) => {
    const c = await scuola()
    const ms = await milestoneProssime(c.id, '2026-09-24')
    assert.deepEqual(
      ms.map((m) => m.titolo),
      ['Esecutivo meccanico', 'Esecutivo elettrico', 'Emissione finale']
    )
    assert.lengthOf(await milestoneProssime(c.id, '2026-09-24', 1), 1)
    assert.lengthOf(await milestoneProssime(c.id, '2026-11-14'), 0)
  })
})

test.group('Anagrafiche · pagina e dati della commessa', (group) => {
  conTransazione(group)

  test('il PM vede i form, un membro vede la sola lettura', async ({ assert }) => {
    const c = await scuola()
    const pm = await entra('pm1', `/commesse/${c.id}/anagrafica`)
    assert.equal(pm.r.status, 200)
    assert.include(pm.html, 'data-testid="pannello-dati"')
    assert.include(pm.html, `action="/commesse/${c.id}/anagrafica/dati"`)
    assert.include(pm.html, 'Nuovo elaborato')

    const mec = await entra('mec1', `/commesse/${c.id}/anagrafica`)
    assert.equal(mec.r.status, 200)
    assert.notInclude(mec.html, `action="/commesse/${c.id}/anagrafica/dati"`)
    assert.notInclude(mec.html, 'Nuovo elaborato')
    assert.include(mec.html, 'sola lettura')
  })

  test('modifica dei dati: versione, audit ed evento', async ({ assert }) => {
    const c = await scuola()
    const { b, csrf } = await entra('pm1', `/commesse/${c.id}/anagrafica`)
    const eventi: Evento[] = []
    const smetti = ascoltaEventi((_canale, e) => eventi.push(e))
    const r = await b.post(
      `/commesse/${c.id}/anagrafica/dati`,
      datiCommessa(c, { nome: 'Scuola primaria – nome nuovo', data_fine_prevista: '20/11/2026' }),
      HTMX(csrf)
    )
    smetti()
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'versione 2')
    assert.include(r.headers.get('hx-trigger') ?? '', 'toast')
    const ora = await Commessa.findOrFail(c.id)
    assert.equal(ora.nome, 'Scuola primaria – nome nuovo')
    assert.equal(ora.dataFinePrevista, '2026-11-20')
    const voce = await AuditLog.query()
      .where('azione', 'commessa.aggiornata')
      .where('commessa_id', c.id)
      .firstOrFail()
    assert.equal((voce.datiDopo as { nome: string }).nome, 'Scuola primaria – nome nuovo')
    assert.isTrue(eventi.some((e) => e.tipo === 'commessa.aggiornata' && e.commessaId === c.id))
  })

  test('validazione in italiano: campi obbligatori e date', async ({ assert }) => {
    const c = await scuola()
    const { b, csrf } = await entra('pm1', `/commesse/${c.id}/anagrafica`)
    const r = await b.post(
      `/commesse/${c.id}/anagrafica/dati`,
      datiCommessa(c, {
        nome: '',
        data_inizio: '2026-10-01',
        data_fine_prevista: '2026-09-01',
        stato: 'boh',
      }),
      HTMX(csrf)
    )
    assert.equal(r.status, 422)
    const html = await r.text()
    assert.include(html, 'Nome: campo obbligatorio.')
    assert.include(html, 'Fine prevista: non può precedere la data di inizio.')
    assert.include(html, 'Stato: valore non previsto.')
    assert.equal((await Commessa.findOrFail(c.id)).version, c.version)
  })

  test('codice duplicato: errore sul campo, nessuna modifica', async ({ assert }) => {
    const c = await scuola()
    const { b, csrf } = await entra('pm1', `/commesse/${c.id}/anagrafica`)
    const r = await b.post(
      `/commesse/${c.id}/anagrafica/dati`,
      datiCommessa(c, { codice: 'CL-2026-018' }),
      HTMX(csrf)
    )
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'Codice: esiste già una commessa CL-2026-018.')
    assert.equal((await Commessa.findOrFail(c.id)).codice, 'CL-2026-031')
  })

  test('modifica concorrente: 409 con il pannello aggiornato', async ({ assert }) => {
    const c = await scuola()
    const anna = await entra('pm1', `/commesse/${c.id}/anagrafica`)
    const admin = await entra('admin', `/commesse/${c.id}/anagrafica`)
    const r1 = await admin.b.post(
      `/commesse/${c.id}/anagrafica/dati`,
      datiCommessa(c, { cliente: 'Cliente aggiornato' }),
      HTMX(admin.csrf)
    )
    assert.equal(r1.status, 200)
    const r2 = await anna.b.post(
      `/commesse/${c.id}/anagrafica/dati`,
      datiCommessa(c, { cliente: 'Altro cliente' }),
      HTMX(anna.csrf)
    )
    assert.equal(r2.status, 409)
    const html = await r2.text()
    assert.include(html, 'data-testid="conflitto"')
    assert.include(html, 'Cliente aggiornato')
    assert.equal((await Commessa.findOrFail(c.id)).cliente, 'Cliente aggiornato')
  })

  test('il nuovo PM entra nel team', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const idr1 = await Utente.findByOrFail('email', 'idr1@climosfera.example')
    const { b, csrf } = await entra('admin', `/commesse/${c.id}/anagrafica`)
    const r = await b.post(
      `/commesse/${c.id}/anagrafica/dati`,
      datiCommessa(c, { pm_id: String(idr1.id) }),
      HTMX(csrf)
    )
    assert.equal(r.status, 200)
    const m = await db
      .from('membri_commessa')
      .where('commessa_id', c.id)
      .where('utente_id', idr1.id)
      .first()
    assert.equal(m.ruolo_commessa, 'pm')
  })

  test('senza HTMX: redirezione con messaggio', async ({ assert }) => {
    const c = await scuola()
    const { b, csrf } = await entra('pm1', `/commesse/${c.id}/anagrafica`)
    const r = await b.post(`/commesse/${c.id}/anagrafica/dati`, {
      _csrf: csrf,
      ...datiCommessa(c, { note: 'nota nuova' }),
    })
    assert.equal(r.status, 302)
    const pagina = await (await b.vai(r.headers.get('location')!)).text()
    assert.include(pagina, 'Dati della commessa salvati')
  })
})

test.group('Anagrafiche · permessi', (group) => {
  conTransazione(group)

  test('non membro: 403 su pagina e modifiche', async ({ assert }) => {
    const uffici = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const scuolaC = await scuola()
    const { b, csrf } = await entra('mec1', `/commesse/${scuolaC.id}/anagrafica`)
    assert.equal((await b.get(`/commesse/${uffici.id}/anagrafica`)).status, 403)
    const r = await b.post(
      `/commesse/${uffici.id}/anagrafica/dati`,
      datiCommessa(uffici, { nome: 'x' }),
      HTMX(csrf)
    )
    assert.equal(r.status, 403)
    assert.equal(
      (await b.post(`/commesse/${uffici.id}/team`, { utente_id: '1', ruolo_commessa: 'pm' }, HTMX(csrf)))
        .status,
      403
    )
    assert.equal((await b.get(`/commesse/${uffici.id}/elaborati/nuovo`)).status, 403)
  })

  test('membro non PM e osservatore: 403 sulle modifiche', async ({ assert }) => {
    const c = await scuola()
    for (const come of ['mec1', 'pm2', 'direzione']) {
      const { b, csrf } = await entra(come, `/commesse/${c.id}/anagrafica`)
      const r = await b.post(
        `/commesse/${c.id}/anagrafica/dati`,
        datiCommessa(c, { nome: 'x' }),
        HTMX(csrf)
      )
      assert.equal(r.status, 403, come)
      assert.equal((await b.get(`/commesse/${c.id}/elaborati/import`)).status, 403, come)
    }
    assert.equal((await Commessa.findOrFail(c.id)).nome, c.nome)
  })
})
