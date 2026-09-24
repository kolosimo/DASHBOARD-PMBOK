import { test } from '@japa/runner'
import {
  aggiungiSettimane,
  differenzaSettimane,
  domenicaDi,
  eLunedi,
  etichettaSettimana,
  giorniLavorativi,
  lunediDaSettimanaIso,
  lunediDellaSettimana,
  settimanaIso,
  settimaneNellAnno,
  dataRoma,
} from '#shared/calendario'

test.group('Calendario · lunedì della settimana (Europe/Rome)', () => {
  test('giovedì 24/09/2026 appartiene alla settimana del 21/09 (W39)', ({ assert }) => {
    assert.equal(lunediDellaSettimana('2026-09-24'), '2026-09-21')
    assert.deepEqual(settimanaIso('2026-09-24'), { anno: 2026, settimana: 39 })
    assert.equal(etichettaSettimana('2026-09-21'), 'W39')
  })

  test('il lunedì resta sé stesso e la domenica chiude la settimana', ({ assert }) => {
    assert.equal(lunediDellaSettimana('2026-09-21'), '2026-09-21')
    assert.equal(lunediDellaSettimana('2026-09-27'), '2026-09-21')
    assert.equal(domenicaDi('2026-09-21'), '2026-09-27')
  })

  test('ora legale: domenica 23:30 UTC in estate è già lunedì a Roma', ({ assert }) => {
    // 2026-09-27T22:30Z = lunedì 28/09 00:30 CEST (UTC+2)
    assert.equal(dataRoma('2026-09-27T22:30:00Z'), '2026-09-28')
    assert.equal(lunediDellaSettimana(new Date('2026-09-27T22:30:00Z')), '2026-09-28')
    // 2026-09-27T21:30Z = domenica 23:30 a Roma
    assert.equal(lunediDellaSettimana(new Date('2026-09-27T21:30:00Z')), '2026-09-21')
  })

  test('fine dell’ora legale (25/10/2026): lunedì 00:30 CET = domenica 23:30 UTC', ({ assert }) => {
    assert.equal(lunediDellaSettimana(new Date('2026-10-25T23:30:00Z')), '2026-10-26')
    assert.equal(lunediDellaSettimana(new Date('2026-10-25T22:30:00Z')), '2026-10-19')
  })

  test('inizio dell’ora legale (29/03/2026): lunedì 30/03 00:30 CEST', ({ assert }) => {
    assert.equal(lunediDellaSettimana(new Date('2026-03-29T22:30:00Z')), '2026-03-30')
    assert.equal(lunediDellaSettimana(new Date('2026-03-29T21:30:00Z')), '2026-03-23')
  })

  test('settimana 53: il 2026 ne ha 53, il 2025 e il 2027 52', ({ assert }) => {
    assert.equal(settimaneNellAnno(2026), 53)
    assert.equal(settimaneNellAnno(2025), 52)
    assert.equal(settimaneNellAnno(2027), 52)
    assert.equal(lunediDaSettimanaIso(2026, 53), '2026-12-28')
    // 1–3 gennaio 2027 sono ancora nella W53 del 2026
    assert.deepEqual(settimanaIso('2027-01-03'), { anno: 2026, settimana: 53 })
    assert.equal(lunediDellaSettimana('2027-01-01'), '2026-12-28')
    assert.equal(aggiungiSettimane('2026-12-28', 1), '2027-01-04')
    assert.deepEqual(settimanaIso('2027-01-04'), { anno: 2027, settimana: 1 })
  })

  test('la settimana 53 non esiste nel 2025', ({ assert }) => {
    assert.throws(() => lunediDaSettimanaIso(2025, 53), /non esiste/)
    assert.throws(() => lunediDaSettimanaIso(2026, 0), /non esiste/)
  })

  test('29/12/2025 è nella W1 del 2026', ({ assert }) => {
    assert.deepEqual(settimanaIso('2025-12-29'), { anno: 2026, settimana: 1 })
    assert.equal(lunediDaSettimanaIso(2026, 1), '2025-12-29')
  })

  test('aritmetica delle settimane attraverso il cambio d’ora', ({ assert }) => {
    assert.equal(aggiungiSettimane('2026-10-19', 1), '2026-10-26')
    assert.equal(aggiungiSettimane('2026-03-23', 1), '2026-03-30')
    assert.equal(aggiungiSettimane('2026-09-21', -2), '2026-09-07')
    assert.equal(differenzaSettimane('2026-09-07', '2026-09-21'), 2)
    assert.equal(differenzaSettimane('2026-03-23', '2026-11-02'), 32)
  })

  test('giorni lavorativi e controllo del lunedì', ({ assert }) => {
    assert.deepEqual(giorniLavorativi('2026-09-21'), [
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ])
    assert.isTrue(eLunedi('2026-09-21'))
    assert.isFalse(eLunedi('2026-09-22'))
    assert.isFalse(eLunedi('2026-02-30'))
    assert.throws(() => aggiungiSettimane('2026-09-22', 1), /Non è un lunedì/)
  })
})
