import { assert } from '@japa/assert'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { dbAssertions } from '@adonisjs/lucid/plugins/db'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Configurazione dei test (Japa). Il DB di test si sceglie con DB_DATABASE
 * (default in .env.test: cruscotto_test). Ogni agente usa il proprio:
 *   DB_DATABASE=cruscotto_test_a1 PORT=3401 npm run verifica
 *
 * Prima di tutti i test: schema ricreato da zero e dati di esempio.
 * Nei test funzionali ogni test gira in una transazione annullata alla fine
 * (vedi tests/helpers/db.ts).
 */
export const plugins: Config['plugins'] = [assert(), pluginAdonisJS(app), dbAssertions(app)]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [
    async () => {
      // Schema da zero (rollback di eventuali residui) e dati di esempio
      const db = testUtils.db()
      const annullaMigrazioni = await db.migrate()
      await annullaMigrazioni()
      await db.migrate()
      await db.seed()
    },
  ],
  teardown: [],
}

export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['functional'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
