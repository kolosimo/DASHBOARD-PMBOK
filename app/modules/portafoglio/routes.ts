import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const PortafoglioController = () => import('./portafoglio_controller.js')

router
  .get('/portafoglio', [PortafoglioController, 'index'])
  .as('portafoglio')
  .use(middleware.auth())
