import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { OAuth2Server } from 'oauth2-mock-server'
import Utente from '#models/utente'
import AuditLog from '#models/audit_log'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'
import { calcolaHash, verificaPassword } from '#modules/accesso/password'
import { azzeraLimitatori } from '#modules/accesso/limitatore'
import { impostaModalitaPerTest } from '#modules/accesso/modalita'
import { impostaConfigurazioneOidcPerTest } from '#modules/accesso/oidc'
import { creaAdminIniziale } from '#modules/accesso/admin_iniziale'
import { EmailGiaUsata, MAX_TENTATIVI } from '#modules/accesso/account_locali'
import env from '#start/env'

const PASSWORD = 'una-password-lunga-42'
const HTMX = (csrf: string) => ({ 'hx-request': 'true', 'x-csrf-token': csrf })

async function conPassword(slug: string, password = PASSWORD, deveCambiare = false) {
  const u = await Utente.findByOrFail('email', `${slug}@climosfera.example`)
  u.passwordHash = await calcolaHash(password)
  u.deveCambiarePassword = deveCambiare
  await u.save()
  return u
}

/** Invia il modulo di accesso con email e password */
async function accedi(b: Browser, email: string, password: string, ritorno = '/') {
  const pagina = await b.get('/accesso')
  const csrf = Browser.csrfDa(await pagina.text())
  return b.post('/accesso', { _csrf: csrf, email, password, ritorno })
}

async function entraComeAdmin() {
  const b = new Browser()
  await b.loginSviluppo('admin')
  const html = await (await b.vai('/admin/utenti')).text()
  return { b, csrf: Browser.csrfDa(html), html }
}

function gruppoAccesso(group: Parameters<typeof conTransazione>[0]) {
  conTransazione(group)
  group.each.setup(() => {
    azzeraLimitatori()
    return () => impostaModalitaPerTest(null)
  })
}

test.group('Accesso locale · login', (group) => {
  gruppoAccesso(group)

  test('login ok: sessione aperta, tentativi azzerati e audit', async ({ assert }) => {
    const u = await conPassword('pm1')
    u.tentativiFalliti = 2
    await u.save()
    const b = new Browser()
    const r = await accedi(b, 'PM1@climosfera.example ', PASSWORD, '/portafoglio')
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), '/portafoglio')
    const home = await (await b.vai('/')).text()
    assert.include(home, 'CL-2026-031')
    await u.refresh()
    assert.equal(u.tentativiFalliti, 0)
    assert.isNotNull(u.ultimoAccesso)
    assert.isNotNull(await AuditLog.query().where('azione', 'accesso.locale').first())
  })

  test('cookie di sessione httpOnly', async ({ assert }) => {
    await conPassword('pm1')
    const b = new Browser()
    const pagina = await b.get('/accesso')
    const csrf = Browser.csrfDa(await pagina.text())
    const r = await fetch(b.url('/accesso'), {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'cookie': [...b.cookie].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: new URLSearchParams({
        _csrf: csrf,
        email: 'pm1@climosfera.example',
        password: PASSWORD,
      }),
    })
    const sessione = r.headers.getSetCookie().find((c) => c.startsWith('cruscotto-sessione='))
    assert.exists(sessione)
    assert.match(sessione!, /HttpOnly/i)
  })

  test('password sbagliata ed email sconosciuta: stesso messaggio, 401', async ({ assert }) => {
    await conPassword('pm1')
    const b = new Browser()
    const sbagliata = await accedi(b, 'pm1@climosfera.example', 'password-sbagliata')
    assert.equal(sbagliata.status, 401)
    const testo1 = await sbagliata.text()
    assert.include(testo1, 'Email o password non corretti.')

    const sconosciuta = await accedi(b, 'nessuno@climosfera.example', 'password-sbagliata')
    assert.equal(sconosciuta.status, 401)
    assert.include(await sconosciuta.text(), 'Email o password non corretti.')

    // utente senza password (entra solo con Microsoft 365): stesso messaggio
    const senza = await accedi(b, 'pm2@climosfera.example', 'qualcosa-di-lungo')
    assert.equal(senza.status, 401)
    assert.include(await senza.text(), 'Email o password non corretti.')

    assert.equal((await b.get('/')).status, 302)
    const u = await Utente.findByOrFail('email', 'pm1@climosfera.example')
    assert.equal(u.tentativiFalliti, 1)
  })

  test('campi vuoti: 422', async ({ assert }) => {
    const b = new Browser()
    const r = await accedi(b, '', '')
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'Inserisci email e password.')
  })

  test('utente disattivato con password giusta: 403', async ({ assert }) => {
    const u = await conPassword('mec2')
    u.attivo = false
    await u.save()
    const r = await accedi(new Browser(), 'mec2@climosfera.example', PASSWORD)
    assert.equal(r.status, 403)
    assert.include(await r.text(), 'disattivato')
  })

  test('ritorno verso un sito esterno: si va alla home', async ({ assert }) => {
    await conPassword('pm1')
    const r = await accedi(new Browser(), 'pm1@climosfera.example', PASSWORD, '//malevolo.example')
    assert.equal(r.headers.get('location'), '/')
  })
})

