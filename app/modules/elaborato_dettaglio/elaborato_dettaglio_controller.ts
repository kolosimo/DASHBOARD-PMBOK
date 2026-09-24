import type { HttpContext } from '@adonisjs/core/http'
import { commessaCorrente } from '#shared/commessa_corrente'

/** Scheda elaborato (segnaposto: Fase 2, agente B4) */
export default class ElaboratoDettaglioController {
  async show(ctx: HttpContext) {
    await commessaCorrente(ctx, 'kanban')
    return ctx.view.render('modules/elaborato_dettaglio/show')
  }
}
