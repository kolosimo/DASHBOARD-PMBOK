/*
| Modulo "accesso": login Microsoft 365 (OIDC), logout, login di sviluppo.
*/
import router from '@adonisjs/core/services/router'
import env from '#start/env'
import { middleware } from '#start/kernel'

const AccessoController = () => import('./accesso_controller.js')

router.get('/accesso', [AccessoController, 'pagina']).as('accesso').use(middleware.guest())
router.get('/auth/login', [AccessoController, 'login']).as('auth.login')
router.get('/auth/callback', [AccessoController, 'callback']).as('auth.callback')
router.post('/auth/logout', [AccessoController, 'logout']).as('auth.logout').use(middleware.auth())

if (env.get('AUTH_MODE') === 'dev') {
  router.get('/dev/login', [AccessoController, 'loginSviluppo']).as('dev.login')
}