test.group('Accesso locale · blocco e limitatore', (group) => {
  gruppoAccesso(group)

  test(`blocco dopo ${MAX_TENTATIVI} tentativi per 15 minuti`, async ({ assert }) => {
    await conPassword('pm1')
    const b = new Browser()
    for (let i = 1; i < MAX_TENTATIVI; i++) {
      const r = await accedi(b, 'pm1@climosfera.example', `sbagliata-${i}`)
      assert.equal(r.status, 401)
      assert.include(await r.text(), 'Email o password non corretti.')
    }
    const quinto = await accedi(b, 'pm1@climosfera.example', 'sbagliata-5')
    assert.equal(quinto.status, 401)
    assert.include(await quinto.text(), 'Troppi tentativi non riusciti')

    // anche con la password giusta resta bloccato
    const giusta = await accedi(b, 'pm1@climosfera.example', PASSWORD)
    assert.equal(giusta.status, 401)
    assert.include(await giusta.text(), 'Troppi tentativi non riusciti')
    assert.equal((await b.get('/')).status, 302)

    const u = await Utente.findByOrFail('email', 'pm1@climosfera.example')
    assert.isTrue(u.bloccato)
    const minuti = u.bloccatoFino!.diff(DateTime.now(), 'minutes').minutes
    assert.isAbove(minuti, 14)
    assert.isAtMost(minuti, 15)
    assert.isNotNull(await AuditLog.query().where('azione', 'accesso.bloccato').first())
  })

  test('blocco scaduto: si entra di nuovo', async ({ assert }) => {
    const u = await conPassword('pm1')
    u.bloccatoFino = DateTime.now().minus({ minutes: 1 })
    await u.save()
    const r = await accedi(new Browser(), 'pm1@climosfera.example', PASSWORD)
    assert.equal(r.status, 302)
  })

  test('email sconosciuta: stesso messaggio di blocco dopo 5 errori', async ({ assert }) => {
    const b = new Browser()
    let ultimo = ''
    for (let i = 0; i < MAX_TENTATIVI; i++) {
      ultimo = await (await accedi(b, 'chi.sei@climosfera.example', 'x-qualsiasi-cosa')).text()
    }
    assert.include(ultimo, 'Troppi tentativi non riusciti')
  })

  test('limitatore per IP: 429 dopo troppe richieste', async ({ assert }) => {
    const b = new Browser()
    const csrf = Browser.csrfDa(await (await b.get('/accesso')).text())
    let r: Response | null = null
    for (let i = 0; i < 31; i++) {
      r = await b.post('/accesso', { _csrf: csrf, email: `x${i}@climosfera.example`, password: '' })
    }
    assert.equal(r!.status, 429)
    assert.include(await r!.text(), 'Troppe richieste di accesso')
  })
})

