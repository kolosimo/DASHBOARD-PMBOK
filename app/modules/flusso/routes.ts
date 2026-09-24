import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const FlussoController = () => import('./flusso_controller.js')

router
  .get('/commesse/:id/flusso', [FlussoController, 'kanban'])
  .where('id', router.matchers.number())
  .as('flusso.kanban')
  .use(middleware.auth())
