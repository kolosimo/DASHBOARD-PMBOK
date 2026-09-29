/**
 * Scheda elaborato /commesse/:id/elaborati/:elaboratoId: dati, stato e storico,
 * ore (per persona solo con vedeOrePerPersona), EVM, vincoli e impegni,
 * cambio di stato tramite il servizio del flusso; percorso scheda → Kanban → EVM.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import Elaborato from '#models/elaborato'
import StatoElaborato from '#models/stato_elaborato'
import AuditLog from '#models/audit_log'
import Impostazione from '#models/impostazione'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

async function scuola() {
  return Commessa.findByOrFail('codice', 'CL-2026-031')
}
async function elaborato(codice: string) {
  return Elaborato.findByOrFail('codice', codice)
}
const urlScheda = (commessaId: number, elaboratoId: number) =>
  `/commesse/${commessaId}/elaborati/${elaboratoId}`
const htmx = (csrf: string) => ({ 'hx-request': 'true', 'x-csrf-token': csrf })

/** Browser loggato sulla scheda, con il token CSRF */
async function apri(come: string, commessaId: number, elaboratoId: number) {
  const b = new Browser()
  await b.loginSviluppo(come)
  const r = await b.vai(urlScheda(commessaId, elaboratoId))
  const html = await r.text()
  return { b, r, html, csrf: r.status === 200 ? Browser.csrfDa(html) : '' }
}

/** Testo senza spazi ripetuti, per confronti sul contenuto */
const piatto = (html: string) => html.replace(/\s+/g, ' ')

