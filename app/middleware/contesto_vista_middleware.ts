import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { accessoLocaleAttivo, modalitaAccesso } from '#modules/accesso/modalita'

/**
 * Condivide con i template i dati comuni: utente, percorso corrente,
 * modalità di login (per il riquadro "login di sviluppo") e se l'accesso a
 * password è attivo (link "Cambia password" nel menu utente).
 */
export default class ContestoVistaMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.view.share({
      utente: ctx.auth.user ?? null,
      percorso: ctx.request.url(),
      modalitaAuth: modalitaAccesso(),
      accessoLocale: accessoLocaleAttivo(),
      richiestaHtmx: ctx.request.header('hx-request') === 'true',
    })
    return next()
  }
}
