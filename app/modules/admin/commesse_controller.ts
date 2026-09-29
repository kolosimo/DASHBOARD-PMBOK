import type { HttpContext } from '@adonisjs/core/http'
import type { Errori } from '#modules/anagrafiche/validazione'
import { commesseVisibili, utentiAttivi } from '#modules/anagrafiche/queries'
import { datiPagina, soloAdmin } from './comune.js'
import { creaCommessaDaForm } from './crea_commessa.js'

/**
 * Elenco di tutte le commesse e creazione di una commessa nuova (solo admin).
 * Dati, team e milestone si gestiscono poi nella scheda Anagrafica della commessa.
 */
export default class CommesseController {
  async index(ctx: HttpContext) {
    await soloAdmin(ctx)
    return this.pagina(ctx, {}, {})
  }

  async crea(ctx: HttpContext) {
    const io = await soloAdmin(ctx)
    const esito = await creaCommessaDaForm(ctx, io)
    if ('errori' in esito) {
      ctx.response.status(422)
      return this.pagina(ctx, esito.errori, ctx.request.all())
    }
    const { commessa } = esito
    ctx.session.flash('messaggio', `Commessa ${commessa.codice} creata: completa team e milestone.`)
    return ctx.response.redirect(`/commesse/${commessa.id}/anagrafica`)
  }

  private async pagina(ctx: HttpContext, errori: Errori, valori: Record<string, unknown>) {
    const io = ctx.auth.getUserOrFail()
    return ctx.view.render('modules/admin/commesse', {
      ...datiPagina('commesse'),
      commesse: await commesseVisibili(io),
      utenti: await utentiAttivi(),
      errori,
      valori,
      messaggio: ctx.session.flashMessages.get('messaggio') ?? null,
    })
  }
}
