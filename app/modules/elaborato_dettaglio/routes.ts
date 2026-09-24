import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ElaboratoDettaglioController = () => import('./elaborato_dettaglio_controller.js')

router
  .get('/commesse/:id/elaborati/:elaboratoId', [ElaboratoDettaglioController, 'show'])
  .where('id', router.matchers.number())
  .where('elaboratoId', router.matchers.number())
  .as('elaborato_dettaglio.show')
  .use(middleware.auth())
