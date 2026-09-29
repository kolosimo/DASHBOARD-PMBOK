import type { HttpContext } from '@adonisjs/core/http'
import { gestisceLps, modificaCommessa } from '#abilities/main'
import { commessaCorrente } from '#shared/commessa_corrente'
import { datiObeya } from './queries.js'

/**
 * Obeya di commessa: la vista unica per la riunione settimanale.
 * Solo totali per commessa (vale anche per la direzione): nessun dato per persona.
 */
export default class ObeyaController {
  private async dati(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'obeya')
    const [obeya, puoModificare, puoGestireLps] = await Promise.all([
      datiObeya(commessa.id),
      ctx.bouncer.allows(modificaCommessa, commessa),
      ctx.bouncer.allows(gestisceLps, commessa),
    ])
    return { obeya, puoModificare, puoGestireLps }
  }

  async show(ctx: HttpContext) {
    return ctx.view.render('modules/obeya/show', await this.dati(ctx))
  }

  /** Frammento aggiornato in tempo reale (eventi SSE della commessa o polling) */
  async contenuto(ctx: HttpContext) {
    return ctx.view.render('modules/obeya/_contenuto', await this.dati(ctx))
  }
}
