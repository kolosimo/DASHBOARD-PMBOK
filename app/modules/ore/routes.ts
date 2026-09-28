import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const OreController = () => import('./ore_controller.js')

router
  .group(() => {
    router.get('/ore', [OreController, 'mie']).as('ore.mie')
    router.post('/ore/celle', [OreController, 'salvaCella']).as('ore.cella')
    router.get('/ore/correzione', [OreController, 'correzione']).as('ore.correzione')
    router
      .post('/ore/correzione/celle', [OreController, 'salvaCorrezione'])
      .as('ore.correzione.cella')
    router
      .get('/commesse/:id/ore', [OreController, 'commessa'])
      .where('id', router.matchers.number())
      .as('ore.commessa')
  })
  .use(middleware.auth())
