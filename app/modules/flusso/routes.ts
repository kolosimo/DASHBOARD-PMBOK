import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const FlussoController = () => import('./flusso_controller.js')

router
  .group(() => {
    router.get('/', [FlussoController, 'kanban']).as('flusso.kanban')
    router.get('/frammento', [FlussoController, 'frammento']).as('flusso.frammento')
    router
      .post('/elaborati/:elaboratoId/stato', [FlussoController, 'sposta'])
      .where('elaboratoId', router.matchers.number())
      .as('flusso.sposta')
  })
  .prefix('/commesse/:id/flusso')
  .where('id', router.matchers.number())
  .use(middleware.auth())
