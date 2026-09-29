import type { HttpContext } from '@adonisjs/core/http'
import Utente from '#models/utente'
import { registraAudit } from '#shared/audit'
import {
  completaLogin,
  iniziaLogin,
  oidcConfigurato,
  urlLogoutProvider,
  type RichiestaOidc,
} from './oidc.js'
import { AccessoNegato, utenteDaClaims } from './utenti_jit.js'
import { accessoLocaleAttivo, accessoOidcAttivo, modalitaAccesso } from './modalita.js'
import {
  MESSAGGIO_BLOCCO,
  MESSAGGIO_CREDENZIALI,
  MESSAGGIO_DISATTIVATO,
  cambiaPassword,
  normalizzaEmail,
  verificaCredenziali,
} from './account_locali.js'
import { LUNGHEZZA_MINIMA, erroreNuovaPassword, verificaPassword } from './password.js'
import { limitePerIp } from './limitatore.js'

const CHIAVE_SESSIONE = 'oidc_richiesta'
/** Utente che ha superato la password ma deve sceglierne una nuova */
const CHIAVE_CAMBIO = 'cambio_password'
const DURATA_CAMBIO_MS = 10 * 60 * 1000

interface CambioInSospeso {
  utenteId: number
  ritorno: string
  scade: number
}

/** Accetta solo percorsi interni ("/..."), mai URL esterni */
function ritornoSicuro(valore: unknown): string {
  if (typeof valore !== 'string') return '/'
  if (!valore.startsWith('/') || valore.startsWith('//') || valore.startsWith('/\\')) return '/'
  return valore
}

export default class AccessoController {
  /** Pagina di accesso: mostra il metodo attivo (AUTH_MODE) */
  async pagina(ctx: HttpContext) {
    return this.renderPagina(ctx)
  }

  private async renderPagina(
    { view, request }: HttpContext,
    extra: { errore?: string; email?: string; ritorno?: string } = {}
  ) {
    const modalita = modalitaAccesso()
    const utentiDev =
      modalita === 'dev'
        ? await Utente.query().where('attivo', true).orderBy('ruolo').orderBy('nome')
        : []
    return view.render('modules/accesso/pagina', {
      modalitaAuth: modalita,
      accessoLocale: accessoLocaleAttivo(),
      accessoOidc: accessoOidcAttivo(),
      oidcDisponibile: oidcConfigurato(),
      utentiDev,
      ritorno: extra.ritorno ?? ritornoSicuro(request.input('ritorno')),
      uscito: request.input('uscito') === '1',
      errore: extra.errore ?? null,
      email: extra.email ?? '',
    })
  }

  /** Accesso con email e password (AUTH_MODE=locale, e dev per le prove) */
  async loginLocale(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    if (!accessoLocaleAttivo()) return response.notFound('Accesso con password non attivo')

    const ip = request.ip()
    const ritorno = ritornoSicuro(request.input('ritorno'))
    const email = normalizzaEmail(request.input('email'))
    const password = String(request.input('password') ?? '')

    if (limitePerIp.registra(ip) > limitePerIp.massimo) {
      const minuti = Math.max(1, Math.ceil(limitePerIp.secondiRimanenti(ip) / 60))
      response.status(429)
      response.header('Retry-After', String(minuti * 60))
      return this.renderPagina(ctx, {
        errore: `Troppe richieste di accesso da questo computer. Riprova tra ${minuti} minuti.`,
        email,
        ritorno,
      })
    }

    if (!email || !password) {
      response.status(422)
      return this.renderPagina(ctx, {
        errore: 'Inserisci email e password.',
        email,
        ritorno,
      })
    }

    const esito = await verificaCredenziali(email, password, ip)
    if (esito.esito !== 'ok') {
      const messaggi = {
        ko: MESSAGGIO_CREDENZIALI,
        bloccato: MESSAGGIO_BLOCCO,
        disattivato: MESSAGGIO_DISATTIVATO,
      }
      response.status(esito.esito === 'disattivato' ? 403 : 401)
      return this.renderPagina(ctx, { errore: messaggi[esito.esito], email, ritorno })
    }

    session.regenerate()
    if (esito.utente.deveCambiarePassword) {
      const inSospeso: CambioInSospeso = {
        utenteId: esito.utente.id,
        ritorno,
        scade: Date.now() + DURATA_CAMBIO_MS,
      }
      session.put(CHIAVE_CAMBIO, inSospeso)
      return response.redirect('/accesso/cambia-password')
    }
    await auth.use('web').login(esito.utente)
    return response.redirect(ritorno)
  }

  /**
   * Chi deve cambiare la password (primo accesso o reset) oppure un utente
   * già entrato che vuole cambiarla (serve la password attuale).
   */
  private async contestoCambio(ctx: HttpContext) {
    const utente = ctx.auth.user
    if (utente) {
      if (!accessoLocaleAttivo() || !utente.haPassword) return null
      return { utente, obbligatorio: false, ritorno: '/' }
    }
    const inSospeso = ctx.session.get(CHIAVE_CAMBIO) as CambioInSospeso | undefined
    if (!inSospeso || inSospeso.scade < Date.now()) return null
    const u = await Utente.find(inSospeso.utenteId)
    if (!u || !u.attivo || !u.deveCambiarePassword) return null
    return { utente: u, obbligatorio: true, ritorno: inSospeso.ritorno }
  }

