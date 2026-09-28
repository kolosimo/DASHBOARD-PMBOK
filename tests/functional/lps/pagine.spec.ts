/**
 * LPS · pagine: piano settimanale e lookahead con i dati di esempio.
 */
import { test } from '@japa/runner'
import Commessa from '#models/commessa'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

const W39 = '2026-09-21'
const W40 = '2026-09-28'

async function scuola() {
  return Commessa.findByOrFail('codice', 'CL-2026-031')
}

test.group('LPS · piano settimanale (pagina)', (group) => {
  conTransazione(group)

  test('W39: 7 impegni, PPC 71%, grafici SVG e Pareto', async ({ assert }) => {
    const c = await scuola()
    const b = new Browser()
    await b.loginSviluppo('pm1')
    const r = await b.vai(`/commesse/${c.id}/lps/settimana?settimana=${W39}`)
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'Piano settimanale – settimana W39')
    assert.include(html, '71%')
    assert.include(html, '5 di 7 impegni mantenuti')
    assert.include(html, 'Completare dimensionamento radiatori PT')
    assert.include(html, 'data-grafico="ppc"')
    assert.include(html, 'data-grafico="pareto"')
    // Pareto W31–W39: input mancante 9 + 1 = 10 in testa
    assert.match(html, /Input mancante da altri: 10/)
    // storico: W31 50%
    assert.include(html, 'W31: PPC 50%')
    // PM: può promettere/chiudere e segnare
    assert.include(html, 'data-testid="chiudi"')
  })

  test('settimana senza piano: il PM può prepararlo, il progettista no', async ({ assert }) => {
    const c = await scuola()
    const pm = new Browser()
    await pm.loginSviluppo('pm1')
    const html = await (await pm.vai(`/commesse/${c.id}/lps/settimana?settimana=${W40}`)).text()
    assert.include(html, 'data-testid="nessun-piano"')
    assert.include(html, 'data-testid="crea-piano"')

    const mec = new Browser()
    await mec.loginSviluppo('mec1')
    const html2 = await (await mec.vai(`/commesse/${c.id}/lps/settimana?settimana=${W40}`)).text()
    assert.include(html2, 'data-testid="nessun-piano"')
    assert.notInclude(html2, 'data-testid="crea-piano"')
  })

  test('il progettista vede i moduli di esito solo sulle proprie righe', async ({ assert }) => {
    const c = await scuola()
    const b = new Browser()
    await b.loginSviluppo('mec1')
    const html = await (await b.vai(`/commesse/${c.id}/lps/settimana?settimana=${W39}`)).text()
    // mec1 ha 2 impegni in W39
    assert.equal((html.match(/id="esito-/g) ?? []).length, 2)
    assert.notInclude(html, 'data-testid="chiudi"')
  })

  test('non membro: 403', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const b = new Browser()
    await b.loginSviluppo('mec1')
    const r = await b.get(`/commesse/${c.id}/lps/settimana`)
    assert.equal(r.status, 403)
  })

  test('frammento HTMX del piano', async ({ assert }) => {
    const c = await scuola()
    const b = new Browser()
    await b.loginSviluppo('pm2')
    const r = await b.get(`/commesse/${c.id}/lps/settimana/frammento?settimana=${W39}`, {
      'hx-request': 'true',
    })
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.match(html.trim(), /^<div\s+id="piano-lps"/)
    assert.notInclude(html, '<html')
  })
})

test.group('LPS · lookahead (pagina)', (group) => {
  conTransazione(group)

  test('W40–W45: attività, disciplina, stato calcolato e registro vincoli', async ({ assert }) => {
    const c = await scuola()
    const b = new Browser()
    await b.loginSviluppo('pm1')
    const r = await b.vai(`/commesse/${c.id}/lps/lookahead?da=${W40}`)
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'Lookahead a 6 settimane')
    for (const w of ['W40', 'W41', 'W42', 'W43', 'W44', 'W45']) assert.include(html, w)
    // L1 vincolata da V-12, L3 pronta (V-17 rimosso)
    const riga = (codice: string) => {
      const i = html.indexOf(`data-testid="attivita-${codice}"`)
      return html.slice(i, html.indexOf('</tr>', i))
    }
    assert.include(riga('L1'), 'vincolata')
    assert.include(riga('L1'), 'V-12')
    assert.include(riga('L1'), 'MEC')
    assert.include(riga('L3'), 'pronta')
    assert.include(riga('M1'), 'milestone')
    // PCR W40: denominatore 3, nessuna rimozione → 0%
    assert.include(html, '0 di 3 vincoli in scadenza nella settimana rimossi')
    assert.include(html, 'data-testid="vincolo-V-16"')
    assert.include(html, 'data-testid="rimuovi-V-12"')
  })

  test('filtro "solo aperti" nasconde i vincoli rimossi', async ({ assert }) => {
    const c = await scuola()
    const b = new Browser()
    await b.loginSviluppo('mec1')
    const html = await (
      await b.vai(`/commesse/${c.id}/lps/lookahead?da=${W40}&filtro=aperti`)
    ).text()
    assert.notInclude(html, 'data-testid="vincolo-V-17"')
    assert.include(html, 'data-testid="vincolo-V-12"')
    // il progettista non gestisce il lookahead
    assert.notInclude(html, 'data-testid="rimuovi-V-12"')
    assert.notInclude(html, 'Nuovo vincolo')
  })

  test('moduli di inserimento: solo chi gestisce il LPS', async ({ assert }) => {
    const c = await scuola()
    const pm = new Browser()
    await pm.loginSviluppo('pm1')
    assert.equal((await pm.vai(`/commesse/${c.id}/lps/vincoli/nuovo`)).status, 200)
    assert.equal((await pm.vai(`/commesse/${c.id}/lps/attivita/nuova`)).status, 200)
    const mec = new Browser()
    await mec.loginSviluppo('mec1')
    assert.equal((await mec.get(`/commesse/${c.id}/lps/vincoli/nuovo`)).status, 403)
    assert.equal((await mec.get(`/commesse/${c.id}/lps/attivita/nuova`)).status, 403)
  })
})
