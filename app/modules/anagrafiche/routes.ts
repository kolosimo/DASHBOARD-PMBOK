import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AnagraficheController = () => import('./anagrafiche_controller.js')
const TeamController = () => import('./team_controller.js')
const MilestoneController = () => import('./milestone_controller.js')
const ElaboratiController = () => import('./elaborati_controller.js')

const numero = router.matchers.number()

router
  .group(() => {
    router.get('/anagrafica', [AnagraficheController, 'show']).as('anagrafiche.show')
    router.post('/anagrafica/dati', [AnagraficheController, 'aggiornaDati']).as('anagrafiche.dati')
    router
      .post('/limiti-wip/:colonnaId', [AnagraficheController, 'aggiornaLimiteWip'])
      .where('colonnaId', numero)
      .as('anagrafiche.limiti_wip')

    router.post('/team', [TeamController, 'aggiungi']).as('anagrafiche.team.aggiungi')
    router
      .post('/team/:membroId', [TeamController, 'aggiorna'])
      .where('membroId', numero)
      .as('anagrafiche.team.aggiorna')
    router
      .post('/team/:membroId/rimuovi', [TeamController, 'rimuovi'])
      .where('membroId', numero)
      .as('anagrafiche.team.rimuovi')

    router.post('/milestone', [MilestoneController, 'crea']).as('anagrafiche.milestone.crea')
    router
      .post('/milestone/:milestoneId', [MilestoneController, 'aggiorna'])
      .where('milestoneId', numero)
      .as('anagrafiche.milestone.aggiorna')
    router
      .post('/milestone/:milestoneId/elimina', [MilestoneController, 'elimina'])
      .where('milestoneId', numero)
      .as('anagrafiche.milestone.elimina')

    router.get('/elaborati/nuovo', [ElaboratiController, 'nuovo']).as('anagrafiche.elaborati.nuovo')
    router.post('/elaborati', [ElaboratiController, 'crea']).as('anagrafiche.elaborati.crea')
    router
      .get('/elaborati/import', [ElaboratiController, 'formImport'])
      .as('anagrafiche.elaborati.import')
    router
      .post('/elaborati/import/anteprima', [ElaboratiController, 'anteprimaImport'])
      .as('anagrafiche.elaborati.import.anteprima')
    router
      .post('/elaborati/import', [ElaboratiController, 'confermaImport'])
      .as('anagrafiche.elaborati.import.conferma')
    router
      .get('/elaborati/:elaboratoId/modifica', [ElaboratiController, 'modifica'])
      .where('elaboratoId', numero)
      .as('anagrafiche.elaborati.modifica')
    router
      .post('/elaborati/:elaboratoId', [ElaboratiController, 'aggiorna'])
      .where('elaboratoId', numero)
      .as('anagrafiche.elaborati.aggiorna')
    router
      .post('/elaborati/:elaboratoId/elimina', [ElaboratiController, 'elimina'])
      .where('elaboratoId', numero)
      .as('anagrafiche.elaborati.elimina')
  })
  .prefix('/commesse/:id')
  .where('id', numero)
  .use(middleware.auth())
