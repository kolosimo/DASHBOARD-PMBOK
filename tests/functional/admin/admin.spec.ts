import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Utente from '#models/utente'
import StatoElaborato from '#models/stato_elaborato'
import ColonnaKanban from '#models/colonna_kanban'
import Disciplina from '#models/disciplina'
import CausaNonCompletamento from '#models/causa_non_completamento'
import Commessa from '#models/commessa'
import AuditLog from '#models/audit_log'
import { ascoltaEventi, type Evento } from '#shared/eventi'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

const HTMX = (csrf: string) => ({ 'hx-request': 'true', 'x-csrf-token': csrf })

async function entra(come: string, percorso = '/admin') {
  const b = new Browser()
  await b.loginSviluppo(come)
  const r = await b.vai(percorso)
  const html = await r.text()
  return { b, r, html, csrf: r.status === 200 ? Browser.csrfDa(html) : '' }
}

async function utente(slug: string) {
  return Utente.findByOrFail('email', `${slug}@climosfera.example`)
}

test.group('Admin · accesso alle sezioni', (group) => {
  conTransazione(group)

  test('tutte le sezioni rispondono all’admin', async ({ assert }) => {
    const { b } = await entra('admin')
    for (const p of [
      '/admin',
      '/admin/commesse',
      '/admin/utenti',
      '/admin/discipline',
      '/admin/stati',
      '/admin/colonne',
      '/admin/cause',
    ]) {
      const r = await b.get(p)
      assert.equal(r.status, 200, p)
      assert.include(await r.text(), 'data-testid="menu-admin"', p)
    }
  })

  test('non admin: 403 su pagine e modifiche (anche POST)', async ({ assert }) => {
    const pm = await entra('pm1', '/')
    const stato = await StatoElaborato.findByOrFail('codice', 'impostato')
    const u = await utente('mec1')
    for (const p of ['/admin', '/admin/utenti', '/admin/stati', '/admin/cause']) {
      assert.equal((await pm.b.get(p)).status, 403, p)
    }
    const prove: [string, Record<string, string>][] = [
      [
        `/admin/stati/${stato.id}`,
        {
          version: String(stato.version),
          nome: 'x',
          peso_ev_percento: '30',
          colonna_kanban_id: String(stato.colonnaKanbanId),
        },
      ],
      [`/admin/utenti/${u.id}`, { version: String(u.version), ruolo: 'admin', attivo: 'on' }],
      ['/admin/commesse', { codice: 'X-1', nome: 'x' }],
      ['/admin/discipline', { codice: 'X', nome: 'x' }],
    ]
    for (const [p, campi] of prove) {
      assert.equal((await pm.b.post(p, campi, HTMX(pm.csrf))).status, 403, p)
    }
    assert.equal((await Utente.findOrFail(u.id)).ruolo, 'progettista')
    assert.equal((await StatoElaborato.findOrFail(stato.id)).pesoEvPercento, 20)
  })
})

