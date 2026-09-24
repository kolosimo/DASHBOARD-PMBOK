import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const LpsController = () => import('./lps_controller.js')

router
  .group(() => {
    router.get('/settimana', [LpsController, 'settimana']).as('lps.settimana')
    router.get('/lookahead', [LpsController, 'lookahead']).as('lps.lookahead')
  })
  .prefix('/commesse/:id/lps')
  .where('id', router.matchers.number())
  .use(middleware.auth())
