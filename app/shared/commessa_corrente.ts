/**
 * Carica la commessa dal parametro di rotta `:id`, verifica che l'utente la
 * possa vedere (403 altrimenti, 404 se non esiste) e la condivide con i
 * template per le schede di navigazione della commessa.
 */
import type { HttpContext } from '@adonisjs/core/http'
import Commessa from '#models/commessa'
import { vedeCommessa } from '#abilities/main'

export async function commessaCorrente(ctx: HttpContext, schedaAttiva: string): Promise<Commessa> {
  const id = Number(ctx.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return ctx.response.abort('Commessa non trovata', 404)
  }
  const commessa = await Commessa.find(id)
  if (!commessa) {
    return ctx.response.abort('Commessa non trovata', 404)
  }
  await ctx.bouncer.authorize(vedeCommessa, commessa)
  ctx.view.share({ commessa, schedaAttiva })
  return commessa
}
