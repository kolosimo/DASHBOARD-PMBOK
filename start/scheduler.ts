/*
| Avvio dei job pianificati in-process (solo nel processo web).
| I moduli registrano i propri job con registraJob() in app/shared/scheduler.ts.
*/
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { avviaScheduler, fermaScheduler } from '#shared/scheduler'

if (env.get('SCHEDULER_ATTIVO', true) && app.getEnvironment() === 'web') {
  app.ready(() => avviaScheduler())
  app.terminating(() => fermaScheduler())
}
