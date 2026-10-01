import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const PianoController = () => import('./piano_controller.js')
const LookaheadController = () => import('./lookahead_controller.js')

const numero = router.matchers.number()

router
  .group(() => {
    // Piano settimanale
    router.get('/settimana', [PianoController, 'mostra']).as('lps.settimana')
    router.get('/settimana/frammento', [PianoController, 'frammento']).as('lps.settimana.frammento')
    router.post('/settimana/crea', [PianoController, 'crea']).as('lps.piano.crea')
    router
      .post('/piani/:pianoId/impegni', [PianoController, 'aggiungiImpegno'])
      .where('pianoId', numero)
      .as('lps.impegni.aggiungi')
    router
      .post('/piani/:pianoId/promessa', [PianoController, 'prometti'])
      .where('pianoId', numero)
      .as('lps.piano.prometti')
    router
      .post('/piani/:pianoId/chiusura', [PianoController, 'chiudi'])
      .where('pianoId', numero)
      .as('lps.piano.chiudi')
    router
      .post('/impegni/:impegnoId/esito', [PianoController, 'esito'])
      .where('impegnoId', numero)
      .as('lps.impegni.esito')
    router
      .post('/impegni/:impegnoId/punti', [PianoController, 'punti'])
      .where('impegnoId', numero)
      .as('lps.impegni.punti')
    router
      .post('/impegni/:impegnoId/elimina', [PianoController, 'eliminaImpegno'])
      .where('impegnoId', numero)
      .as('lps.impegni.elimina')

    // Lookahead e registro vincoli
    router.get('/lookahead', [LookaheadController, 'mostra']).as('lps.lookahead')
    router
      .get('/lookahead/frammento', [LookaheadController, 'frammento'])
      .as('lps.lookahead.frammento')
    router.get('/attivita/nuova', [LookaheadController, 'nuovaAttivita']).as('lps.attivita.nuova')
    router.post('/attivita', [LookaheadController, 'creaAttivita']).as('lps.attivita.crea')
    router
      .get('/attivita/:attivitaId/modifica', [LookaheadController, 'modificaAttivitaForm'])
      .where('attivitaId', numero)
      .as('lps.attivita.modifica')
    router
      .post('/attivita/:attivitaId', [LookaheadController, 'aggiornaAttivita'])
      .where('attivitaId', numero)
      .as('lps.attivita.aggiorna')
    router
      .post('/attivita/:attivitaId/elimina', [LookaheadController, 'eliminaAttivita'])
      .where('attivitaId', numero)
      .as('lps.attivita.elimina')
    router.get('/vincoli/nuovo', [LookaheadController, 'nuovoVincolo']).as('lps.vincoli.nuovo')
    router.post('/vincoli', [LookaheadController, 'creaVincolo']).as('lps.vincoli.crea')
    router
      .get('/vincoli/:vincoloId/modifica', [LookaheadController, 'modificaVincoloForm'])
      .where('vincoloId', numero)
      .as('lps.vincoli.modifica')
    router
      .post('/vincoli/:vincoloId', [LookaheadController, 'aggiornaVincolo'])
      .where('vincoloId', numero)
      .as('lps.vincoli.aggiorna')
    router
      .post('/vincoli/:vincoloId/:azione', [LookaheadController, 'statoVincolo'])
      .where('vincoloId', numero)
      .where('azione', /^(rimuovi|riapri|annulla)$/)
      .as('lps.vincoli.stato')
  })
  .prefix('/commesse/:id/lps')
  .where('id', numero)
  .use(middleware.auth())
