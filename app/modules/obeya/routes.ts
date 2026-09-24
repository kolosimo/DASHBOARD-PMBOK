import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ObeyaController = () => import('./obeya_controller.js')

router
  .get('/commesse/:id', [ObeyaController, 'show'])
  .where('id', router.matchers.number())
  .as('obeya.show')
  .use(middleware.auth())