test.group('Accesso locale · cambio password obbligatorio', (group) => {
  gruppoAccesso(group)

  test('primo accesso: prima si cambia la password, poi si entra', async ({ assert }) => {
    await conPassword('pm1', PASSWORD, true)
    const b = new Browser()
    const r = await accedi(b, 'pm1@climosfera.example', PASSWORD, '/portafoglio')
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), '/accesso/cambia-password')
    // non ancora dentro
    assert.equal((await b.get('/')).status, 302)

    const pagina = await b.get('/accesso/cambia-password')
    assert.equal(pagina.status, 200)
    const csrf = Browser.csrfDa(await pagina.text())

    const corta = await b.post('/accesso/cambia-password', {
      _csrf: csrf,
      nuova_password: 'corta',
      conferma_password: 'corta',
    })
    assert.equal(corta.status, 422)
    assert.include(await corta.text(), 'almeno 12 caratteri')

    const diverse = await b.post('/accesso/cambia-password', {
      _csrf: csrf,
      nuova_password: 'nuova-password-sicura',
      conferma_password: 'nuova-password-diversa',
    })
    assert.equal(diverse.status, 422)
    assert.include(await diverse.text(), 'non coincidono')

    const uguale = await b.post('/accesso/cambia-password', {
      _csrf: csrf,
      nuova_password: PASSWORD,
      conferma_password: PASSWORD,
    })
    assert.equal(uguale.status, 422)
    assert.include(await uguale.text(), 'diversa da quella attuale')

    const ok = await b.post('/accesso/cambia-password', {
      _csrf: csrf,
      nuova_password: 'nuova-password-sicura',
      conferma_password: 'nuova-password-sicura',
    })
    assert.equal(ok.status, 302)
    assert.equal(ok.headers.get('location'), '/portafoglio')
    assert.equal((await b.vai('/')).status, 200)

    const u = await Utente.findByOrFail('email', 'pm1@climosfera.example')
    assert.isFalse(u.deveCambiarePassword)
    assert.isTrue(await verificaPassword(u.passwordHash, 'nuova-password-sicura'))
    assert.isNotNull(await AuditLog.query().where('azione', 'utente.password_cambiata').first())
    const voce = await AuditLog.query().where('azione', 'utente.password_cambiata').firstOrFail()
    assert.notInclude(JSON.stringify(voce.datiDopo), 'scrypt')
  })

  test('senza login la pagina di cambio rimanda all’accesso', async ({ assert }) => {
    const r = await new Browser().get('/accesso/cambia-password')
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), '/accesso')
  })

  test('cambio volontario: serve la password attuale', async ({ assert }) => {
    await conPassword('pm1')
    const b = new Browser()
    await accedi(b, 'pm1@climosfera.example', PASSWORD)
    const pagina = await b.get('/accesso/cambia-password')
    assert.equal(pagina.status, 200)
    const csrf = Browser.csrfDa(await pagina.text())
    const errata = await b.post('/accesso/cambia-password', {
      _csrf: csrf,
      password_attuale: 'non-e-questa',
      nuova_password: 'altra-password-lunga',
      conferma_password: 'altra-password-lunga',
    })
    assert.equal(errata.status, 422)
    assert.include(await errata.text(), 'La password attuale non è corretta.')
    const ok = await b.post('/accesso/cambia-password', {
      _csrf: csrf,
      password_attuale: PASSWORD,
      nuova_password: 'altra-password-lunga',
      conferma_password: 'altra-password-lunga',
    })
    assert.equal(ok.status, 200)
    assert.include(await ok.text(), 'Password cambiata.')
  })
})

