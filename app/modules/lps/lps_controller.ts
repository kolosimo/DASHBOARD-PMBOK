import type { HttpContext } from '@adonisjs/core/http'
import { commessaCorrente } from '#shared/commessa_corrente'

/** Last Planner (segnaposto: Fase 1, agente A2) */
export default class LpsController {
  async settimana(ctx: HttpContext) {
    await commessaCorrente(ctx, 'settimana')
    return ctx.view.render('modules/lps/settimana')
  }

  async lookahead(ctx: HttpContext) {
    await commessaCorrente(ctx, 'lookahead')
    return ctx.view.render('modules/lps/lookahead')
  }
}
