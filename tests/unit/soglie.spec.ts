import { test } from '@japa/runner'
import { classeSemaforo, semaforo, SOGLIE_DEFAULT } from '#domain/soglie'

test.group('Soglie · semaforo unico', () => {
  test('verso alto: verde, giallo, rosso ai confini', ({ assert }) => {
    const s = SOGLIE_DEFAULT.spi
    assert.equal(semaforo(0.95, s), 'verde')
    assert.equal(semaforo(1.2, s), 'verde')
    assert.equal(semaforo(0.9499, s), 'giallo')
    assert.equal(semaforo(0.85, s), 'giallo')
    assert.equal(semaforo(0.8499, s), 'rosso')
  })

  test('verso basso', ({ assert }) => {
    const s = { verde: 5, giallo: 10, verso: 'basso' as const }
    assert.equal(semaforo(5, s), 'verde')
    assert.equal(semaforo(7, s), 'giallo')
    assert.equal(semaforo(11, s), 'rosso')
  })

  test('valori non calcolabili danno "nd"', ({ assert }) => {
    const s = SOGLIE_DEFAULT.cpi
    assert.equal(semaforo(null, s), 'nd')
    assert.equal(semaforo(undefined, s), 'nd')
    assert.equal(semaforo(Number.NaN, s), 'nd')
    assert.equal(semaforo(Number.POSITIVE_INFINITY, s), 'nd')
    assert.equal(classeSemaforo('nd'), 'n')
  })
})
