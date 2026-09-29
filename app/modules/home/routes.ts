import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const HomeController = () => import('./home_controller.js')
const NuovaCommessaController = () => import('./nuova_commessa_controller.js')

router.get('/', [HomeController, 'index']).as('home').use(middleware.auth())
router
  .get('/commesse/nuova', [NuovaCommessaController, 'pagina'])
  .as('commesse.nuova')
  .use(middleware.auth())
router
  .post('/commesse/nuova', [NuovaCommessaController, 'crea'])
  .as('commesse.crea')
  .use(middleware.auth())
