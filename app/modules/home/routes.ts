import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const HomeController = () => import('./home_controller.js')

router.get('/', [HomeController, 'index']).as('home').use(middleware.auth())
