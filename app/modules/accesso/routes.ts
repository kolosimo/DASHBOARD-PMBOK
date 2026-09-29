/*
| Modulo "accesso": login con email e password (account locali), login
| Microsoft 365 (OIDC), cambio password, logout, login di sviluppo.
| Il metodo attivo dipende da AUTH_MODE (vedi modalita.ts): le rotte esistono
| sempre, i controller rispondono 404 se il metodo non è attivo.
*/
import router from '@adonisjs/core/services/router'
import env from '#start/env'
import { middleware } from '#start/kernel'

const AccessoController = () => import('./accesso_controller.js')

router.get('/accesso', [AccessoController, 'pagina']).as('accesso').use(middleware.guest())
router
  .post('/accesso', [AccessoController, 'loginLocale'])
  .as('accesso.locale')
  .use(middleware.guest())
router
  .get('/accesso/cambia-password', [AccessoController, 'paginaCambioPassword'])
  .as('accesso.cambia_password')
router
  .post('/accesso/cambia-password', [AccessoController, 'cambioPassword'])
  .as('accesso.cambia_password.salva')
router.get('/auth/login', [AccessoController, 'login']).as('auth.login')
router.get('/auth/callback', [AccessoController, 'callback']).as('auth.callback')
router.post('/auth/logout', [AccessoController, 'logout']).as('auth.logout').use(middleware.auth())

if (env.get('AUTH_MODE') === 'dev') {
  router.get('/dev/login', [AccessoController, 'loginSviluppo']).as('dev.login')
}
