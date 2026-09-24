import testUtils from '@adonisjs/core/services/test_utils'
import type { Group } from '@japa/runner/core'

/**
 * Ogni test del gruppo gira in una transazione globale annullata alla fine:
 * i dati di esempio restano intatti per il test successivo.
 */
export function conTransazione(group: Group) {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
}
