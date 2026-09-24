import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const OreController = () => import('./ore_controller.js')

router
  .group(() => {
    router.get('/ore', [OreController, 'mie']).as('ore.mie')
    router
      .get('/commesse/:id/ore', [OreController, 'commessa'])
      .where('id', router.matchers.number())
      .as('ore.commessa')
  })
  .use(middleware.auth())
