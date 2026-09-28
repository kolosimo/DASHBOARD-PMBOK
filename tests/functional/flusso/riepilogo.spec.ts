/**
 * riepilogoFlusso e serieCfd sui dati di esempio (CL-2026-031 al 24/09/2026),
 * geometria del CFD (funzione pura).
 */
import { test } from '@japa/runner'
import Commessa from '#models/commessa'
import { riepilogoFlusso, serieCfd } from '#modules/flusso/queries'
import { graficoCfd } from '#modules/flusso/grafico_cfd'
import { conTransazione } from '#tests/helpers/db'

const OGGI = '2026-09-24'

test.group('Flusso · riepilogoFlusso', (group) => {
  conTransazione(group)

  test('colonne, WIP, età nello stato, ore, throughput e cycle time', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const r = await riepilogoFlusso(c.id, OGGI)
    assert.equal(r.commessaId, c.id)
    assert.deepEqual(
      r.colonne.map((col) => [col.codice, col.schede.length, col.limiteWip, col.oltreLimite]),
      [
        ['da_fare', 0, null, false],
        ['in_corso', 5, 4, true],
        ['in_verifica', 3, 3, false],
        ['emesso', 1, null, false],
      ]
    )
    const schede = r.colonne.flatMap((col) => col.schede)
    const ele = schede.find((s) => s.codice === 'ELE-SC-201')!
    assert.equal(ele.etaGiorni, 15)
    assert.equal(ele.statoNome, 'Calcoli e dimensionamento')
    assert.equal(ele.budgetMinuti, 64 * 60)
    assert.equal(ele.acMinuti, (40 + 11) * 60) // storico + ore W39
    const emesso = schede.find((s) => s.codice === 'MEC-CA-002')!
    assert.isNull(emesso.etaGiorni)
    const ant = schede.find((s) => s.codice === 'ANT-RT-401')!
    assert.equal(ant.classeServizio, 'data_fissa')
    assert.equal(ant.dataFissa, '2026-09-30')

    assert.lengthOf(r.throughput, 8)
    assert.equal(r.throughput[7].settimana, '2026-09-21')
    assert.equal(r.throughput[0].settimana, '2026-08-03')
    assert.equal(r.throughput[7].conteggio, 1) // MEC-CA-002 emesso il 24/09
    assert.equal(
      r.throughput.reduce((s, t) => s + t.conteggio, 0),
      1
    )
    // MEC-CA-002: esce da "Non iniziato" il 27/08 (4 stati × 7 giorni prima), emesso il 24/09
    assert.equal(r.cycleTimeMedioGiorni, 28)
  })

  test('commessa senza elaborati: colonne vuote, cycle time null', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const r = await riepilogoFlusso(c.id, OGGI)
    assert.isTrue(r.colonne.every((col) => col.schede.length === 0 && !col.oltreLimite))
    assert.isNull(r.cycleTimeMedioGiorni)
    assert.isTrue(r.throughput.every((t) => t.conteggio === 0))
  })
})

test.group('Flusso · CFD', (group) => {
  conTransazione(group)

  test('serie dai dati di esempio: 9 elaborati al giorno, nessuno prima del 01/07', async ({
    assert,
  }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const serie = await serieCfd(c.id, '2026-06-30', OGGI)
    assert.deepEqual(
      serie.colonne.map((col) => col.codice),
      ['da_fare', 'in_corso', 'in_verifica', 'emesso']
    )
    const somma = (i: number) => Object.values(serie.punti[i].perColonna).reduce((s, n) => s + n, 0)
    assert.equal(somma(0), 0) // 30/06
    assert.equal(somma(1), 9) // 01/07: tutti creati
    const ultimo = serie.punti[serie.punti.length - 1]
    assert.equal(ultimo.giorno, OGGI)
    assert.deepEqual(ultimo.perColonna, { da_fare: 0, in_corso: 5, in_verifica: 3, emesso: 1 })
  })

  test('geometria: aree impilate, tacche e un’etichetta per lunedì', ({ assert }) => {
    const colonne = [
      { codice: 'a', nome: 'Da fare' },
      { codice: 'b', nome: 'Emesso' },
    ]
    const punti = [
      { giorno: '2026-09-20', perColonna: { a: 2, b: 0 } },
      { giorno: '2026-09-21', perColonna: { a: 1, b: 1 } },
      { giorno: '2026-09-22', perColonna: { a: 0, b: 2 } },
    ]
    const g = graficoCfd(colonne, punti)
    assert.isFalse(g.vuoto)
    assert.equal(g.massimo, 2)
    assert.deepEqual(
      g.aree.map((a) => [a.codice, a.livello, a.ultimo]),
      [
        ['a', 1, 0],
        ['b', 0, 2],
      ]
    )
    for (const a of g.aree) assert.match(a.tracciato, /^M[\d.]+,[\d.]+( L[\d.]+,[\d.]+)+ Z$/)
    assert.deepEqual(
      g.etichette.map((e) => e.giorno),
      ['2026-09-21']
    )
    assert.deepEqual(
      g.tacche.map((t) => t.valore),
      [0, 1, 2]
    )
  })

  test('serie vuota o di un solo giorno', ({ assert }) => {
    const colonne = [{ codice: 'a', nome: 'Da fare' }]
    assert.isTrue(graficoCfd(colonne, []).vuoto)
    const g = graficoCfd(colonne, [{ giorno: '2026-09-21', perColonna: { a: 3 } }])
    assert.isFalse(g.vuoto)
    assert.include(g.aree[0].tracciato, 'Z')
  })
})
