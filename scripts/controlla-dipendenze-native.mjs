/**
 * Controllo "nessuna dipendenza nativa": il pacchetto per Windows Server deve
 * installarsi senza compilatori (niente node-gyp, niente script di install).
 *
 * Fallisce se nel package-lock.json c'è un pacchetto con script di
 * installazione (hasInstallScript) o con binding.gyp, salvo le eccezioni
 * elencate qui sotto con il motivo. Le eccezioni sono ammesse solo se il
 * pacchetto è di sviluppo o opzionale (non finisce nel pacchetto di produzione
 * oppure non viene installato su Windows).
 *
 *   npm run controlla-dipendenze
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const radice = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Eccezioni esplicite: nome pacchetto → motivo */
const ECCEZIONI = {
  '@swc/core':
    'solo sviluppo (esecuzione TypeScript con ts-exec); binari precompilati per piattaforma, lo script di postinstall verifica soltanto il binario',
  'fsevents': 'opzionale, solo macOS (osservazione file); su Windows non viene installato',
}

/** Pacchetti vietati in ogni caso */
const VIETATI = ['pg-native', 'better-sqlite3', 'sqlite3', 'bcrypt', 'argon2-native', 'node-gyp']

const lock = JSON.parse(readFileSync(join(radice, 'package-lock.json'), 'utf8'))
const problemi = []
const eccezioniUsate = new Set()

for (const [percorso, info] of Object.entries(lock.packages ?? {})) {
  if (!percorso) continue
  const nome = percorso.slice(percorso.lastIndexOf('node_modules/') + 'node_modules/'.length)
  if (VIETATI.includes(nome)) {
    problemi.push(`${nome}@${info.version}: pacchetto vietato (dipendenza nativa)`)
    continue
  }
  const gyp = existsSync(join(radice, percorso, 'binding.gyp'))
  if (!info.hasInstallScript && !gyp) continue

  if (nome in ECCEZIONI) {
    if (!info.dev && !info.optional) {
      problemi.push(`${nome}@${info.version}: eccezione ammessa solo come dipendenza di sviluppo o opzionale`)
    } else {
      eccezioniUsate.add(nome)
    }
    continue
  }
  problemi.push(
    `${nome}@${info.version}: ${gyp ? 'binding.gyp (node-gyp)' : 'script di installazione'}${info.dev ? ' [dev]' : ''}`
  )
}

if (problemi.length > 0) {
  console.error('Dipendenze native o con script di installazione non ammesse:')
  for (const p of problemi) console.error(`  - ${p}`)
  console.error('\nSe una dipendenza è davvero necessaria, aggiungila a ECCEZIONI con il motivo.')
  process.exit(1)
}

console.log('Nessuna dipendenza nativa non ammessa.')
for (const nome of eccezioniUsate) console.log(`  eccezione: ${nome} (${ECCEZIONI[nome]})`)
