import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AdminController = () => import('./admin_controller.js')
const ConfigurazioneController = () => import('./configurazione_controller.js')
const UtentiController = () => import('./utenti_controller.js')
const CommesseController = () => import('./commesse_controller.js')

const numero = router.matchers.number()

router
  .group(() => {
    router.get('/', [AdminController, 'index']).as('admin.index')
    router
      .post('/impostazioni/:id', [AdminController, 'aggiornaImpostazione'])
      .where('id', numero)
      .as('admin.impostazioni.aggiorna')

    router.get('/commesse', [CommesseController, 'index']).as('admin.commesse')
    router.post('/commesse', [CommesseController, 'crea']).as('admin.commesse.crea')

    router.get('/utenti', [UtentiController, 'index']).as('admin.utenti')
    router.post('/utenti', [UtentiController, 'crea']).as('admin.utenti.crea')
    router
      .post('/utenti/:utenteId/password', [UtentiController, 'reimpostaPassword'])
      .where('utenteId', numero)
      .as('admin.utenti.password')
    router
      .post('/utenti/:utenteId/sblocca', [UtentiController, 'sblocca'])
      .where('utenteId', numero)
      .as('admin.utenti.sblocca')
    router
      .post('/utenti/:utenteId', [UtentiController, 'aggiorna'])
      .where('utenteId', numero)
      .as('admin.utenti.aggiorna')

    router.get('/stati', [ConfigurazioneController, 'stati']).as('admin.stati')
    router
      .post('/stati/:statoId', [ConfigurazioneController, 'aggiornaStato'])
      .where('statoId', numero)
      .as('admin.stati.aggiorna')

    router.get('/colonne', [ConfigurazioneController, 'colonne']).as('admin.colonne')
    router
      .post('/colonne/:colonnaId', [ConfigurazioneController, 'aggiornaColonna'])
      .where('colonnaId', numero)
      .as('admin.colonne.aggiorna')

    // Discipline e cause di non completamento (stessa struttura)
    const tipo = /^(discipline|cause)$/
    router.get('/:tipo', [ConfigurazioneController, 'voci']).where('tipo', tipo).as('admin.voci')
    router
      .post('/:tipo', [ConfigurazioneController, 'creaVoce'])
      .where('tipo', tipo)
      .as('admin.voci.crea')
    router
      .post('/:tipo/:voceId', [ConfigurazioneController, 'aggiornaVoce'])
      .where('tipo', tipo)
      .where('voceId', numero)
      .as('admin.voci.aggiorna')
  })
  .prefix('/admin')
  .use(middleware.auth())
