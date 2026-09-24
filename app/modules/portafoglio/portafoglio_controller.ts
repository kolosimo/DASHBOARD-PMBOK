import type { HttpContext } from '@adonisjs/core/http'

/** Portafoglio del PM (segnaposto: Fase 2, agente B1) */
export default class PortafoglioController {
  async index({ view }: HttpContext) {
    return view.render('modules/portafoglio/index', { voceAttiva: 'portafoglio' })
  }
}
