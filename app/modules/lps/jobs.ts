/**
 * Job pianificati del Last Planner. Da importare in start/scheduler.ts
 * (file dell'orchestratore): `import '#modules/lps/jobs'`.
 *
 * Gira ogni giorno alle 06:10 (ora di Roma): il lunedì scatta lo snapshot
 * del lookahead e quello della settimana appena chiusa; negli altri giorni
 * recupera ciò che manca (piano chiuso in ritardo, server spento). È
 * idempotente: rieseguirlo non duplica nulla.
 */
import { elencoJob, registraJob } from '#shared/scheduler'
import { eseguiSnapshotSettimanali } from './snapshot.js'

export const NOME_JOB_SNAPSHOT = 'lps.snapshot_settimanali'

if (!elencoJob().some((j) => j.nome === NOME_JOB_SNAPSHOT)) {
  registraJob({
    nome: NOME_JOB_SNAPSHOT,
    descrizione: 'Snapshot del Last Planner: PPC, PCR, TMR/TA a settimana chiusa e lookahead',
    pianificazione: { tipo: 'giornaliera', ora: 6, minuto: 10 },
    esegui: async () => {
      await eseguiSnapshotSettimanali()
    },
  })
}
