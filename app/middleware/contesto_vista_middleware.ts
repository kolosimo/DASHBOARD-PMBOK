import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import env from '#start/env'

/**
 * Condivide con i template i dati comuni: utente, percorso corrente,
 * modalità di login (per il riquadro "login di sviluppo").
 */
export default class ContestoVistaMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.view.share({
      utente: ctx.auth.user ?? null,
      percorso: ctx.request.url(),
      modalitaAuth: env.get('AUTH_MODE'),
      richiestaHtmx: ctx.request.header('hx-request') === 'true',
    })
    return next()
  }
}
