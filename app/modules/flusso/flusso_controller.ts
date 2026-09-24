import type { HttpContext } from '@adonisjs/core/http'
import { commessaCorrente } from '#shared/commessa_corrente'

/** Kanban degli elaborati (segnaposto: Fase 1, agente A3) */
export default class FlussoController {
  async kanban(ctx: HttpContext) {
    await commessaCorrente(ctx, 'kanban')
    return ctx.view.render('modules/flusso/kanban')
  }
}
