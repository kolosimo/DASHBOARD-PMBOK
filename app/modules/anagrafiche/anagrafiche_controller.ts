import type { HttpContext } from '@adonisjs/core/http'
import { commessaCorrente } from '#shared/commessa_corrente'

/** Anagrafica di commessa: team, milestone, elaborati (segnaposto: Fase 1, agente A1) */
export default class AnagraficheController {
  async show(ctx: HttpContext) {
    await commessaCorrente(ctx, 'anagrafica')
    return ctx.view.render('modules/anagrafiche/show')
  }
}
