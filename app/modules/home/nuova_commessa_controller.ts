import type { HttpContext } from '@adonisjs/core/http'
import { creaCommessa } from '#abilities/main'
import { utentiAttivi } from '#modules/anagrafiche/queries'
import { creaCommessaDaForm } from '#modules/admin/crea_commessa'
import type { Errori } from '#modules/anagrafiche/validazione'

const NEGATO = 'Solo i PM e gli amministratori possono aprire una commessa.'

/**
 * Apertura di una commessa dalla home (PM e admin). Il PM che la apre ne
 * diventa il PM; l'admin sceglie il PM dal form, come in /admin/commesse.
 * Team, milestone ed elaborati si completano poi nella scheda Anagrafica.
 */
export default class NuovaCommessaController {
  async pagina(ctx: HttpContext) {
    if (await ctx.bouncer.denies(creaCommessa)) return ctx.response.abort(NEGATO, 403)
    return this.mostra(ctx, {}, {})
  }

  async crea(ctx: HttpContext) {
    if (await ctx.bouncer.denies(creaCommessa)) return ctx.response.abort(NEGATO, 403)
    const io = ctx.auth.getUserOrFail()
    const esito = await creaCommessaDaForm(ctx, io, io.isAdmin ? null : io.id)
    if ('errori' in esito) {
      ctx.response.status(422)
      return this.mostra(ctx, esito.errori, ctx.request.all())
    }
    const { commessa } = esito
    ctx.session.flash(
      'messaggio',
      `Commessa ${commessa.codice} creata: aggiungi team, milestone ed elaborati.`
    )
    return ctx.response.redirect(`/commesse/${commessa.id}/anagrafica`)
  }

  private async mostra(ctx: HttpContext, errori: Errori, valori: Record<string, unknown>) {
    const io = ctx.auth.getUserOrFail()
    return ctx.view.render('modules/home/nuova_commessa', {
      voceAttiva: 'home',
      sceltaPm: io.isAdmin,
      utenti: io.isAdmin ? await utentiAttivi() : [],
      errori,
      valori,
    })
  }
}
