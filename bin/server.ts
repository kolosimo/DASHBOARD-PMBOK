/*
|--------------------------------------------------------------------------
| HTTP server entrypoint
|--------------------------------------------------------------------------
|
| The "server.ts" file is the entrypoint for starting the AdonisJS HTTP
| server. Either you can run this file directly or use the "serve"
| command to run this file and monitor file changes
|
| HTTPS diretto da Node (server Windows, senza IIS): se nel .env ci sono
| HTTPS_PFX_PATH e HTTPS_PFX_PASSPHRASE il server ascolta in https con il
| certificato PFX (porta da PORT, 443 nel modello di produzione); altrimenti
| in http come in sviluppo. Facoltativo: HTTPS_REINDIRIZZA_DA_PORTA=80 apre
| anche una porta http che reindirizza a https.
|
*/

import type { IncomingMessage, ServerResponse } from 'node:http'

await import('reflect-metadata')
const { Ignitor, prettyPrintError } = await import('@adonisjs/core/ignitor')

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

type Gestore = (req: IncomingMessage, res: ServerResponse) => unknown

const GIORNI_AVVISO_CERTIFICATO = 30

/**
 * Crea il server Node. Si esegue dopo il caricamento del .env (hook
 * `booting`), quindi legge le variabili da process.env.
 */
async function creaServer(gestore: Gestore) {
  const http = await import('node:http')
  const percorsoPfx = process.env.HTTPS_PFX_PATH?.trim()
  if (!percorsoPfx) {
    return http.createServer(gestore)
  }
  const passphrase = process.env.HTTPS_PFX_PASSPHRASE
  if (passphrase === undefined) {
    throw new Error('Avvio rifiutato: HTTPS_PFX_PATH è impostato ma manca HTTPS_PFX_PASSPHRASE.')
  }
  const https = await import('node:https')
  const { readFileSync } = await import('node:fs')
  const { contestoDaPfx, leggiCertificatoPfx, giorniAllaScadenza } =
    await import('../commands/certificato_scadenza.js')

  const pfx = readFileSync(percorsoPfx)
  // Controllo anticipato con messaggio chiaro (cifratura legacy, password errata)
  contestoDaPfx(pfx, passphrase, percorsoPfx)
  const server = https.createServer({ pfx, passphrase, minVersion: 'TLSv1.2' }, gestore)

  const controllaScadenza = () => {
    try {
      const info = leggiCertificatoPfx(percorsoPfx, passphrase)
      const giorni = giorniAllaScadenza(info.validoAl)
      const testo = `Certificato HTTPS (${info.nomiAlternativi || info.soggetto}): ${giorni} giorni alla scadenza`
      if (giorni < GIORNI_AVVISO_CERTIFICATO) {
        console.warn(`ATTENZIONE: ${testo}. Chiedere il rinnovo all'IT.`)
      } else {
        console.info(testo)
      }
    } catch (errore) {
      console.warn(`Controllo del certificato non riuscito: ${(errore as Error).message}`)
    }
  }
  controllaScadenza()
  setInterval(controllaScadenza, 24 * 60 * 60 * 1000).unref()

  const portaRedirect = Number(process.env.HTTPS_REINDIRIZZA_DA_PORTA || 0)
  if (portaRedirect > 0) {
    const portaHttps = Number(process.env.PORT || 443)
    const redirect = http.createServer((req, res) => {
      const host = (req.headers.host ?? 'localhost').replace(/:\d+$/, '')
      const porta = portaHttps === 443 ? '' : `:${portaHttps}`
      res.writeHead(301, { Location: `https://${host}${porta}${req.url ?? '/'}` })
      res.end()
    })
    redirect.on('error', (e) => {
      console.warn(`Porta di reindirizzamento ${portaRedirect} non disponibile: ${e.message}`)
    })
    redirect.listen(portaRedirect, process.env.HOST || '0.0.0.0')
    server.on('close', () => redirect.close())
  }
  return server
}

/**
 * La callback di `start` è sincrona: il server (http o https) si prepara nel
 * hook `booting`, subito dopo il caricamento del .env, con un gestore
 * differito che punta a quello di AdonisJS.
 */
let gestoreApp: Gestore | undefined
let serverPronto: Awaited<ReturnType<typeof creaServer>> | undefined

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
      serverPronto = await creaServer((req, res) => gestoreApp!(req, res))
    })
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .httpServer()
  .start((gestore) => {
    gestoreApp = gestore
    return serverPronto!
  })
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