  async paginaCambioPassword(ctx: HttpContext) {
    await ctx.auth.check()
    const c = await this.contestoCambio(ctx)
    if (!c) return ctx.response.redirect('/accesso')
    return ctx.view.render('modules/accesso/cambia_password', {
      obbligatorio: c.obbligatorio,
      nome: c.utente.nome,
      minimo: LUNGHEZZA_MINIMA,
      errore: null,
      fatto: false,
    })
  }

  async cambioPassword(ctx: HttpContext) {
    const { request, response, session, auth, view } = ctx
    await auth.check()
    const c = await this.contestoCambio(ctx)
    if (!c) return response.redirect('/accesso')

    const nuova = String(request.input('nuova_password') ?? '')
    const conferma = String(request.input('conferma_password') ?? '')
    let errore = erroreNuovaPassword(nuova, conferma)
    if (!errore && !c.obbligatorio) {
      const attuale = String(request.input('password_attuale') ?? '')
      if (!(await verificaPassword(c.utente.passwordHash, attuale))) {
        errore = 'La password attuale non è corretta.'
      }
    }
    if (!errore && (await verificaPassword(c.utente.passwordHash, nuova))) {
      errore = 'La nuova password deve essere diversa da quella attuale.'
    }
    if (errore) {
      response.status(422)
      return view.render('modules/accesso/cambia_password', {
        obbligatorio: c.obbligatorio,
        nome: c.utente.nome,
        minimo: LUNGHEZZA_MINIMA,
        errore,
        fatto: false,
      })
    }

    const aggiornato = await cambiaPassword(c.utente, nuova, request.ip())
    if (c.obbligatorio) {
      session.forget(CHIAVE_CAMBIO)
      session.regenerate()
      await auth.use('web').login(aggiornato)
      return response.redirect(c.ritorno)
    }
    return view.render('modules/accesso/cambia_password', {
      obbligatorio: false,
      nome: aggiornato.nome,
      minimo: LUNGHEZZA_MINIMA,
      errore: null,
      fatto: true,
    })
  }

  /** Avvia il login OIDC: redirezione verso Microsoft */
  async login({ request, response, session, view }: HttpContext) {
    if (!accessoOidcAttivo()) return response.notFound('Accesso Microsoft 365 non attivo')
    if (!oidcConfigurato()) {
      return response.status(503).send(
        await view.render('pages/errore_accesso', {
          messaggio: 'Il login Microsoft 365 non è ancora configurato su questo server.',
        })
      )
    }
    const { url, richiesta } = await iniziaLogin(ritornoSicuro(request.input('ritorno')))
    session.put(CHIAVE_SESSIONE, richiesta)
    return response.redirect(url)
  }

  /** Ritorno da Microsoft: verifica e apertura della sessione */
  async callback(ctx: HttpContext) {
    const { request, response, session, auth, view } = ctx
    if (!accessoOidcAttivo()) return response.notFound('Accesso Microsoft 365 non attivo')
    const richiesta = session.pull(CHIAVE_SESSIONE) as RichiestaOidc | undefined
    if (!richiesta) {
      return response.status(400).send(
        await view.render('pages/errore_accesso', {
          messaggio: 'La sessione di accesso è scaduta o non è valida. Riprova ad accedere.',
        })
      )
    }
    if (request.input('error')) {
      return response.status(401).send(
        await view.render('pages/errore_accesso', {
          messaggio: `Accesso non riuscito: ${String(request.input('error_description') ?? request.input('error'))}`,
        })
      )
    }

    let claims
    try {
      claims = await completaLogin(new URL(request.completeUrl(true)), richiesta)
    } catch (errore) {
      ctx.logger.warn({ err: errore }, 'callback OIDC non valida')
      return response.status(401).send(
        await view.render('pages/errore_accesso', {
          messaggio: 'Non è stato possibile verificare l’accesso con Microsoft 365. Riprova.',
        })
      )
    }

    let utente
    try {
      utente = await utenteDaClaims(claims)
    } catch (errore) {
      if (errore instanceof AccessoNegato) {
        return response
          .status(403)
          .send(await view.render('pages/errore_accesso', { messaggio: errore.message }))
      }
      throw errore
    }

    session.regenerate()
    await auth.use('web').login(utente)
    return response.redirect(richiesta.ritorno)
  }

  /** Uscita: chiude la sessione locale e, se possibile, quella Microsoft */
  async logout({ auth, response, session }: HttpContext) {
    await auth.use('web').logout()
    session.clear()
    const urlProvider = modalitaAccesso() === 'oidc' ? await urlLogoutProvider() : null
    return response.redirect(urlProvider ?? '/accesso?uscito=1')
  }

  /** Login di sviluppo: /dev/login?come=<parte locale dell'email> */
  async loginSviluppo(ctx: HttpContext) {
    const { request, response, auth, session } = ctx
    const come = String(request.input('come') ?? '')
      .trim()
      .toLowerCase()
    if (!come) return response.redirect('/accesso')

    const utente = await Utente.query()
      .where('attivo', true)
      .where((q) => {
        q.where('email', come).orWhereRaw("split_part(email, '@', 1) = ?", [come])
      })
      .first()
    if (!utente) {
      return response.status(404).send(`Utente di sviluppo non trovato: ${come}`)
    }
    session.regenerate()
    await auth.use('web').login(utente)
    await registraAudit({
      utenteId: utente.id,
      azione: 'accesso.sviluppo',
      entita: 'utenti',
      entitaId: utente.id,
      ip: request.ip(),
    })
    return response.redirect(ritornoSicuro(request.input('ritorno')))
  }
}
