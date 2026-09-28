/**
 * Kanban via HTTP: pagina, permessi, frecce, drag&drop, conferma WIP, 409.
 */
import { test } from '@japa/runner'
import Commessa from '#models/commessa'
import Elaborato from '#models/elaborato'
import StatoElaborato from '#models/stato_elaborato'
import ColonnaKanban from '#models/colonna_kanban'
import AuditLog from '#models/audit_log'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

async function scuola() {
  return Commessa.findByOrFail('codice', 'CL-2026-031')
}
async function elaborato(codice: string) {
  return Elaborato.findByOrFail('codice', codice)
}

/** Browser loggato con il token CSRF della pagina Kanban */
async function apri(come: string, commessaId: number) {
  const b = new Browser()
  await b.loginSviluppo(come)
  const r = await b.vai(`/commesse/${commessaId}/flusso`)
  const html = await r.text()
  return { b, r, html, csrf: r.status === 200 ? Browser.csrfDa(html) : '' }
}

const htmx = (csrf: string) => ({ 'hx-request': 'true', 'x-csrf-token': csrf })
const urlSposta = (commessaId: number, elaboratoId: number) =>
  `/commesse/${commessaId}/flusso/elaborati/${elaboratoId}/stato`

test.group('Flusso · pagina Kanban', (group) => {
  conTransazione(group)

  test('il PM vede colonne, WIP oltre il limite, schede, classi, throughput e CFD', async ({
    assert,
  }) => {
    const c = await scuola()
    const { r, html } = await apri('pm1', c.id)
    assert.equal(r.status, 200)
    assert.include(html, 'Kanban di commessa')
    for (const col of ['da_fare', 'in_corso', 'in_verifica', 'emesso']) {
      assert.include(html, `data-testid="colonna-${col}"`)
    }
    // In corso: 5 elaborati con limite 4 → colonna evidenziata
    assert.match(html, /class="col over"[^>]*data-testid="colonna-in_corso"/)
    assert.include(html, 'oltre il limite WIP')
    assert.include(html, 'data-testid="scheda-ELE-SC-201"')
    assert.include(html, 'data fissa 30/09')
    assert.include(html, 'draggable="true"')
    assert.include(html, 'aria-label="Porta MEC-PL-102 allo stato successivo"')
    assert.include(html, 'data-testid="grafico-throughput"')
    assert.include(html, 'data-testid="grafico-cfd"')
    assert.include(html, 'hx-trigger="evento-commessa from:body, polling-commessa from:body"')
  })

  test('osservatore e direzione vedono la board in sola lettura', async ({ assert }) => {
    const c = await scuola()
    for (const come of ['pm2', 'direzione']) {
      const { r, html } = await apri(come, c.id)
      assert.equal(r.status, 200, come)
      assert.include(html, 'data-testid="scheda-MEC-PL-102"')
      assert.notInclude(html, 'draggable="true"', come)
      assert.notInclude(html, 'allo stato successivo', come)
      assert.include(html, 'sola lettura')
    }
  })

  test('chi non è membro riceve 403', async ({ assert }) => {
    const uffici = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const { r } = await apri('mec1', uffici.id)
    assert.equal(r.status, 403)
  })

  test('frammento per il tempo reale', async ({ assert }) => {
    const c = await scuola()
    const { b } = await apri('mec1', c.id)
    const r = await b.get(`/commesse/${c.id}/flusso/frammento`, { 'hx-request': 'true' })
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.match(html.trim(), /^<div\s+id="flusso"/)
    assert.notInclude(html, '<html')
  })
})

