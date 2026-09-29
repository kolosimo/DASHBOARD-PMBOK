import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ObeyaController = () => import('./obeya_controller.js')

router
  .group(() => {
    router.get('/commesse/:id', [ObeyaController, 'show']).as('obeya.show')
    router
      .get('/commesse/:id/obeya/contenuto', [ObeyaController, 'contenuto'])
      .as('obeya.contenuto')
  })
  .where('id', router.matchers.number())
  .use(middleware.auth())
