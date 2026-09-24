/**
 * Registro dei job pianificati, eseguiti nel processo del server.
 *
 * C'è un solo server: non servono code esterne. Ogni job ha una pianificazione
 * settimanale o giornaliera in ora di Roma (l'ora legale è gestita da luxon).
 * Un job non parte due volte in parallelo. Gli errori finiscono nel log e non
 * fermano gli altri job.
 *
 * I moduli registrano i job in `app/modules/<modulo>/jobs.ts`, importato
 * dall'orchestratore in start/scheduler.ts.
 */
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import { FUSO } from '#shared/calendario'

export type Pianificazione =
  | { tipo: 'settimanale'; giorno: 1 | 2 | 3 | 4 | 5 | 6 | 7; ora: number; minuto: number }
  | { tipo: 'giornaliera'; ora: number; minuto: number }
  | { tipo: 'intervallo'; ogniMs: number }

export interface Job {
  nome: string
  descrizione: string
  pianificazione: Pianificazione
  esegui: () => Promise<void>
}

interface StatoJob {
  job: Job
  timer: NodeJS.Timeout | null
  inEsecuzione: boolean
  ultimaEsecuzione: Date | null
  ultimoErrore: string | null
}

const registro = new Map<string, StatoJob>()
let avviato = false

/** Registra un job. Errore se il nome è già usato. */
export function registraJob(job: Job) {
  if (registro.has(job.nome)) {
    throw new Error(`Job già registrato: ${job.nome}`)
  }
  registro.set(job.nome, {
    job,
    timer: null,
    inEsecuzione: false,
    ultimaEsecuzione: null,
    ultimoErrore: null,
  })
  if (avviato) pianifica(job.nome)
}

/** Prossima esecuzione dopo `dopo`, calcolata in ora di Roma */
export function prossimaEsecuzione(p: Pianificazione, dopo: Date = new Date()): Date {
  if (p.tipo === 'intervallo') {
    return new Date(dopo.getTime() + p.ogniMs)
  }
  const ora = DateTime.fromJSDate(dopo).setZone(FUSO)
  let candidato = ora.set({ hour: p.ora, minute: p.minuto, second: 0, millisecond: 0 })
  if (p.tipo === 'settimanale') {
    candidato = candidato.set({ weekday: p.giorno })
    if (candidato <= ora) candidato = candidato.plus({ weeks: 1 })
  } else if (candidato <= ora) {
    candidato = candidato.plus({ days: 1 })
  }
  return candidato.toJSDate()
}

/** Esegue subito un job (usato dai test e dal pannello admin) */
export async function eseguiOra(nome: string): Promise<void> {
  const stato = registro.get(nome)
  if (!stato) throw new Error(`Job sconosciuto: ${nome}`)
  if (stato.inEsecuzione) {
    logger.warn({ job: nome }, 'job già in esecuzione, salto')
    return
  }
  stato.inEsecuzione = true
  try {
    await stato.job.esegui()
    stato.ultimoErrore = null
  } catch (errore) {
    stato.ultimoErrore = errore instanceof Error ? errore.message : String(errore)
    logger.error({ job: nome, err: errore }, 'errore nel job pianificato')
  } finally {
    stato.inEsecuzione = false
    stato.ultimaEsecuzione = new Date()
  }
}

function pianifica(nome: string) {
  const stato = registro.get(nome)
  if (!stato) return
  const quando = prossimaEsecuzione(stato.job.pianificazione)
  // setTimeout accetta al massimo ~24,8 giorni: si ricalcola a tappe
  const attesa = Math.min(quando.getTime() - Date.now(), 2 ** 31 - 1)
  stato.timer = setTimeout(
    async () => {
      if (Date.now() >= quando.getTime()) await eseguiOra(nome)
      if (avviato) pianifica(nome)
    },
    Math.max(attesa, 0)
  )
  stato.timer.unref()
}

export function avviaScheduler() {
  if (avviato) return
  avviato = true
  for (const nome of registro.keys()) pianifica(nome)
  logger.info({ job: [...registro.keys()] }, 'scheduler avviato')
}

export function fermaScheduler() {
  avviato = false
  for (const stato of registro.values()) {
    if (stato.timer) clearTimeout(stato.timer)
    stato.timer = null
  }
}

/** Stato dei job per il pannello admin */
export function elencoJob() {
  return [...registro.values()].map((s) => ({
    nome: s.job.nome,
    descrizione: s.job.descrizione,
    inEsecuzione: s.inEsecuzione,
    ultimaEsecuzione: s.ultimaEsecuzione,
    ultimoErrore: s.ultimoErrore,
    prossima: avviato ? prossimaEsecuzione(s.job.pianificazione) : null,
  }))
}

/** Solo per i test: svuota il registro */
export function _svuotaRegistro() {
  fermaScheduler()
  registro.clear()
}
