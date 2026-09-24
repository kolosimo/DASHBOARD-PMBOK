import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'
import pg from 'pg'

/**
 * Conversioni dei tipi PostgreSQL:
 * - DATE (1082) resta stringa 'YYYY-MM-DD': niente conversioni di fuso orario
 *   (le settimane sono date del lunedì, Europe/Rome).
 * - INT8 (20) diventa number: usato da COUNT(*) e SUM(); i valori restano
 *   ben sotto Number.MAX_SAFE_INTEGER (minuti, conteggi).
 * - NUMERIC (1700) diventa number (indici SPI/CPI negli snapshot).
 */
pg.types.setTypeParser(1082, (valore: string) => valore)
pg.types.setTypeParser(20, (valore: string) => Number.parseInt(valore, 10))
pg.types.setTypeParser(1700, (valore: string) => Number.parseFloat(valore))

const dbConfig = defineConfig({
  connection: 'pg',
  prettyPrintDebugQueries: true,

  connections: {
    pg: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      seeders: {
        paths: ['database/seeders'],
      },
      /**
       * I modelli sono scritti a mano in app/models: la generazione
       * automatica di database/schema.ts è disattivata.
       */
      schemaGeneration: {
        enabled: false,
      },
      debug: false,
    },
  },
})

export default dbConfig
