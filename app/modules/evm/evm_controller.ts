import type { HttpContext } from '@adonisjs/core/http'
import { commessaCorrente } from '#shared/commessa_corrente'

/** Avanzamento EVM (segnaposto: Fase 1, agente A5) */
export default class EvmController {
  async show(ctx: HttpContext) {
    await commessaCorrente(ctx, 'evm')
    return ctx.view.render('modules/evm/show')
  }
}
