import * as abilities from '#abilities/main'
import { Bouncer } from '@adonisjs/bouncer'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Crea l'istanza Bouncer per la richiesta e la condivide con i template Edge.
 * Non si usano policy: solo le abilità di app/abilities/main.ts.
 */
export default class InitializeBouncerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.bouncer = new Bouncer(() => ctx.auth.user || null, abilities, {}).setContainerResolver(
      ctx.containerResolver
    )

    if ('view' in ctx) {
      ctx.view.share(ctx.bouncer.edgeHelpers)
    }

    return next()
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    bouncer: Bouncer<Exclude<HttpContext['auth']['user'], undefined>, typeof abilities, {}>
  }
}
