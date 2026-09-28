import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import Utente from '#models/utente'
import MembroCommessa from '#models/membro_commessa'
import Milestone from '#models/milestone'
import AuditLog from '#models/audit_log'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

const HTMX = (csrf: string) => ({ 'hx-request': 'true', 'x-csrf-token': csrf })

async function entra(come: string, commessaId: number) {
  const b = new Browser()
  await b.loginSviluppo(come)
  const html = await (await b.vai(`/commesse/${commessaId}/anagrafica`)).text()
  return { b, csrf: Browser.csrfDa(html) }
}

async function utente(slug: string) {
  return Utente.findByOrFail('email', `${slug}@climosfera.example`)
}

test.group('Anagrafiche · team', (group) => {
  conTransazione(group)

  test('aggiunge un membro con ruolo e audit', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const idr1 = await utente('idr1')
    const { b, csrf } = await entra('pm2', c.id)
    const r = await b.post(
      `/commesse/${c.id}/team`,
      { utente_id: String(idr1.id), ruolo_commessa: 'verificatore' },
      HTMX(csrf)
    )
    assert.equal(r.status, 200)
    assert.include(await r.text(), 'Progettista IDR 1')
    const m = await MembroCommessa.query()
      .where('commessa_id', c.id)
      .where('utente_id', idr1.id)
      .firstOrFail()
    assert.equal(m.ruoloCommessa, 'verificatore')
    const voce = await AuditLog.query()
      .where('azione', 'membro.aggiunto')
      .where('entita_id', String(m.id))
      .firstOrFail()
    assert.equal(voce.commessaId, c.id)
  })

  test('membro già presente e ruolo non valido: 422 in italiano', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const mec2 = await utente('mec2')
    const { b, csrf } = await entra('pm2', c.id)
    const r = await b.post(
      `/commesse/${c.id}/team`,
      { utente_id: String(mec2.id), ruolo_commessa: 'capo' },
      HTMX(csrf)
    )
    assert.equal(r.status, 422)
    const html = await r.text()
    assert.include(html, 'Persona: fa già parte del team.')
    assert.include(html, 'Ruolo: valore non previsto.')
  })

  test('cambio di ruolo: audit con prima e dopo, 409 con versione vecchia', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const qualita = await utente('qualita')
    const m = await MembroCommessa.query()
      .where('commessa_id', c.id)
      .where('utente_id', qualita.id)
      .firstOrFail()
    const { b, csrf } = await entra('pm1', c.id)
    const r1 = await b.post(
      `/commesse/${c.id}/team/${m.id}`,
      { version: String(m.version), ruolo_commessa: 'progettista' },
      HTMX(csrf)
    )
    assert.equal(r1.status, 200)
    const voce = await AuditLog.query()
      .where('azione', 'membro.ruolo_cambiato')
      .where('entita_id', String(m.id))
      .firstOrFail()
    assert.equal((voce.datiPrima as { ruoloCommessa: string }).ruoloCommessa, 'verificatore')
    assert.equal((voce.datiDopo as { ruoloCommessa: string }).ruoloCommessa, 'progettista')

    const r2 = await b.post(
      `/commesse/${c.id}/team/${m.id}`,
      { version: String(m.version), ruolo_commessa: 'osservatore' },
      HTMX(csrf)
    )
    assert.equal(r2.status, 409)
    assert.include(await r2.text(), 'data-testid="conflitto"')
    assert.equal((await MembroCommessa.findOrFail(m.id)).ruoloCommessa, 'progettista')
  })

  test('toglie un membro dal team', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const pm2 = await utente('pm2')
    const m = await MembroCommessa.query()
      .where('commessa_id', c.id)
      .where('utente_id', pm2.id)
      .firstOrFail()
    const { b, csrf } = await entra('pm1', c.id)
    const r = await b.post(
      `/commesse/${c.id}/team/${m.id}/rimuovi`,
      { version: String(m.version) },
      HTMX(csrf)
    )
    assert.equal(r.status, 200)
    assert.isNull(await MembroCommessa.find(m.id))
    await AuditLog.query().where('azione', 'membro.rimosso').firstOrFail()
  })

  test('oltre 10 membri: avviso nel pannello', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const { b, csrf } = await entra('pm1', c.id)
    // 8 membri nel seed: se ne aggiungono 3 (due utenti di esempio in più)
    const nuovi = await Utente.createMany([
      { email: 'extra1@climosfera.example', nome: 'Extra 1', ruolo: 'progettista', attivo: true },
      { email: 'extra2@climosfera.example', nome: 'Extra 2', ruolo: 'progettista', attivo: true },
    ])
    const admin = await utente('admin')
    let html = ''
    for (const u of [...nuovi, admin]) {
      const r = await b.post(
        `/commesse/${c.id}/team`,
        { utente_id: String(u.id), ruolo_commessa: 'osservatore' },
        HTMX(csrf)
      )
      assert.equal(r.status, 200)
      html = await r.text()
      if (u.id === admin.id) {
        assert.include(r.headers.get('hx-trigger') ?? '', 'consigliato al massimo 10')
      }
    }
    assert.include(html, 'data-testid="avviso-team"')
    assert.include(html.replace(/\s+/g, ' '), 'Il team ha 11 persone')
  })

  test('un membro vede il team ma non i comandi', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const b = new Browser()
    await b.loginSviluppo('mec1')
    const html = await (await b.vai(`/commesse/${c.id}/anagrafica`)).text()
    assert.include(html, 'Resp. qualità')
    assert.notInclude(html, `/commesse/${c.id}/team"`)
  })
})

