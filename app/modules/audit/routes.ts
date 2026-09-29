/*
| Modulo "audit": registro attività (sola lettura di audit_log), solo admin.
| Da importare in start/routes.ts (richiesta all'orchestratore).
*/
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const RegistroController = () => import('./registro_controller.js')

router
  .get('/admin/registro', [RegistroController, 'index'])
  .as('audit.registro')
  .use(middleware.auth())