test.group('Admin · utenti e ruoli', (group) => {
  conTransazione(group)

  test('cambio di ruolo con audit (prima e dopo)', async ({ assert }) => {
    const { b, csrf } = await entra('admin', '/admin/utenti')
    const u = await utente('mec2')
    const r = await b.post(
      `/admin/utenti/${u.id}`,
      { version: String(u.version), ruolo: 'pm', attivo: 'on' },
      HTMX(csrf)
    )
    assert.equal(r.status, 200)
    assert.include(await r.text(), 'salvato')
    assert.equal((await Utente.findOrFail(u.id)).ruolo, 'pm')
    const voce = await AuditLog.query()
      .where('azione', 'utente.ruolo_cambiato')
      .where('entita_id', String(u.id))
      .firstOrFail()
    assert.equal((voce.datiPrima as { ruolo: string }).ruolo, 'progettista')
    assert.equal((voce.datiDopo as { ruolo: string }).ruolo, 'pm')
    assert.equal(voce.entita, 'utenti')
  })

  test('disattivazione e 409 con versione vecchia', async ({ assert }) => {
    const { b, csrf } = await entra('admin', '/admin/utenti')
    const u = await utente('ele2')
    const r1 = await b.post(
      `/admin/utenti/${u.id}`,
      { version: String(u.version), ruolo: 'progettista' },
      HTMX(csrf)
    )
    assert.equal(r1.status, 200)
    assert.isFalse((await Utente.findOrFail(u.id)).attivo)
    const r2 = await b.post(
      `/admin/utenti/${u.id}`,
      { version: String(u.version), ruolo: 'direzione', attivo: 'on' },
      HTMX(csrf)
    )
    assert.equal(r2.status, 409)
    assert.include(await r2.text(), 'data-testid="conflitto"')
    assert.equal((await Utente.findOrFail(u.id)).ruolo, 'progettista')
  })

  test('l’admin non può togliersi il ruolo né disattivarsi; ruolo non previsto', async ({
    assert,
  }) => {
    const { b, csrf } = await entra('admin', '/admin/utenti')
    const io = await utente('admin')
    const r = await b.post(
      `/admin/utenti/${io.id}`,
      { version: String(io.version), ruolo: 'pm' },
      HTMX(csrf)
    )
    assert.equal(r.status, 422)
    const html = await r.text()
    assert.include(html, 'non puoi togliere a te stesso il ruolo di amministratore')
    assert.include(html, 'Non puoi disattivare il tuo stesso utente.')
    const u = await utente('idr1')
    const r2 = await b.post(
      `/admin/utenti/${u.id}`,
      { version: String(u.version), ruolo: 'capo', attivo: 'on' },
      HTMX(csrf)
    )
    assert.equal(r2.status, 422)
    assert.include(await r2.text(), 'Ruolo: valore non previsto.')
  })
})

test.group('Admin · stati e pesi', (group) => {
  conTransazione(group)

  test('modifica del peso: audit, evento, baseline approvata invariata', async ({ assert }) => {
    const { b, csrf } = await entra('admin', '/admin/stati')
    const stato = await StatoElaborato.findByOrFail('codice', 'calcoli')
    const baselinePrima = await db
      .from('baseline')
      .where('stato', 'approvata')
      .select('id', 'pesi_stati', 'bac_minuti', 'version')
    const pvPrima = await db.from('baseline_pv_settimana').orderBy('id').select('pv_minuti')
    const eventi: Evento[] = []
    const smetti = ascoltaEventi((_c, e) => eventi.push(e))
    const r = await b.post(
      `/admin/stati/${stato.id}`,
      {
        version: String(stato.version),
        nome: stato.nome,
        peso_ev_percento: '55',
        colonna_kanban_id: String(stato.colonnaKanbanId),
      },
      HTMX(csrf)
    )
    smetti()
    assert.equal(r.status, 200)
    assert.equal((await StatoElaborato.findOrFail(stato.id)).pesoEvPercento, 55)

    const voce = await AuditLog.query()
      .where('azione', 'stato_elaborato.peso_cambiato')
      .where('entita_id', String(stato.id))
      .firstOrFail()
    assert.equal((voce.datiPrima as { pesoEvPercento: number }).pesoEvPercento, 50)
    assert.equal((voce.datiDopo as { pesoEvPercento: number }).pesoEvPercento, 55)
    assert.isTrue(eventi.some((e) => e.tipo === 'impostazioni.aggiornate'))

    // Le baseline approvate conservano i pesi congelati e il PV
    const baselineDopo = await db
      .from('baseline')
      .where('stato', 'approvata')
      .select('id', 'pesi_stati', 'bac_minuti', 'version')
    assert.deepEqual(baselineDopo, baselinePrima)
    assert.isAbove(baselinePrima.length, 0)
    assert.equal(baselinePrima[0].pesi_stati.calcoli, 50)
    assert.deepEqual(
      await db.from('baseline_pv_settimana').orderBy('id').select('pv_minuti'),
      pvPrima
    )
  })

  test('pesi cumulativi: non possono scendere né superare lo stato dopo', async ({ assert }) => {
    const { b, csrf } = await entra('admin', '/admin/stati')
    const stato = await StatoElaborato.findByOrFail('codice', 'calcoli')
    const invia = (peso: string) =>
      b.post(
        `/admin/stati/${stato.id}`,
        {
          version: String(stato.version),
          nome: stato.nome,
          peso_ev_percento: peso,
          colonna_kanban_id: String(stato.colonnaKanbanId),
        },
        HTMX(csrf)
      )
    let r = await invia('10')
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'non può essere minore di quello di &quot;Impostato&quot; (20%)')
    r = await invia('80')
    assert.equal(r.status, 422)
    assert.include(
      await r.text(),
      'non può essere maggiore di quello di &quot;Emissione interna&quot; (70%)'
    )
    r = await invia('120')
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'Peso EV: il valore massimo è 100.')
    assert.equal((await StatoElaborato.findOrFail(stato.id)).pesoEvPercento, 50)
  })

  test('peso modificato insieme da due admin: 409', async ({ assert }) => {
    const anna = await entra('admin', '/admin/stati')
    const bruno = await entra('admin', '/admin/stati')
    const stato = await StatoElaborato.findByOrFail('codice', 'verificato')
    const campi = (peso: string) => ({
      version: String(stato.version),
      nome: stato.nome,
      peso_ev_percento: peso,
      colonna_kanban_id: String(stato.colonnaKanbanId),
    })
    assert.equal(
      (await anna.b.post(`/admin/stati/${stato.id}`, campi('80'), HTMX(anna.csrf))).status,
      200
    )
    const r = await bruno.b.post(`/admin/stati/${stato.id}`, campi('90'), HTMX(bruno.csrf))
    assert.equal(r.status, 409)
    const html = await r.text()
    assert.include(html, 'Qualcun altro ha modificato questo dato')
    assert.include(html, 'value="80"')
    assert.equal((await StatoElaborato.findOrFail(stato.id)).pesoEvPercento, 80)
  })
})

