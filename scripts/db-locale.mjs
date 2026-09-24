/**
 * PostgreSQL locale per sviluppo e test (non per la produzione).
 *
 *   npm run db:locale -- init           crea il cluster, lo avvia, crea utente e DB
 *   npm run db:locale -- avvia | ferma | stato
 *   npm run db:locale -- crea-db <nome>  per esempio cruscotto_test_a1 (un DB per agente)
 *
 * Variabili:
 *   PG_BIN            cartella dei binari PostgreSQL (initdb, pg_ctl, psql)
 *                     default Linux: /usr/lib/postgresql/16/bin
 *                     default Windows: C:\Program Files\PostgreSQL\16\bin
 *   PGDATA_CRUSCOTTO  cartella dei dati (default .pgdata nel repo, ignorata da git;
 *                     se si è root su Linux: /tmp/pgdata-cruscotto, di proprietà di "postgres")
 *   DB_PORT           porta (default 5432)
 *
 * Su Linux come root i comandi del server girano con l'utente "postgres",
 * perché PostgreSQL rifiuta di avviarsi come root.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, chownSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const radice = join(dirname(fileURLToPath(import.meta.url)), '..')
const windows = process.platform === 'win32'
const root = !windows && typeof process.getuid === 'function' && process.getuid() === 0
const binari =
  process.env.PG_BIN ??
  (windows ? 'C:\\Program Files\\PostgreSQL\\16\\bin' : '/usr/lib/postgresql/16/bin')
const datiDir =
  process.env.PGDATA_CRUSCOTTO ?? (root ? '/tmp/pgdata-cruscotto' : join(radice, '.pgdata'))
const porta = process.env.DB_PORT ?? '5432'
const UTENTE = 'cruscotto'
const PASSWORD = 'cruscotto'
const DATABASE = ['cruscotto_dev', 'cruscotto_test', 'cruscotto_e2e']

const bin = (nome) => join(binari, windows ? `${nome}.exe` : nome)

function esegui(nome, argomenti, { comeServer = false, tollera = false } = {}) {
  let comando = bin(nome)
  let args = argomenti
  if (root && comeServer) {
    const quota = (s) => `'${String(s).replace(/'/g, "'\\''")}'`
    args = ['postgres', '-s', '/bin/sh', '-c', [comando, ...argomenti].map(quota).join(' ')]
    comando = 'su'
  }
  const r = spawnSync(comando, args, { stdio: 'inherit' })
  if (r.status !== 0 && !tollera) {
    console.error(`comando non riuscito: ${nome} ${argomenti.join(' ')}`)
    process.exit(r.status ?? 1)
  }
  return r.status === 0
}

const psql = (sql, tollera = false) =>
  esegui(
    'psql',
    ['-h', '127.0.0.1', '-p', porta, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    {
      tollera,
    }
  )

function avvia() {
  esegui(
    'pg_ctl',
    [
      '-D',
      datiDir,
      '-l',
      join(datiDir, 'log.txt'),
      '-o',
      `-p ${porta}${windows ? '' : ' -k /tmp'}`,
      '-w',
      'start',
    ],
    { comeServer: true }
  )
}

const [azione, argomento] = process.argv.slice(2)
switch (azione) {
  case 'init': {
    if (existsSync(join(datiDir, 'PG_VERSION'))) {
      console.log(`cluster già presente in ${datiDir}`)
    } else {
      mkdirSync(datiDir, { recursive: true })
      if (root) {
        const id = spawnSync('id', ['-u', 'postgres']).stdout.toString().trim()
        const gid = spawnSync('id', ['-g', 'postgres']).stdout.toString().trim()
        chownSync(datiDir, Number(id), Number(gid))
      }
      esegui(
        'initdb',
        ['-D', datiDir, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C.UTF-8'],
        {
          comeServer: true,
        }
      )
    }
    if (!esegui('pg_ctl', ['-D', datiDir, 'status'], { comeServer: true, tollera: true })) avvia()
    psql(`CREATE ROLE ${UTENTE} LOGIN PASSWORD '${PASSWORD}' CREATEDB`, true)
    for (const db of DATABASE) psql(`CREATE DATABASE ${db} OWNER ${UTENTE}`, true)
    console.log(
      `PostgreSQL pronto su 127.0.0.1:${porta} (utente ${UTENTE}, DB ${DATABASE.join(', ')})`
    )
    break
  }
  case 'avvia':
    avvia()
    break
  case 'ferma':
    esegui('pg_ctl', ['-D', datiDir, '-m', 'fast', 'stop'], { comeServer: true })
    break
  case 'stato':
    esegui('pg_ctl', ['-D', datiDir, 'status'], { comeServer: true, tollera: true })
    break
  case 'crea-db': {
    if (!argomento || !/^[a-z0-9_]+$/.test(argomento)) {
      console.error(
        'indica il nome del DB (lettere minuscole, cifre, _), per esempio cruscotto_test_a1'
      )
      process.exit(1)
    }
    psql(`CREATE DATABASE ${argomento} OWNER ${UTENTE}`)
    break
  }
  default:
    console.log('uso: npm run db:locale -- init | avvia | ferma | stato | crea-db <nome>')
    process.exit(azione ? 1 : 0)
}