test.group('Accesso locale · pannello admin', (group) => {
  gruppoAccesso(group)

  test('crea utente: password temporanea mostrata una volta e cambio al primo accesso', async ({
    assert,
  }) => {
    const { b, csrf } = await entraComeAdmin()
    const r = await b.post('/admin/utenti', {
      _csrf: csrf,
      email: 'Nuovo.PM@climosfera.example',
      nome: 'Nuovo PM',
      ruolo: 'pm',
    })
    assert.equal(r.status, 200)
    const html = await r.text()
    const m = html.match(/data-testid="password-temporanea">([^<]+)</)
    assert.exists(m)
    const temporanea = m![1].trim()
    assert.isAtLeast(temporanea.length, 16)

    const u = await Utente.findByOrFail('email', 'nuovo.pm@climosfera.example')
    assert.equal(u.ruolo, 'pm')
    assert.isTrue(u.deveCambiarePassword)
    assert.isNotNull(await AuditLog.query().where('azione', 'utente.creato_locale').first())

    // la pagina ricaricata non mostra più la password
    assert.notInclude(await (await b.get('/admin/utenti')).text(), temporanea)

    const nuovo = new Browser()
    const login = await accedi(nuovo, 'nuovo.pm@climosfera.example', temporanea)
    assert.equal(login.headers.get('location'), '/accesso/cambia-password')
  })

  test('crea utente: email già usata o non valida → 422', async ({ assert }) => {
    const { b, csrf } = await entraComeAdmin()
    const doppia = await b.post('/admin/utenti', {
      _csrf: csrf,
      email: 'pm1@climosfera.example',
      nome: 'Doppione',
      ruolo: 'pm',
    })
    assert.equal(doppia.status, 422)
    assert.include(await doppia.text(), 'esiste già un utente con questa email')
    const errata = await b.post('/admin/utenti', {
      _csrf: csrf,
      email: 'non-una-email',
      nome: 'X',
      ruolo: 'pm',
    })
    assert.equal(errata.status, 422)
    assert.include(await errata.text(), 'Email: indirizzo non valido.')
  })

  test('reset da admin: vecchia password non vale più, cambio obbligatorio', async ({ assert }) => {
    const u = await conPassword('pm1')
    u.bloccatoFino = DateTime.now().plus({ minutes: 10 })
    await u.save()
    const { b, csrf } = await entraComeAdmin()
    const r = await b.post(
      `/admin/utenti/${u.id}/password`,
      { version: String(u.version) },
      HTMX(csrf)
    )
    assert.equal(r.status, 200)
    assert.include(r.headers.get('hx-trigger') ?? '', 'Password reimpostata')
    const html = await r.text()
    const temporanea = html.match(/<code[^>]*>([^<]+)<\/code>/)![1].trim()

    await u.refresh()
    assert.isTrue(u.deveCambiarePassword)
    assert.isFalse(u.bloccato)
    const voce = await AuditLog.query().where('azione', 'utente.password_reimpostata').firstOrFail()
    assert.notInclude(JSON.stringify(voce.datiDopo), temporanea)

    const vecchia = await accedi(new Browser(), 'pm1@climosfera.example', PASSWORD)
    assert.equal(vecchia.status, 401)
    const nuova = await accedi(new Browser(), 'pm1@climosfera.example', temporanea)
    assert.equal(nuova.headers.get('location'), '/accesso/cambia-password')
  })

  test('reset con versione vecchia: 409', async ({ assert }) => {
    const u = await conPassword('pm1')
    const { b, csrf } = await entraComeAdmin()
    const r = await b.post(
      `/admin/utenti/${u.id}/password`,
      { version: String(u.version - 1 || 99) },
      HTMX(csrf)
    )
    assert.equal(r.status, 409)
  })

  test('sblocca: azzera il blocco, con audit', async ({ assert }) => {
    const u = await conPassword('pm1')
    u.bloccatoFino = DateTime.now().plus({ minutes: 10 })
    u.tentativiFalliti = 3
    await u.save()
    const { b, csrf } = await entraComeAdmin()
    const pagina = await (await b.get('/admin/utenti')).text()
    assert.include(pagina, `data-testid="sblocca-${u.id}"`)
    const r = await b.post(`/admin/utenti/${u.id}/sblocca`, {
      version: String(u.version),
      _csrf: csrf,
    })
    assert.equal(r.status, 200)
    await u.refresh()
    assert.isNull(u.bloccatoFino)
    assert.equal(u.tentativiFalliti, 0)
    assert.isNotNull(await AuditLog.query().where('azione', 'utente.sbloccato').first())
    assert.equal((await accedi(new Browser(), 'pm1@climosfera.example', PASSWORD)).status, 302)
  })

  test('non admin: 403 su crea, reset e sblocco', async ({ assert }) => {
    const u = await conPassword('mec1')
    const pm = new Browser()
    await pm.loginSviluppo('pm1')
    const csrf = Browser.csrfDa(await (await pm.vai('/')).text())
    const prove: [string, Record<string, string>][] = [
      ['/admin/utenti', { email: 'x@climosfera.example', nome: 'X', ruolo: 'admin' }],
      [`/admin/utenti/${u.id}/password`, { version: String(u.version) }],
      [`/admin/utenti/${u.id}/sblocca`, { version: String(u.version) }],
    ]
    for (const [percorso, campi] of prove) {
      assert.equal((await pm.post(percorso, { ...campi, _csrf: csrf })).status, 403, percorso)
    }
    assert.isNull(await Utente.findBy('email', 'x@climosfera.example'))
    await u.refresh()
    assert.isTrue(await verificaPassword(u.passwordHash, PASSWORD))
  })
})