test.group('Admin · colonne, discipline, cause', (group) => {
  conTransazione(group)

  test('limite WIP di default: modifica, vuoto = nessun limite, validazione', async ({
    assert,
  }) => {
    const { b, csrf } = await entra('admin', '/admin/colonne')
    const col = await ColonnaKanban.findByOrFail('codice', 'in_verifica')
    let r = await b.post(
      `/admin/colonne/${col.id}`,
      { version: String(col.version), nome: col.nome, limite_wip_default: '5' },
      HTMX(csrf)
    )
    assert.equal(r.status, 200)
    assert.equal((await ColonnaKanban.findOrFail(col.id)).limiteWipDefault, 5)
    r = await b.post(
      `/admin/colonne/${col.id}`,
      { version: String(col.version + 1), nome: col.nome, limite_wip_default: '' },
      HTMX(csrf)
    )
    assert.equal(r.status, 200)
    assert.isNull((await ColonnaKanban.findOrFail(col.id)).limiteWipDefault)
    r = await b.post(
      `/admin/colonne/${col.id}`,
      { version: String(col.version + 2), nome: '', limite_wip_default: '0' },
      HTMX(csrf)
    )
    assert.equal(r.status, 422)
    const html = await r.text()
    assert.include(html, 'Nome: campo obbligatorio.')
    assert.include(html, 'Limite WIP: il valore minimo è 1.')
    assert.lengthOf(await AuditLog.query().where('azione', 'colonna_kanban.aggiornata'), 2)
  })

  test('nuova disciplina, codice duplicato, disattivazione', async ({ assert }) => {
    const { b, csrf } = await entra('admin', '/admin/discipline')
    let r = await b.post('/admin/discipline', {
      _csrf: csrf,
      codice: 'reg',
      nome: 'Regolazione',
      ordine: '5',
    })
    assert.equal(r.status, 302)
    const d = await Disciplina.findByOrFail('codice', 'REG')
    assert.equal(d.nome, 'Regolazione')
    await AuditLog.query().where('azione', 'disciplina.creata').firstOrFail()

    r = await b.post('/admin/discipline', { _csrf: csrf, codice: 'MEC', nome: 'Doppione' })
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'Codice: MEC esiste già.')

    r = await b.post(
      `/admin/discipline/${d.id}`,
      { version: String(d.version), nome: 'Regolazione e BMS', ordine: '5' },
      HTMX(csrf)
    )
    assert.equal(r.status, 200)
    const ora = await Disciplina.findOrFail(d.id)
    assert.isFalse(ora.attiva)
    assert.equal(ora.nome, 'Regolazione e BMS')
  })

  test('cause: nuova causa con codice normalizzato e modifica', async ({ assert }) => {
    const { b, csrf } = await entra('admin', '/admin/cause')
    const r = await b.post('/admin/cause', {
      _csrf: csrf,
      codice: 'Meteo avverso',
      nome: 'Meteo avverso in cantiere',
      ordine: '9',
    })
    assert.equal(r.status, 302)
    const c = await CausaNonCompletamento.findByOrFail('codice', 'meteo_avverso')
    const r2 = await b.post(
      `/admin/cause/${c.id}`,
      { version: String(c.version), nome: 'Sopralluogo rinviato', ordine: '9', attiva: 'on' },
      HTMX(csrf)
    )
    assert.equal(r2.status, 200)
    assert.equal((await CausaNonCompletamento.findOrFail(c.id)).nome, 'Sopralluogo rinviato')
    const r3 = await b.post('/admin/cause', { _csrf: csrf, codice: '', nome: '' })
    assert.equal(r3.status, 422)
    assert.include(await r3.text(), 'Codice: campo obbligatorio.')
  })
})

