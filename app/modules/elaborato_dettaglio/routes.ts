import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ElaboratoDettaglioController = () => import('./elaborato_dettaglio_controller.js')

router
  .group(() => {
    router.get('/', [ElaboratoDettaglioController, 'show']).as('elaborato_dettaglio.show')
    router
      .get('/frammento', [ElaboratoDettaglioController, 'frammento'])
      .as('elaborato_dettaglio.frammento')
    router
      .post('/stato', [ElaboratoDettaglioController, 'cambiaStato'])
      .as('elaborato_dettaglio.stato')
  })
  .prefix('/commesse/:id/elaborati/:elaboratoId')
  .where('id', router.matchers.number())
  .where('elaboratoId', router.matchers.number())
  .use(middleware.auth())