test.group('Accesso locale · admin iniziale da console', (group) => {
  gruppoAccesso(group)

  test('crea l’admin con password temporanea; senza --reimposta non tocca un esistente', async ({
    assert,
  }) => {
    const { utente, password, creato } = await creaAdminIniziale({
      email: 'Capo.Pilota@climosfera.example',
      nome: 'Capo Pilota',
    })
    assert.isTrue(creato)
    assert.equal(utente.ruolo, 'admin')
    assert.isTrue(utente.deveCambiarePassword)
    assert.isTrue(await verificaPassword(utente.passwordHash, password))

    await assert.rejects(
      () => creaAdminIniziale({ email: 'capo.pilota@climosfera.example' }),
      EmailGiaUsata
    )
    const diNuovo = await creaAdminIniziale({
      email: 'pm2@climosfera.example',
      reimposta: true,
    })
    assert.isFalse(diNuovo.creato)
    assert.equal(diNuovo.utente.ruolo, 'admin')
  })
})

test.group('Accesso · modalità AUTH_MODE', (group) => {
  gruppoAccesso(group)
  const provider = new OAuth2Server()
  const base = `http://${env.get('HOST')}:${env.get('PORT')}`
  let claims: Record<string, unknown> = {}

  group.setup(async () => {
    await provider.issuer.keys.generate('RS256')
    await provider.start(0, 'localhost')
    provider.service.on('beforeTokenSigning', (token) => {
      Object.assign(token.payload, claims)
    })
    return async () => {
      impostaConfigurazioneOidcPerTest(null)
      await provider.stop()
    }
  })

  test('locale: solo email e password, niente Microsoft né sviluppo', async ({ assert }) => {
    impostaModalitaPerTest('locale')
    const b = new Browser()
    const html = await (await b.get('/accesso')).text()
    assert.include(html, 'data-testid="form-accesso-locale"')
    assert.notInclude(html, 'Accedi con Microsoft 365')
    assert.notInclude(html, 'Login di sviluppo')
    assert.equal((await b.get('/auth/login')).status, 404)
    await conPassword('pm1')
    assert.equal((await accedi(b, 'pm1@climosfera.example', PASSWORD)).status, 302)
  })

  test('oidc: niente password, il login Microsoft 365 funziona', async ({ assert }) => {
    impostaModalitaPerTest('oidc')
    impostaConfigurazioneOidcPerTest({
      issuer: provider.issuer.url!,
      clientId: 'cruscotto-test',
      clientSecret: 'segreto-di-prova',
      redirectUri: `${base}/auth/callback`,
      scopes: 'openid profile email',
    })
    const b = new Browser()
    const html = await (await b.get('/accesso')).text()
    assert.notInclude(html, 'data-testid="form-accesso-locale"')
    assert.include(html, 'Accedi con Microsoft 365')

    await conPassword('pm1')
    const csrf = Browser.csrfDa(html)
    const post = await b.post('/accesso', {
      _csrf: csrf,
      email: 'pm1@climosfera.example',
      password: PASSWORD,
    })
    assert.equal(post.status, 404)

    claims = { sub: 'sub-pm1-oidc', email: 'pm1@climosfera.example', name: 'PM 1' }
    const login = await b.get('/auth/login?ritorno=/portafoglio')
    assert.equal(login.status, 302)
    const alProvider = await fetch(new URL(login.headers.get('location')!), { redirect: 'manual' })
    const callback = await b.get(alProvider.headers.get('location')!)
    assert.equal(callback.status, 302)
    assert.equal(callback.headers.get('location'), '/portafoglio')
    assert.include(await (await b.vai('/')).text(), 'CL-2026-031')
  })
})