test.group('Admin · commesse', (group) => {
  conTransazione(group)

  test('crea una commessa con PM nel team, audit e redirezione all’anagrafica', async ({
    assert,
  }) => {
    const { b, csrf } = await entra('admin', '/admin/commesse')
    const pm2 = await utente('pm2')
    const r = await b.post('/admin/commesse', {
      _csrf: csrf,
      codice: 'CL-2026-040',
      nome: 'Ospedale – ampliamento',
      cliente: 'ASL (esempio)',
      pm_id: String(pm2.id),
      data_inizio: '01/10/2026',
      data_fine_prevista: '2027-03-31',
    })
    assert.equal(r.status, 302)
    const c = await Commessa.findByOrFail('codice', 'CL-2026-040')
    assert.equal(r.headers.get('location'), `/commesse/${c.id}/anagrafica`)
    assert.equal(c.dataInizio, '2026-10-01')
    assert.equal(c.stato, 'attiva')
    const m = await db.from('membri_commessa').where('commessa_id', c.id).firstOrFail()
    assert.equal(m.utente_id, pm2.id)
    assert.equal(m.ruolo_commessa, 'pm')
    await AuditLog.query()
      .where('azione', 'commessa.creata')
      .where('commessa_id', c.id)
      .firstOrFail()
    const pagina = await (await b.vai(r.headers.get('location')!)).text()
    assert.include(pagina, 'Commessa CL-2026-040 creata')
  })

  test('codice duplicato e campi obbligatori: 422 in italiano', async ({ assert }) => {
    const { b, csrf } = await entra('admin', '/admin/commesse')
    const r = await b.post('/admin/commesse', {
      _csrf: csrf,
      codice: 'CL-2026-031',
      nome: '',
      data_inizio: '2026-10-10',
      data_fine_prevista: '2026-10-01',
    })
    assert.equal(r.status, 422)
    const html = await r.text()
    assert.include(html, 'Codice: esiste già una commessa CL-2026-031.')
    assert.include(html, 'Nome: campo obbligatorio.')
    assert.include(html, 'Fine prevista: non può precedere la data di inizio.')
  })
})