test.group('Scheda elaborato · lettura', (group) => {
  conTransazione(group)

  test('il PM vede dati, stato, storico, ore, EVM, vincoli, impegni e collegamenti', async ({
    assert,
  }) => {
    const c = await scuola()
    const el = await elaborato('ELE-SC-201')
    const { r, html } = await apri('pm1', c.id, el.id)
    assert.equal(r.status, 200)
    const t = piatto(html)
    assert.include(t, 'ELE-SC-201')
    assert.include(html, 'data-testid="dati-elaborato"')
    assert.include(html, 'data-testid="kpi-elaborato"')
    assert.include(t, 'Impianti elettrici')
    // storico: almeno la transizione allo stato attuale
    assert.include(html, 'data-testid="storico-transizioni"')
    const stato = await StatoElaborato.findOrFail(el.statoId)
    assert.include(t, `Stato: ${stato.nome}`)
    // ore: 11 h registrate da ele1 in W39 (dati di esempio)
    const [{ totale }] = await db
      .from('registrazioni_ore')
      .where('elaborato_id', el.id)
      .sum('minuti as totale')
    const oreAttese = Number(totale) / 60
    assert.include(t, `${String(oreAttese).replace('.', ',')} h`)
    assert.include(html, 'data-testid="ore-settimanali"')
    // per persona: il PM le vede (impostazione attiva di default)
    assert.include(html, 'data-testid="ore-per-persona"')
    assert.include(t, 'Progettista ELE 1')
    // EVM, semafori SPI/CPI e LPS
    assert.include(html, 'data-testid="evm-elaborato"')
    assert.match(html, /class="pill (g|w|c|n) "/)
    assert.include(t, 'V-13')
    assert.include(t, 'Schema quadro elettrico generale')
    assert.include(t, 'non fatto')
    assert.include(html, 'data-testid="attivita-elaborato"')
    // collegamenti e cambio di stato
    assert.include(html, `href="/commesse/${c.id}/flusso"`)
    assert.include(html, `href="/commesse/${c.id}/evm"`)
    assert.include(html, `href="/commesse/${c.id}/elaborati/${el.id}/modifica"`)
    assert.include(html, 'data-testid="form-avanza"')
    assert.include(html, 'data-testid="form-indietro"')
    // tempo reale
    assert.include(html, 'hx-trigger="evento-commessa from:body, polling-commessa from:body"')
  })

  test('direzione: nessuna ora per persona, nessun cambio di stato', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('ELE-SC-201')
    const { r, html } = await apri('direzione', c.id, el.id)
    assert.equal(r.status, 200)
    assert.notInclude(html, 'data-testid="ore-per-persona"')
    assert.notInclude(html, 'data-testid="form-avanza"')
    assert.include(html, 'data-testid="sola-lettura"')
    assert.include(html, 'data-testid="ore-settimanali"')
    assert.notInclude(html, '/modifica"')
  })

  test('progettista: cambia stato ma non vede le ore per persona', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('ELE-SC-201')
    const { r, html } = await apri('ele1', c.id, el.id)
    assert.equal(r.status, 200)
    assert.notInclude(html, 'data-testid="ore-per-persona"')
    assert.include(html, 'data-testid="form-avanza"')
  })

  test('con le ore per persona disattivate neanche il PM le vede', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('ELE-SC-201')
    await Impostazione.query()
      .where('chiave', 'ore.per_persona_visibili')
      .update({ valore: 'false' })
    const { html } = await apri('pm1', c.id, el.id)
    assert.notInclude(html, 'data-testid="ore-per-persona"')
  })

  test('elaborato senza ore né vincoli: valori n.d. e messaggi vuoti', async ({ assert }) => {
    const c = await scuola()
    const { b, csrf } = await apri('pm1', c.id, (await elaborato('ELE-SC-201')).id)
    await b.post(`/commesse/${c.id}/elaborati/import`, {
      _csrf: csrf,
      testo: 'B4-VUOTO\tTavola senza ore\tMEC\t0',
    })
    const nuovo = await elaborato('B4-VUOTO')
    const r = await b.vai(urlScheda(c.id, nuovo.id))
    assert.equal(r.status, 200)
    const t = piatto(await r.text())
    assert.include(t, 'Nessuna ora registrata.')
    assert.include(t, 'Nessun vincolo sulle attività di questo elaborato.')
    assert.include(t, 'Nessun impegno su questo elaborato.')
    assert.include(t, '(n.d.)') // consumo del budget con budget 0
    assert.include(t, 'fuori baseline')
    assert.include(t, 'creazione') // transizione di nascita nello storico
  })

  test('chi non è membro riceve 403, un elaborato di altra commessa 404', async ({ assert }) => {
    const c = await scuola()
    const uffici = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const el = await elaborato('ELE-SC-201')
    const { r } = await apri('mec1', uffici.id, el.id)
    assert.equal(r.status, 403)
    const admin = await apri('admin', uffici.id, el.id)
    assert.equal(admin.r.status, 404)
    const inesistente = await apri('pm1', c.id, 999999)
    assert.equal(inesistente.r.status, 404)
  })

  test('frammento per il tempo reale', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('ELE-SC-201')
    const { b } = await apri('pm1', c.id, el.id)
    const r = await b.get(`${urlScheda(c.id, el.id)}/frammento`, { 'hx-request': 'true' })
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.match(html.trim(), /^<div\s+id="scheda-elaborato"/)
    assert.notInclude(html, '<html')
  })

  test('link alla scheda da Kanban, EVM e anagrafica', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('ELE-SC-201')
    const b = new Browser()
    await b.loginSviluppo('pm1')
    const link = `href="/commesse/${c.id}/elaborati/${el.id}"`
    for (const pagina of ['flusso', 'evm', 'anagrafica']) {
      const html = await (await b.vai(`/commesse/${c.id}/${pagina}`)).text()
      assert.include(html, link, pagina)
    }
  })
})

