import { test } from '@japa/runner'
import { capacitaIndicativa, ePuntoFibonacci, puntiPiano, SCALA_PUNTI } from '#domain/punti'

const imp = (punti: number | null, fatto: boolean | null, aggiuntoDopoPromessa = false) => ({
  punti,
  fatto,
  aggiuntoDopoPromessa,
})

test.group('Punti Fibonacci · scala', () => {
  test('solo 1, 2, 3, 5, 8, 13', ({ assert }) => {
    assert.deepEqual([...SCALA_PUNTI], [1, 2, 3, 5, 8, 13])
    for (const n of SCALA_PUNTI) assert.isTrue(ePuntoFibonacci(n))
    for (const n of [0, 4, 21, 2.5, -1, null, '3']) assert.isFalse(ePuntoFibonacci(n))
  })
})

test.group('Punti Fibonacci · piano', () => {
  test('somma promessi e fatti, conta i non stimati', ({ assert }) => {
    const r = puntiPiano([imp(3, true), imp(5, false), imp(8, null), imp(null, true)])
    assert.deepEqual(r, { promessi: 16, fatti: 3, stimati: 3, nonStimati: 1 })
  })

  test('gli impegni aggiunti dopo la promessa non contano (come nel PPC)', ({ assert }) => {
    const r = puntiPiano([imp(2, true), imp(13, true, true), imp(null, null, true)])
    assert.deepEqual(r, { promessi: 2, fatti: 2, stimati: 1, nonStimati: 0 })
  })

  test('piano vuoto: tutto a zero', ({ assert }) => {
    assert.deepEqual(puntiPiano([]), { promessi: 0, fatti: 0, stimati: 0, nonStimati: 0 })
  })
})

test.group('Punti Fibonacci · capacità indicativa', () => {
  const settimana = (fatti: number, stimati = 1) => ({
    promessi: fatti,
    fatti,
    stimati,
    nonStimati: 0,
  })

  test('media delle ultime 4 settimane chiuse con punti', ({ assert }) => {
    const r = capacitaIndicativa([
      settimana(29),
      settimana(18),
      settimana(25),
      settimana(23),
      settimana(100),
    ])
    assert.deepEqual(r, { media: 23.75, settimane: 4 })
  })

  test('le settimane senza stime si saltano', ({ assert }) => {
    const r = capacitaIndicativa([
      settimana(10),
      settimana(0, 0),
      settimana(20),
      settimana(30),
      settimana(40),
    ])
    assert.deepEqual(r, { media: 25, settimane: 4 })
  })

  test('meno di 4 settimane utili: n.d.', ({ assert }) => {
    assert.deepEqual(capacitaIndicativa([settimana(10), settimana(12), settimana(0, 0)]), {
      media: null,
      settimane: 2,
    })
    assert.deepEqual(capacitaIndicativa([]), { media: null, settimane: 0 })
  })
})