test.group('Flusso · spostamenti via HTTP', (group) => {
  conTransazione(group)

  test('freccia avanti del progettista: 200, frammento aggiornato e toast', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-102')
    const { b, csrf } = await apri('mec1', c.id)
    const r = await b.post(
      urlSposta(c.id, el.id),
      { version: String(el.version), verso: 'avanti' },
      htmx(csrf)
    )
    assert.equal(r.status, 200)
    assert.include(r.headers.get('hx-trigger') ?? '', 'MEC-PL-102: calcoli e dimensionamento')
    const html = await r.text()
    assert.include(html, 'id="flusso"')
    const ora = await Elaborato.findOrFail(el.id)
    assert.equal(ora.version, el.version + 1)
    assert.equal((await StatoElaborato.findOrFail(ora.statoId)).codice, 'calcoli')
  })

  test('freccia indietro: senza motivo 422, con motivo 200', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('ELE-SC-201')
    const { b, csrf } = await apri('ele1', c.id)
    const r1 = await b.post(
      urlSposta(c.id, el.id),
      { version: String(el.version), verso: 'indietro' },
      htmx(csrf)
    )
    assert.equal(r1.status, 422)
    const html1 = await r1.text()
    assert.include(html1, 'data-testid="errore-flusso"')
    assert.include(html1, 'serve un motivo')
    const r2 = await b.post(
      urlSposta(c.id, el.id),
      { version: String(el.version), verso: 'indietro', motivo: 'Cambiati i carichi' },
      htmx(csrf)
    )
    assert.equal(r2.status, 200)
  })

  test('salto di stato con a_stato_id: 422', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-102')
    const emesso = await StatoElaborato.findByOrFail('codice', 'emesso_cliente')
    const { b, csrf } = await apri('pm1', c.id)
    const r = await b.post(
      urlSposta(c.id, el.id),
      { version: String(el.version), a_stato_id: String(emesso.id) },
      htmx(csrf)
    )
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'uno stato alla volta')
    assert.equal((await Elaborato.findOrFail(el.id)).statoId, el.statoId)
  })

  test('drag&drop: colonna coerente avanza, colonna non coerente dà un messaggio', async ({
    assert,
  }) => {
    const c = await scuola()
    const inVerifica = await ColonnaKanban.findByOrFail('codice', 'in_verifica')
    const emesso = await ColonnaKanban.findByOrFail('codice', 'emesso')
    const { b, csrf } = await apri('pm1', c.id)

    // Impostato (In corso) → In verifica: prima va completato "Calcoli e dimensionamento"
    const idr = await elaborato('IDR-PL-301')
    const r1 = await b.post(
      urlSposta(c.id, idr.id),
      { version: String(idr.version), colonna: String(inVerifica.id) },
      htmx(csrf)
    )
    assert.equal(r1.status, 422)
    const html1 = await r1.text()
    assert.include(html1, 'IDR-PL-301: si sposta uno stato alla volta')
    assert.include(html1, 'Calcoli e dimensionamento')
    // Anche come toast: i caratteri non ASCII sono codificati nell'intestazione
    const evento = JSON.parse(r1.headers.get('hx-trigger') ?? '{}') as { toast?: string }
    assert.include(evento.toast ?? '', 'freccia →')

    // Verificato (In verifica) → Emesso: coerente
    const ant = await elaborato('ANT-RT-401')
    const r2 = await b.post(
      urlSposta(c.id, ant.id),
      { version: String(ant.version), colonna: String(emesso.id) },
      htmx(csrf)
    )
    assert.equal(r2.status, 200)
    const ora = await Elaborato.findOrFail(ant.id)
    assert.equal((await StatoElaborato.findOrFail(ora.statoId)).codice, 'emesso_cliente')
  })

  test('sforamento WIP: chiede conferma, poi con motivo sposta e registra', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-101') // Calcoli → Emissione interna (In verifica 3/3)
    const { b, csrf } = await apri('pm1', c.id)
    const r1 = await b.post(
      urlSposta(c.id, el.id),
      { version: String(el.version), verso: 'avanti' },
      htmx(csrf)
    )
    assert.equal(r1.status, 422)
    const html1 = await r1.text()
    assert.include(html1, 'data-testid="conferma-wip"')
    assert.include(html1, 'limite WIP 3')
    const aStato = html1.match(/name="a_stato_id" value="(\d+)"/)![1]

    const r2 = await b.post(
      urlSposta(c.id, el.id),
      {
        version: String(el.version),
        a_stato_id: aStato,
        conferma_wip: '1',
        motivo: 'Emissione richiesta per la riunione di coordinamento',
      },
      htmx(csrf)
    )
    assert.equal(r2.status, 200)
    assert.include(r2.headers.get('hx-trigger') ?? '', 'limite WIP superato')
    // In verifica ora è oltre il limite
    assert.match(await r2.text(), /class="col over"[^>]*data-testid="colonna-in_verifica"/)
    const voce = await AuditLog.query().where('azione', 'kanban.wip_sforato').firstOrFail()
    assert.equal(voce.entitaId, String(el.id))
  })

  test('doppio spostamento concorrente: il secondo riceve 409 con la board aggiornata', async ({
    assert,
  }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-110')
    const anna = await apri('mec2', c.id)
    const bruno = await apri('pm1', c.id)
    const r1 = await anna.b.post(
      urlSposta(c.id, el.id),
      { version: String(el.version), verso: 'indietro', motivo: 'rilavorazione' },
      htmx(anna.csrf)
    )
    assert.equal(r1.status, 200)
    const r2 = await bruno.b.post(
      urlSposta(c.id, el.id),
      { version: String(el.version), verso: 'avanti' },
      htmx(bruno.csrf)
    )
    assert.equal(r2.status, 409)
    const html = await r2.text()
    assert.include(html, 'data-testid="conflitto"')
    assert.include(html, 'id="flusso"')
    assert.include(r2.headers.get('hx-trigger') ?? '', 'conflitto')
    const ora = await Elaborato.findOrFail(el.id)
    assert.equal(ora.version, el.version + 1)
    assert.equal((await StatoElaborato.findOrFail(ora.statoId)).codice, 'impostato')
  })

  test('osservatore e direzione non possono spostare (403)', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-102')
    for (const come of ['pm2', 'direzione']) {
      const { b, csrf } = await apri(come, c.id)
      const r = await b.post(
        urlSposta(c.id, el.id),
        { version: String(el.version), verso: 'avanti' },
        htmx(csrf)
      )
      assert.equal(r.status, 403, come)
    }
    assert.equal((await Elaborato.findOrFail(el.id)).version, el.version)
  })

  test('elaborato di un’altra commessa: 404', async ({ assert }) => {
    const uffici = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const el = await elaborato('MEC-PL-102')
    const { b, csrf } = await apri('admin', uffici.id)
    const r = await b.post(
      urlSposta(uffici.id, el.id),
      { version: String(el.version), verso: 'avanti' },
      htmx(csrf)
    )
    assert.equal(r.status, 404)
  })

  test('senza HTMX: dopo lo spostamento torna alla pagina Kanban', async ({ assert }) => {
    const c = await scuola()
    const el = await elaborato('MEC-PL-102')
    const { b, csrf } = await apri('pm1', c.id)
    const r = await b.post(urlSposta(c.id, el.id), {
      _csrf: csrf,
      version: String(el.version),
      verso: 'avanti',
    })
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), `/commesse/${c.id}/flusso`)
  })
})