test.group('Anagrafiche · milestone', (group) => {
  conTransazione(group)

  test('crea, modifica ed elimina una milestone', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const { b, csrf } = await entra('pm2', c.id)
    const r1 = await b.post(
      `/commesse/${c.id}/milestone`,
      {
        titolo: 'Consegna preliminare',
        data_prevista: '15/10/2026',
        contrattuale: 'on',
        ordine: '3',
      },
      HTMX(csrf)
    )
    assert.equal(r1.status, 200)
    const ms = await Milestone.query()
      .where('commessa_id', c.id)
      .where('titolo', 'Consegna preliminare')
      .firstOrFail()
    assert.equal(ms.dataPrevista, '2026-10-15')
    assert.isTrue(ms.contrattuale)
    assert.equal(ms.ordine, 3)

    const r2 = await b.post(
      `/commesse/${c.id}/milestone/${ms.id}`,
      {
        version: String(ms.version),
        titolo: 'Consegna preliminare',
        data_prevista: '2026-10-16',
        data_effettiva: '2026-10-14',
        ordine: '3',
      },
      HTMX(csrf)
    )
    assert.equal(r2.status, 200)
    const ora = await Milestone.findOrFail(ms.id)
    assert.equal(ora.dataEffettiva, '2026-10-14')
    assert.isFalse(ora.contrattuale)
    assert.equal(ora.version, ms.version + 1)

    const r3 = await b.post(
      `/commesse/${c.id}/milestone/${ms.id}/elimina`,
      { version: String(ms.version) },
      HTMX(csrf)
    )
    assert.equal(r3.status, 409, 'eliminazione con versione vecchia')
    const r4 = await b.post(
      `/commesse/${c.id}/milestone/${ms.id}/elimina`,
      { version: String(ora.version) },
      HTMX(csrf)
    )
    assert.equal(r4.status, 200)
    assert.isNull(await Milestone.find(ms.id))
    const azioni = (
      await AuditLog.query().where('entita', 'milestone').where('entita_id', String(ms.id))
    ).map((v) => v.azione)
    assert.sameMembers(azioni, ['milestone.creata', 'milestone.aggiornata', 'milestone.eliminata'])
  })

  test('validazione: titolo e data target obbligatori, data non valida', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const { b, csrf } = await entra('pm2', c.id)
    const r = await b.post(
      `/commesse/${c.id}/milestone`,
      { titolo: '', data_prevista: '', data_effettiva: '31/02/2026', ordine: 'x' },
      HTMX(csrf)
    )
    assert.equal(r.status, 422)
    const html = await r.text()
    assert.include(html, 'Titolo: campo obbligatorio.')
    assert.include(html, 'Data target: campo obbligatorio.')
    assert.include(html, 'Data effettiva: data non valida (usa gg/mm/aaaa).')
    assert.include(html, 'Ordine: serve un numero intero.')
  })

  test('milestone di un’altra commessa: 404', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const altra = await db
      .from('milestone as m')
      .join('commesse as c', 'c.id', 'm.commessa_id')
      .where('c.codice', 'CL-2026-018')
      .select('m.id', 'm.version')
      .firstOrFail()
    const { b, csrf } = await entra('pm1', c.id)
    const r = await b.post(
      `/commesse/${c.id}/milestone/${altra.id}`,
      { version: String(altra.version), titolo: 'x', data_prevista: '2026-10-01' },
      HTMX(csrf)
    )
    assert.equal(r.status, 404)
  })
})

test.group('Anagrafiche · limiti WIP della commessa', (group) => {
  conTransazione(group)

  test('imposta, modifica e toglie il limite della commessa', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const col = await db.from('colonne_kanban').where('codice', 'in_corso').firstOrFail()
    const { b, csrf } = await entra('pm2', c.id)
    const trova = () =>
      db
        .from('limiti_wip_commessa')
        .where('commessa_id', c.id)
        .where('colonna_kanban_id', col.id)
        .first()
    await db.from('limiti_wip_commessa').where('commessa_id', c.id).delete()

    let r = await b.post(
      `/commesse/${c.id}/limiti-wip/${col.id}`,
      { version: '', limite: '6' },
      HTMX(csrf)
    )
    assert.equal(r.status, 200)
    const riga = await trova()
    assert.equal(riga.limite, 6)

    r = await b.post(
      `/commesse/${c.id}/limiti-wip/${col.id}`,
      { version: String(riga.version), limite: '0' },
      HTMX(csrf)
    )
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'il valore minimo è 1')

    r = await b.post(
      `/commesse/${c.id}/limiti-wip/${col.id}`,
      { version: String(riga.version), limite: '' },
      HTMX(csrf)
    )
    assert.equal(r.status, 200)
    assert.isNull(await trova())
    await AuditLog.query().where('azione', 'limite_wip.rimosso').firstOrFail()
  })
})
