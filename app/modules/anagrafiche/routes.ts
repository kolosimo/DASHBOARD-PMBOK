import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AnagraficheController = () => import('./anagrafiche_controller.js')

router
  .get('/commesse/:id/anagrafica', [AnagraficheController, 'show'])
  .where('id', router.matchers.number())
  .as('anagrafiche.show')
  .use(middleware.auth())
