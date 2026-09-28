import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const EvmController = () => import('./evm_controller.js')

router
  .group(() => {
    router.get('/', [EvmController, 'show']).as('evm.show')
    router.get('/contenuto', [EvmController, 'contenuto']).as('evm.contenuto')
    router.get('/baseline', [EvmController, 'baseline']).as('evm.baseline')
    router.post('/baseline', [EvmController, 'creaBozza']).as('evm.baseline.crea')
    router
      .group(() => {
        router
          .post('/elaborati/:elaboratoId', [EvmController, 'salvaRiga'])
          .where('elaboratoId', router.matchers.number())
          .as('evm.baseline.riga')
        router.post('/mancanti', [EvmController, 'aggiungiMancanti']).as('evm.baseline.mancanti')
        router.post('/approva', [EvmController, 'approva']).as('evm.baseline.approva')
        router.post('/scarta', [EvmController, 'scarta']).as('evm.baseline.scarta')
      })
      .prefix('/baseline/:baselineId')
      .where('baselineId', router.matchers.number())
  })
  .prefix('/commesse/:id/evm')
  .where('id', router.matchers.number())
  .use(middleware.auth())
