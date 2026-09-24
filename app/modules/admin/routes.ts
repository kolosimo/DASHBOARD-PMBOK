import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AdminController = () => import('./admin_controller.js')

router
  .group(() => {
    router.get('/', [AdminController, 'index']).as('admin.index')
    router
      .post('/impostazioni/:id', [AdminController, 'aggiornaImpostazione'])
      .where('id', router.matchers.number())
      .as('admin.impostazioni.aggiorna')
  })
  .prefix('/admin')
  .use(middleware.auth())
