import { test } from '@japa/runner'
import { OAuth2Server } from 'oauth2-mock-server'
import Utente from '#models/utente'
import AuditLog from '#models/audit_log'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'
import { impostaConfigurazioneOidcPerTest } from '#modules/accesso/oidc'
import env from '#start/env'

/**
 * Flusso OIDC completo contro un provider finto (oauth2-mock-server):
 * authorization code + PKCE S256, state e nonce, ID token firmato RS256.
 */
test.group('Login OIDC contro provider finto', (group) => {
  const provider = new OAuth2Server()
  let claimsProssimoToken: Record<string, unknown> = {}
  const base = `http://${env.get('HOST')}:${env.get('PORT')}`

  group.setup(async () => {
    await provider.issuer.keys.generate('RS256')
    await provider.start(0, 'localhost')
    provider.service.on('beforeTokenSigning', (token) => {
      Object.assign(token.payload, claimsProssimoToken)
    })
    impostaConfigurazioneOidcPerTest({
      issuer: provider.issuer.url!,
      clientId: 'cruscotto-test',
      clientSecret: 'segreto-di-prova',
      redirectUri: `${base}/auth/callback`,
      scopes: 'openid profile email',
    })
    return async () => {
      impostaConfigurazioneOidcPerTest(null)
      await provider.stop()
    }
  })
  conTransazione(group)

  /** Esegue il giro completo: /auth/login → provider → /auth/callback */
  async function accedi(b: Browser, claims: Record<string, unknown>) {
    claimsProssimoToken = claims
    const login = await b.get('/auth/login?ritorno=/portafoglio')
    if (login.status !== 302) throw new Error(`/auth/login: ${login.status}`)
    const urlAutorizzazione = new URL(login.headers.get('location')!)
    const alProvider = await fetch(urlAutorizzazione, { redirect: 'manual' })
    const callback = alProvider.headers.get('location')!
    return { urlAutorizzazione, callback: await b.get(callback) }
  }

  test('la richiesta al provider usa PKCE S256, state e nonce', async ({ assert }) => {
    const b = new Browser()
    const r = await b.get('/auth/login')
    assert.equal(r.status, 302)
    const url = new URL(r.headers.get('location')!)
    assert.isTrue(url.href.startsWith(provider.issuer.url!))
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
    assert.isAbove(url.searchParams.get('code_challenge')!.length, 40)
    assert.isAbove(url.searchParams.get('state')!.length, 20)
    assert.isAbove(url.searchParams.get('nonce')!.length, 20)
    assert.equal(url.searchParams.get('redirect_uri'), `${base}/auth/callback`)
  })

  test('primo accesso: utente creato come progettista e sessione aperta', async ({ assert }) => {
    const b = new Browser()
    const { callback } = await accedi(b, {
      sub: 'sub-nuovo-1',
      email: 'Nuova.Persona@climosfera.example',
      name: 'Nuova Persona',
    })
    assert.equal(callback.status, 302)
    assert.equal(callback.headers.get('location'), '/portafoglio')

    const utente = await Utente.findByOrFail('email', 'nuova.persona@climosfera.example')
    assert.equal(utente.ruolo, 'progettista')
    assert.equal(utente.nome, 'Nuova Persona')
    assert.equal(utente.oidcSub, 'sub-nuovo-1')
    assert.isNotNull(
      await AuditLog.query().where('azione', 'utente.creato_al_primo_accesso').first()
    )

    const home = await (await b.vai('/')).text()
    assert.include(home, 'Nuova Persona')
    assert.include(home, 'Non fai ancora parte di nessuna commessa')
  })

  test('email in ADMIN_EMAILS: il nuovo utente è admin', async ({ assert }) => {
    const b = new Browser()
    const { callback } = await accedi(b, {
      sub: 'sub-admin-nuovo',
      email: 'admin.nuovo@climosfera.example',
      name: 'Admin Nuovo',
    })
    assert.equal(callback.status, 302)
    const utente = await Utente.findByOrFail('email', 'admin.nuovo@climosfera.example')
    assert.equal(utente.ruolo, 'admin')
  })

  test('utente già presente: collegato per email, ruolo invariato', async ({ assert }) => {
    const b = new Browser()
    const { callback } = await accedi(b, {
      sub: 'sub-pm1',
      preferred_username: 'pm1@climosfera.example',
      name: 'PM 1',
    })
    assert.equal(callback.status, 302)
    const utente = await Utente.findByOrFail('email', 'pm1@climosfera.example')
    assert.equal(utente.ruolo, 'pm')
    assert.equal(utente.oidcIssuer, provider.issuer.url)
    const home = await (await b.vai('/')).text()
    assert.include(home, 'CL-2026-031')
  })

  test('utente disattivato: 403', async ({ assert }) => {
    await Utente.query().where('email', 'mec2@climosfera.example').update({ attivo: false })
    const b = new Browser()
    const { callback } = await accedi(b, { sub: 'sub-mec2', email: 'mec2@climosfera.example' })
    assert.equal(callback.status, 403)
    assert.include(await callback.text(), 'disattivato')
  })

  test('state manomesso: accesso rifiutato', async ({ assert }) => {
    const b = new Browser()
    claimsProssimoToken = { email: 'pm1@climosfera.example' }
    const login = await b.get('/auth/login')
    const url = new URL(login.headers.get('location')!)
    const alProvider = await fetch(url, { redirect: 'manual' })
    const callback = new URL(alProvider.headers.get('location')!)
    callback.searchParams.set('state', 'state-falso')
    const r = await b.get(callback.href)
    assert.equal(r.status, 401)
    assert.equal((await b.get('/')).status, 302)
  })

  test('callback senza sessione di login: 400', async ({ assert }) => {
    const b = new Browser()
    const r = await b.get('/auth/callback?code=abc&state=xyz')
    assert.equal(r.status, 400)
  })

  test('ritorno verso un sito esterno: si torna alla home', async ({ assert }) => {
    const b = new Browser()
    claimsProssimoToken = { email: 'pm1@climosfera.example' }
    const login = await b.get('/auth/login?ritorno=//malevolo.example/x')
    const alProvider = await fetch(new URL(login.headers.get('location')!), { redirect: 'manual' })
    const r = await b.get(alProvider.headers.get('location')!)
    assert.equal(r.headers.get('location'), '/')
  })
})
