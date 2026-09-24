import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const EvmController = () => import('./evm_controller.js')

router
  .get('/commesse/:id/evm', [EvmController, 'show'])
  .where('id', router.matchers.number())
  .as('evm.show')
  .use(middleware.auth())
