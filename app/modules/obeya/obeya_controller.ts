import type { HttpContext } from '@adonisjs/core/http'
import { commessaCorrente } from '#shared/commessa_corrente'

/** Vista Obeya di commessa (segnaposto: Fase 2, agente B1) */
export default class ObeyaController {
  async show(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'obeya')
    return ctx.view.render('modules/obeya/show', { commessa })
  }
}
