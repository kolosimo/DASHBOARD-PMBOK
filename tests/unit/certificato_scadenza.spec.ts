import { test } from '@japa/runner'
import { giorniAllaScadenza } from '../../commands/certificato_scadenza.js'

const GIORNO_MS = 24 * 60 * 60 * 1000
const adesso = new Date('2026-09-29T10:00:00Z')
const tra = (ms: number) => new Date(adesso.getTime() + ms)

test.group('Certificato HTTPS · giorniAllaScadenza', () => {
  test('giorni interi arrotondati per difetto', ({ assert }) => {
    assert.equal(giorniAllaScadenza(tra(30 * GIORNO_MS), adesso), 30)
    assert.equal(giorniAllaScadenza(tra(30 * GIORNO_MS - 1), adesso), 29)
    assert.equal(giorniAllaScadenza(tra(30 * GIORNO_MS + 1), adesso), 30)
    assert.equal(giorniAllaScadenza(tra(GIORNO_MS - 1), adesso), 0)
    assert.equal(giorniAllaScadenza(adesso, adesso), 0)
  })

  test('confine dei 30 giorni di avviso: 29 giorni e 23 ore è sotto soglia', ({ assert }) => {
    const soglia = 30
    assert.isFalse(giorniAllaScadenza(tra(30 * GIORNO_MS), adesso) < soglia)
    assert.isTrue(giorniAllaScadenza(tra(30 * GIORNO_MS - 60 * 60 * 1000), adesso) < soglia)
  })

  test('certificato scaduto: valori negativi', ({ assert }) => {
    assert.equal(giorniAllaScadenza(tra(-1), adesso), -1)
    assert.equal(giorniAllaScadenza(tra(-GIORNO_MS), adesso), -1)
    assert.equal(giorniAllaScadenza(tra(-GIORNO_MS - 1), adesso), -2)
    assert.equal(giorniAllaScadenza(tra(-10 * GIORNO_MS), adesso), -10)
  })
})
