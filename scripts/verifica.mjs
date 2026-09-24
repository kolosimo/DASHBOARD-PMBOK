/**
 * npm run verifica: typecheck, lint, controllo dipendenze native, test unit e
 * funzionali, in sequenza. Si ferma al primo errore. Funziona su Windows,
 * macOS e Linux (nessuna shell bash richiesta).
 *
 * Variabili utili (per agente): DB_DATABASE, PORT.
 */
import { spawnSync } from 'node:child_process'

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const passi = [
  ['typecheck', npx, ['tsc', '--noEmit']],
  ['lint', npx, ['eslint', '.']],
  ['dipendenze native', process.execPath, ['scripts/controlla-dipendenze-native.mjs']],
  ['test unit', process.execPath, ['ace', 'test', 'unit']],
  ['test funzionali', process.execPath, ['ace', 'test', 'functional']],
]

const esiti = []
for (const [nome, comando, argomenti] of passi) {
  console.log(`\n=== ${nome} ===`)
  const inizio = Date.now()
  const r = spawnSync(comando, argomenti, {
    stdio: 'inherit',
    shell: process.platform === 'win32' && comando.endsWith('.cmd'),
  })
  const secondi = ((Date.now() - inizio) / 1000).toFixed(1)
  esiti.push(`${r.status === 0 ? 'OK     ' : 'ERRORE '} ${nome} (${secondi} s)`)
  if (r.status !== 0) {
    console.error(`\n${esiti.join('\n')}\n\nverifica FALLITA al passo "${nome}"`)
    process.exit(r.status ?? 1)
  }
}
console.log(`\n${esiti.join('\n')}\n\nverifica OK`)
