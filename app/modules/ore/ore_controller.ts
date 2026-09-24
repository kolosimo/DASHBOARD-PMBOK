import type { HttpContext } from '@adonisjs/core/http'
import { commessaCorrente } from '#shared/commessa_corrente'

/** Ore (segnaposto: Fase 1, agente A4) */
export default class OreController {
  /** Timesheet personale: ognuno vede e registra solo le proprie ore */
  async mie({ view }: HttpContext) {
    return view.render('modules/ore/mie', { voceAttiva: 'ore' })
  }

  /** Ore aggregate della commessa (vista PM) */
  async commessa(ctx: HttpContext) {
    await commessaCorrente(ctx, 'ore')
    return ctx.view.render('modules/ore/commessa')
  }
}
