import { test } from '@japa/runner'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

test.group('Login di sviluppo e home', (group) => {
  conTransazione(group)

  test('senza login si viene mandati alla pagina di accesso', async ({ assert }) => {
    const b = new Browser()
    const r = await b.get('/')
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), '/accesso')
    const pagina = await (await b.get('/accesso')).text()
    assert.include(pagina, 'Login di sviluppo')
    assert.include(pagina, 'data-testid="dev-pm1"')
  })

  test('il PM vede solo le sue commesse', async ({ assert }) => {
    const b = new Browser()
    await b.loginSviluppo('pm1')
    const r = await b.vai('/')
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'PM 1')
    assert.include(html, 'CL-2026-031')
    assert.include(html, 'CL-2025-077')
    assert.notInclude(html, 'CL-2026-018')
  })

  test('la direzione e l’admin vedono tutte le commesse del seed', async ({ assert }) => {
    for (const come of ['direzione', 'admin']) {
      const b = new Browser()
      await b.loginSviluppo(come)
      const html = await (await b.vai('/')).text()
      for (const codice of ['CL-2026-031', 'CL-2026-018', 'CL-2025-077']) {
        assert.include(html, codice, `${come} dovrebbe vedere ${codice}`)
      }
    }
  })

  test('un progettista vede solo le commesse di cui è membro', async ({ assert }) => {
    const b = new Browser()
    await b.loginSviluppo('mec1')
    const html = await (await b.vai('/')).text()
    assert.include(html, 'CL-2026-031')
    assert.notInclude(html, 'CL-2026-018')
    assert.notInclude(html, 'CL-2025-077')
  })

  test('utente inesistente: 404', async ({ assert }) => {
    const b = new Browser()
    const r = await b.get('/dev/login?come=nessuno')
    assert.equal(r.status, 404)
  })

  test('logout chiude la sessione', async ({ assert }) => {
    const b = new Browser()
    await b.loginSviluppo('pm1')
    const home = await (await b.vai('/')).text()
    const r = await b.post('/auth/logout', { _csrf: Browser.csrfDa(home) })
    assert.equal(r.status, 302)
    assert.equal((await b.get('/')).status, 302)
  })
})
