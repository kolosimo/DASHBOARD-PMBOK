/*
| Rotte SSE di @adonisjs/transmit e autorizzazione dei canali.
| Canale per commessa: "commesse/<id>". Solo chi vede la commessa si iscrive.
*/
import transmit from '@adonisjs/transmit/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import { middleware } from '#start/kernel'
import Commessa from '#models/commessa'
import { vedeCommessa } from '#abilities/main'

transmit.registerRoutes((route) => {
  route.use(middleware.auth())
})

transmit.authorize<{ id: string }>('commesse/:id', async (ctx: HttpContext, { id }) => {
  const utente = ctx.auth.user
  if (!utente) return false
  const commessa = await Commessa.find(Number(id))
  if (!commessa) return false
  return ctx.bouncer.allows(vedeCommessa, commessa)
})
