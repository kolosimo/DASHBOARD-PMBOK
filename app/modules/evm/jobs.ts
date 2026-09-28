/**
 * Job pianificati del modulo EVM. Da importare in start/scheduler.ts
 * (file dell'orchestratore): `import '#modules/evm/jobs'`.
 */
import logger from '@adonisjs/core/services/logger'
import { registraJob } from '#shared/scheduler'
import { scattaSnapshotEvm } from './snapshot_service.js'

export const NOME_JOB_SNAPSHOT_EVM = 'evm.snapshot'

registraJob({
  nome: NOME_JOB_SNAPSHOT_EVM,
  descrizione:
    'Snapshot EVM delle settimane con ore non più modificabili; segnala le rettifiche tardive',
  // Ogni giorno: lo snapshot parte appena scade il termine di modifica delle ore
  pianificazione: { tipo: 'giornaliera', ora: 6, minuto: 10 },
  esegui: async () => {
    const esito = await scattaSnapshotEvm()
    logger.info(
      { creati: esito.creati.length, rettificati: esito.rettificati.length },
      'snapshot EVM eseguito'
    )
  },
})
