/**
 * node ace certificato:scadenza [--avviso 30]
 *
 * Legge il certificato HTTPS (PFX indicato da HTTPS_PFX_PATH e
 * HTTPS_PFX_PASSPHRASE nel .env) e mostra soggetto, nomi alternativi (SAN),
 * emittente e giorni alla scadenza. Esce con codice 1 se il PFX non si legge
 * o se mancano meno di --avviso giorni (default 30), così si può usare in
 * un'attività pianificata di Windows.
 *
 * Le funzioni esportate servono anche a bin/server.ts (avvio in HTTPS).
 */
import { readFileSync } from 'node:fs'
import { Duplex } from 'node:stream'
import tls from 'node:tls'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

const GIORNO_MS = 24 * 60 * 60 * 1000

export interface InfoCertificato {
  soggetto: string
  emittente: string
  nomiAlternativi: string
  validoDal: Date
  validoAl: Date
  impronta: string
}

export class CertificatoNonValido extends Error {
  constructor(messaggio: string) {
    super(messaggio)
    this.name = 'CertificatoNonValido'
  }
}

/** Crea il contesto TLS dal PFX con messaggi d'errore comprensibili */
export function contestoDaPfx(pfx: Buffer, passphrase: string, percorso: string) {
  try {
    return tls.createSecureContext({ pfx, passphrase })
  } catch (errore) {
    const e = errore as NodeJS.ErrnoException
    if (e.code === 'ERR_CRYPTO_UNSUPPORTED_OPERATION' || /unsupported/i.test(e.message)) {
      throw new CertificatoNonValido(
        `Il PFX ${percorso} usa una cifratura non supportata (probabilmente 3DES/RC2, "legacy"). ` +
          'Va riesportato con cifratura AES256-SHA256: vedi docs/installazione/guida-it-windows-server-2019.md.'
      )
    }
    if (/mac verify failure/i.test(e.message)) {
      throw new CertificatoNonValido(
        `Password del PFX errata (HTTPS_PFX_PASSPHRASE) per ${percorso}.`
      )
    }
    throw new CertificatoNonValido(`Impossibile leggere il PFX ${percorso}: ${e.message}`)
  }
}

/** Legge il certificato del server contenuto nel PFX */
export function leggiCertificatoPfx(percorso: string, passphrase: string): InfoCertificato {
  let pfx: Buffer
  try {
    pfx = readFileSync(percorso)
  } catch (errore) {
    throw new CertificatoNonValido(
      `File PFX non trovato o non leggibile: ${percorso} (${(errore as Error).message})`
    )
  }
  const contesto = contestoDaPfx(pfx, passphrase, percorso)
  // Un socket TLS "lato server" non collegato basta per leggere il certificato
  const socket = new tls.TLSSocket(
    new Duplex({
      read() {},
      write(_c, _e, cb) {
        cb()
      },
    }),
    { isServer: true, secureContext: contesto }
  )
  try {
    const c = socket.getCertificate()
    if (!c || !('valid_to' in c)) {
      throw new CertificatoNonValido(`Il PFX ${percorso} non contiene un certificato.`)
    }
    const nome = (x: unknown) =>
      Object.entries((x ?? {}) as Record<string, string | string[]>)
        .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('+') : v}`)
        .join(', ')
    return {
      soggetto: nome(c.subject),
      emittente: nome(c.issuer),
      nomiAlternativi: c.subjectaltname ?? '',
      validoDal: new Date(c.valid_from),
      validoAl: new Date(c.valid_to),
      impronta: c.fingerprint256,
    }
  } finally {
    socket.destroy()
  }
}

/** Giorni interi alla scadenza (negativi se già scaduto) */
export function giorniAllaScadenza(validoAl: Date, adesso = new Date()): number {
  return Math.floor((validoAl.getTime() - adesso.getTime()) / GIORNO_MS)
}

function dataItaliana(d: Date) {
  return d.toLocaleString('it-IT', {
    timeZone: 'Europe/Rome',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default class CertificatoScadenza extends BaseCommand {
  static commandName = 'certificato:scadenza'
  static description = 'Mostra i dati del certificato HTTPS (PFX) e i giorni alla scadenza'
  static options: CommandOptions = { startApp: false }

  @flags.number({ description: 'Giorni sotto i quali segnalare (default 30)', default: 30 })
  declare avviso: number

  async run() {
    const percorso = process.env.HTTPS_PFX_PATH
    const passphrase = process.env.HTTPS_PFX_PASSPHRASE ?? ''
    if (!percorso) {
      this.logger.warning(
        'HTTPS_PFX_PATH non è impostato: il server risponde in http, nessun certificato da controllare.'
      )
      return
    }
    try {
      const info = leggiCertificatoPfx(percorso, passphrase)
      const giorni = giorniAllaScadenza(info.validoAl)
      this.logger.log(`Certificato:       ${percorso}`)
      this.logger.log(`Soggetto:          ${info.soggetto}`)
      this.logger.log(`Nomi (SAN):        ${info.nomiAlternativi || 'nessuno'}`)
      this.logger.log(`Emittente:         ${info.emittente}`)
      this.logger.log(`Valido dal:        ${dataItaliana(info.validoDal)}`)
      this.logger.log(`Valido fino al:    ${dataItaliana(info.validoAl)}`)
      this.logger.log(`Impronta SHA-256:  ${info.impronta}`)
      if (giorni < 0) {
        this.logger.error(`Certificato SCADUTO da ${-giorni} giorni.`)
        this.exitCode = 1
      } else if (giorni < this.avviso) {
        this.logger.warning(`Giorni alla scadenza: ${giorni}. Chiedere all'IT il rinnovo.`)
        this.exitCode = 1
      } else {
        this.logger.success(`Giorni alla scadenza: ${giorni}`)
      }
    } catch (errore) {
      if (errore instanceof CertificatoNonValido) {
        this.logger.error(errore.message)
        this.exitCode = 1
        return
      }
      throw errore
    }
  }
}