test.group('Scheda elaborato · cambio di stato', (group) => {
  conTransazione(group)

  test('avanti via HTMX: frammento, transizione nello storico, audit', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-102')
    const { b, csrf, html } = await apri('mec1', c.id, el.id)
    const aStato = html.match(
      /data-testid="form-avanza"[\s\S]*?name="a_stato_id" value="(\d+)"/
    )![1]
    const r = await b.post(
      `${urlScheda(c.id, el.id)}/stato`,
      { version: String(el.version), a_stato_id: aStato },
      htmx(csrf)
    )
    assert.equal(r.status, 200)
    assert.include(r.headers.get('hx-trigger') ?? '', 'MEC-PL-102')
    const frammento = await r.text()
    assert.match(frammento.trim(), /^<div\s+id="scheda-elaborato"/)
    assert.include(piatto(frammento), 'Stato: Calcoli e dimensionamento')
    assert.include(frammento, 'data-testid="messaggio-scheda"')

    const ora = await Elaborato.findOrFail(el.id)
    assert.equal(ora.statoId, Number(aStato))
    assert.equal(ora.version, el.version + 1)
    const t = await db
      .from('transizioni_elaborato')
      .where('elaborato_id', el.id)
      .orderBy('id', 'desc')
      .firstOrFail()
    assert.equal(t.da_stato_id, el.statoId)
    assert.equal(t.a_stato_id, Number(aStato))
    await AuditLog.query()
      .where('azione', 'elaborato.stato_cambiato')
      .where('entita_id', String(el.id))
      .firstOrFail()
  })

  test('indietro senza motivo: 422; con motivo: 200 e motivo nello storico', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('ELE-SC-201')
    const { b, csrf, html } = await apri('ele1', c.id, el.id)
    const aStato = html.match(
      /data-testid="form-indietro"[\s\S]*?name="a_stato_id" value="(\d+)"/
    )![1]
    const r1 = await b.post(
      `${urlScheda(c.id, el.id)}/stato`,
      { version: String(el.version), a_stato_id: aStato },
      htmx(csrf)
    )
    assert.equal(r1.status, 422)
    const html1 = await r1.text()
    assert.include(html1, 'data-testid="errore-scheda"')
    assert.include(html1, 'serve un motivo')
    assert.equal((await Elaborato.findOrFail(el.id)).version, el.version)

    const r2 = await b.post(
      `${urlScheda(c.id, el.id)}/stato`,
      { version: String(el.version), a_stato_id: aStato, motivo: 'Cambiati i carichi' },
      htmx(csrf)
    )
    assert.equal(r2.status, 200)
    const html2 = await r2.text()
    assert.include(html2, 'Cambiati i carichi')
    assert.include(html2, 'indietro')
  })

  test('salto di stato: 422 senza modifiche', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-102')
    const emesso = await StatoElaborato.findByOrFail('codice', 'emesso_cliente')
    const { b, csrf } = await apri('pm1', c.id, el.id)
    const r = await b.post(
      `${urlScheda(c.id, el.id)}/stato`,
      { version: String(el.version), a_stato_id: String(emesso.id) },
      htmx(csrf)
    )
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'uno stato alla volta')
    assert.equal((await Elaborato.findOrFail(el.id)).statoId, el.statoId)
  })

  test('sforamento WIP: chiede conferma e motivo, poi passa e registra', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-101') // Calcoli → Emissione interna (In verifica 3/3)
    const { b, csrf, html } = await apri('pm1', c.id, el.id)
    const aStato = html.match(
      /data-testid="form-avanza"[\s\S]*?name="a_stato_id" value="(\d+)"/
    )![1]
    const r1 = await b.post(
      `${urlScheda(c.id, el.id)}/stato`,
      { version: String(el.version), a_stato_id: aStato },
      htmx(csrf)
    )
    assert.equal(r1.status, 422)
    const html1 = await r1.text()
    assert.include(html1, 'data-testid="conferma-wip"')
    assert.include(html1, 'limite WIP 3')

    const r2 = await b.post(
      `${urlScheda(c.id, el.id)}/stato`,
      {
        version: String(el.version),
        a_stato_id: aStato,
        conferma_wip: '1',
        motivo: 'Emissione richiesta dal cliente',
      },
      htmx(csrf)
    )
    assert.equal(r2.status, 200)
    assert.include(r2.headers.get('hx-trigger') ?? '', 'limite WIP superato')
    assert.include(await r2.text(), 'oltre WIP')
    const voce = await AuditLog.query().where('azione', 'kanban.wip_sforato').firstOrFail()
    assert.equal(voce.entitaId, String(el.id))
  })

  test('versione vecchia: 409 con la scheda aggiornata', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-110')
    const anna = await apri('mec2', c.id, el.id)
    const bruno = await apri('pm1', c.id, el.id)
    const aStato = anna.html.match(
      /data-testid="form-indietro"[\s\S]*?name="a_stato_id" value="(\d+)"/
    )![1]
    const r1 = await anna.b.post(
      `${urlScheda(c.id, el.id)}/stato`,
      { version: String(el.version), a_stato_id: aStato, motivo: 'rilavorazione' },
      htmx(anna.csrf)
    )
    assert.equal(r1.status, 200)
    const r2 = await bruno.b.post(
      `${urlScheda(c.id, el.id)}/stato`,
      { version: String(el.version), a_stato_id: aStato, motivo: 'altro motivo' },
      htmx(bruno.csrf)
    )
    assert.equal(r2.status, 409)
    const html = await r2.text()
    assert.include(html, 'data-testid="conflitto"')
    assert.include(html, 'id="scheda-elaborato"')
    assert.equal((await Elaborato.findOrFail(el.id)).version, el.version + 1)
  })

  test('osservatore e direzione: 403 sulla POST', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-102')
    for (const come of ['pm2', 'direzione']) {
      const { b, csrf } = await apri(come, c.id, el.id)
      const r = await b.post(
        `${urlScheda(c.id, el.id)}/stato`,
        { version: String(el.version), a_stato_id: String(el.statoId) },
        htmx(csrf)
      )
      assert.equal(r.status, 403, come)
    }
    assert.equal((await Elaborato.findOrFail(el.id)).version, el.version)
  })

  test('senza HTMX: redirect alla scheda con il messaggio', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-102')
    const { b, csrf, html } = await apri('pm1', c.id, el.id)
    const aStato = html.match(
      /data-testid="form-avanza"[\s\S]*?name="a_stato_id" value="(\d+)"/
    )![1]
    const r = await b.post(`${urlScheda(c.id, el.id)}/stato`, {
      _csrf: csrf,
      version: String(el.version),
      a_stato_id: aStato,
    })
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), urlScheda(c.id, el.id))
    const pagina = await (await b.vai(urlScheda(c.id, el.id))).text()
    assert.include(pagina, 'data-testid="messaggio-scheda"')
    assert.include(piatto(pagina), 'MEC-PL-102: calcoli e dimensionamento')
  })
})

