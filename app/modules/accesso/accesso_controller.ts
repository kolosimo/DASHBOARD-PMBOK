import type { HttpContext } from '@adonisjs/core/http'
import Utente from '#models/utente'
import env from '#start/env'
import { registraAudit } from '#shared/audit'
import {
  completaLogin,
  iniziaLogin,
  oidcConfigurato,
  urlLogoutProvider,
  type RichiestaOidc,
} from './oidc.js'
import { AccessoNegato, utenteDaClaims } from './utenti_jit.js'

const CHIAVE_SESSIONE = 'oidc_richiesta'

/** Accetta solo percorsi interni ("/..."), mai URL esterni */
function ritornoSicuro(valore: unknown): string {
  if (typeof valore !== 'string') return '/'
  if (!valore.startsWith('/') || valore.startsWith('//') || valore.startsWith('/\\')) return '/'
  return valore
}

export default class AccessoController {
  /** Pagina di accesso */
  async pagina({ view, request }: HttpContext) {
    const modalita = env.get('AUTH_MODE')
    const utentiDev =
      modalita === 'dev'
        ? await Utente.query().where('attivo', true).orderBy('ruolo').orderBy('nome')
        : []
    return view.render('pages/accesso', {
      oidcDisponibile: oidcConfigurato(),
      utentiDev,
      ritorno: ritornoSicuro(request.input('ritorno')),
      uscito: request.input('uscito') === '1',
    })
  }

  /** Avvia il login OIDC: redirezione verso Microsoft */
  async login({ request, response, session, view }: HttpContext) {
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
    const urlProvider = env.get('AUTH_MODE') === 'oidc' ? await urlLogoutProvider() : null
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
