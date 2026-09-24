import { test } from '@japa/runner'
import { spawn } from 'node:child_process'
import app from '@adonisjs/core/services/app'

/**
 * Avvio reale del server in un processo separato: con NODE_ENV=production e
 * AUTH_MODE=dev deve rifiutare di partire.
 */
test('il server rifiuta di avviarsi con NODE_ENV=production e AUTH_MODE=dev', async ({
  assert,
}) => {
  const { codice, output } = await new Promise<{ codice: number | null; output: string }>((ok) => {
    const figlio = spawn(process.execPath, ['--import=@poppinss/ts-exec', 'bin/server.ts'], {
      cwd: app.appRoot.pathname.replace(/^\/([A-Za-z]:)/, '$1'),
      env: { ...process.env, NODE_ENV: 'production', AUTH_MODE: 'dev', PORT: '3999' },
    })
    let testo = ''
    figlio.stdout.on('data', (d) => (testo += d))
    figlio.stderr.on('data', (d) => (testo += d))
    const timer = setTimeout(() => figlio.kill(), 20_000)
    figlio.on('exit', (uscita) => {
      clearTimeout(timer)
      ok({ codice: uscita, output: testo })
    })
  })
  assert.notEqual(codice, 0)
  assert.include(output, 'AUTH_MODE=dev non è ammesso con NODE_ENV=production')
}).timeout(30_000)