test.group('Scheda elaborato · percorso scheda → Kanban → EVM', (group) => {
  conTransazione(group)

  test('dopo il cambio di stato Kanban ed EVM mostrano lo stesso stato e lo stesso EV', async ({
    assert,
  }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-102')
    const { b, csrf, html } = await apri('pm1', c.id, el.id)
    const evPrima = html.match(
      /data-testid="evm-elaborato"[\s\S]*?EV ·[^<]*<\/th><td[^>]*>([^<]+)</
    )
    const aStato = html.match(
      /data-testid="form-avanza"[\s\S]*?name="a_stato_id" value="(\d+)"/
    )![1]
    const r = await b.post(
      `${urlScheda(c.id, el.id)}/stato`,
      { version: String(el.version), a_stato_id: aStato },
      htmx(csrf)
    )
    assert.equal(r.status, 200)
    const scheda = piatto(await r.text())
    const evDopo = scheda.match(
      /data-testid="evm-elaborato"[\s\S]*?EV ·[^<]*<\/th> ?<td[^>]*>([^<]+)</
    )
    assert.isNotNull(evPrima)
    assert.isNotNull(evDopo)
    assert.notEqual(evPrima![1].trim(), evDopo![1].trim())

    // Kanban: la scheda è nello stato nuovo
    const kanban = piatto(await (await b.vai(`/commesse/${c.id}/flusso`)).text())
    const blocco = kanban.match(/data-testid="scheda-MEC-PL-102"[\s\S]*?<\/div> ?<\/div>/)
    assert.isNotNull(blocco)
    assert.include(kanban, 'Calcoli e dimensionamento')

    // EVM: la riga dell'elaborato ha lo stesso EV della scheda
    const evm = piatto(await (await b.vai(`/commesse/${c.id}/evm`)).text())
    const riga = evm.match(/data-testid="link-scheda-MEC-PL-102"[\s\S]*?<\/tr>/)
    assert.isNotNull(riga)
    assert.include(riga![0], 'Calcoli e dimensionamento')
    assert.include(riga![0], evDopo![1].trim())
  })

  test('pagina EVM: griglia KPI dedicata a 3 colonne (nessun riquadro vuoto)', async ({
    assert,
  }) => {
    const c = await scuola()
    const b = new Browser()
    await b.loginSviluppo('pm1')
    const html = await (await b.vai(`/commesse/${c.id}/evm`)).text()
    assert.include(html, 'class="kpis kpis-evm"')
    assert.match(html, /\.kpis\.kpis-evm\s*\{\s*grid-template-columns:\s*repeat\(3,/)
    const kpi = html.match(
      /data-testid="kpi-evm">([\s\S]*?)<\/div>\s*(@|<div class="panel|<\/div>)/
    )
    assert.isNotNull(kpi)
    // 9 riquadri = 3 righe piene da 3
    const n = (
      html
        .split('data-testid="kpi-evm"')[1]
        .split('class="panel')[0]
        .match(/class="kpi"/g) ?? []
    ).length
    assert.equal(n % 3, 0)
    assert.equal(n, 9)
  })
})
