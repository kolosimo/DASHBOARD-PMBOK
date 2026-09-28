/**
 * Test del verificatore T1 per app/domain/flusso.ts (Kanban degli elaborati).
 * Casi calcolati a mano: docs/formule/casi-di-prova.md (sezione Flusso).
 * Stati: 0 Non iniziato … 5 Emesso al cliente (stato finale).
 */
import { test } from '@japa/runner'
import {
  cfd,
  controllaPassaggioStato,
  cycleTime,
  sforaWip,
  throughput,
  workItemAge,
} from '#domain/flusso'
import type { PuntoCfd, TransizioneFlusso } from '#domain/types'

const FINALE = 5

function tr(
  elaboratoId: number,
  daStatoOrdine: number | null,
  aStatoOrdine: number,
  avvenutaIl: string
): TransizioneFlusso {
  return { elaboratoId, daStatoOrdine, aStatoOrdine, avvenutaIl }
}

// ---------------------------------------------------------------------------
// Work Item Age
// ---------------------------------------------------------------------------

test.group('Flusso · Work Item Age', () => {
  test('ELE-SC-201 in "Calcoli" dal 09/09/2026 → al 24/09/2026 età 15 giorni', ({ assert }) => {
    assert.equal(workItemAge('2026-09-09T08:00:00+02:00', '2026-09-24T17:00:00+02:00'), 15)
  })

  test('stesso giorno → 0', ({ assert }) => {
    assert.equal(workItemAge('2026-09-24T08:00:00+02:00', '2026-09-24T23:59:00+02:00'), 0)
  })

  test('giorni di calendario, non blocchi di 24 h: 23:30 → 00:10 del giorno dopo = 1', ({
    assert,
  }) => {
    assert.equal(workItemAge('2026-09-09T23:30:00+02:00', '2026-09-10T00:10:00+02:00'), 1)
  })

  test('istanti in UTC convertiti in data di Roma', ({ assert }) => {
    // 27/09 22:30 UTC = lunedì 28/09 00:30 a Roma → stesso giorno di adesso
    assert.equal(workItemAge('2026-09-27T22:30:00Z', '2026-09-28T10:00:00+02:00'), 0)
    // 24/09 21:30 UTC = 24/09 23:30 a Roma
    assert.equal(workItemAge('2026-09-09T06:00:00Z', '2026-09-24T21:30:00Z'), 15)
  })

  test('ora legale (29/03/2026, giorno di 23 h): sabato 23:00 → domenica 23:30 = 1', ({
    assert,
  }) => {
    // trascorse 23,5 h ma i giorni di calendario sono 1
    assert.equal(workItemAge('2026-03-28T23:00:00+01:00', '2026-03-29T23:30:00+02:00'), 1)
  })

  test('ora solare (25/10/2026, giorno di 25 h): domenica 00:10 → lunedì 00:05 = 1', ({
    assert,
  }) => {
    // trascorse 24 h e 55 min: sempre 1 giorno di calendario
    assert.equal(workItemAge('2026-10-25T00:10:00+02:00', '2026-10-26T00:05:00+01:00'), 1)
  })

  test('cambio d’anno: 28/12/2026 → 04/01/2027 = 7', ({ assert }) => {
    assert.equal(workItemAge('2026-12-28T10:00:00+01:00', '2027-01-04T09:00:00+01:00'), 7)
  })
})

// ---------------------------------------------------------------------------
// Cycle time
// ---------------------------------------------------------------------------

/** Elaborato 1: esce da "Non iniziato" il 01/09, emesso il 15/09 */
const STORIA_EMESSO: TransizioneFlusso[] = [
  tr(1, null, 0, '2026-08-20T09:00:00+02:00'),
  tr(1, 0, 1, '2026-09-01T09:00:00+02:00'),
  tr(1, 1, 2, '2026-09-03T11:00:00+02:00'),
  tr(1, 2, 3, '2026-09-08T16:00:00+02:00'),
  tr(1, 3, 4, '2026-09-10T10:00:00+02:00'),
  tr(1, 4, 5, '2026-09-15T17:00:00+02:00'),
]

test.group('Flusso · cycle time', () => {
  test('caso normale: 01/09 → 15/09 = 14 giorni', ({ assert }) => {
    assert.equal(cycleTime(STORIA_EMESSO, FINALE), 14)
  })

  test('non ancora emesso → null', ({ assert }) => {
    assert.isNull(cycleTime(STORIA_EMESSO.slice(0, 5), FINALE))
  })

  test('nessuna transizione → null', ({ assert }) => {
    assert.isNull(cycleTime([], FINALE))
  })

  test('conta la prima uscita dallo stato iniziale e il primo arrivo allo stato finale', ({
    assert,
  }) => {
    const storia = [
      tr(2, null, 0, '2026-08-20T09:00:00+02:00'),
      tr(2, 0, 1, '2026-09-01T09:00:00+02:00'), // prima uscita da 0
      tr(2, 1, 0, '2026-09-02T09:00:00+02:00'), // torna indietro con motivo
      tr(2, 0, 1, '2026-09-04T09:00:00+02:00'),
      tr(2, 1, 2, '2026-09-05T09:00:00+02:00'),
      tr(2, 2, 3, '2026-09-06T09:00:00+02:00'),
      tr(2, 3, 4, '2026-09-07T09:00:00+02:00'),
      tr(2, 4, 5, '2026-09-10T09:00:00+02:00'), // primo arrivo allo stato finale
      tr(2, 5, 4, '2026-09-11T09:00:00+02:00'), // riaperto
      tr(2, 4, 5, '2026-09-20T09:00:00+02:00'),
    ]
    assert.equal(cycleTime(storia, FINALE), 9)
  })

  test('transizioni non in ordine cronologico: "prima" è la più vecchia', ({ assert }) => {
    const disordinate = [...STORIA_EMESSO].reverse()
    assert.equal(cycleTime(disordinate, FINALE), 14)
  })

  test('giorni sulle date di Roma: uscita il 01/09 22:30 UTC (02/09 a Roma)', ({ assert }) => {
    const storia = [
      tr(3, 0, 1, '2026-09-01T22:30:00Z'), // 02/09 00:30 a Roma
      tr(3, 1, 2, '2026-09-03T09:00:00+02:00'),
      tr(3, 2, 3, '2026-09-04T09:00:00+02:00'),
      tr(3, 3, 4, '2026-09-05T09:00:00+02:00'),
      tr(3, 4, 5, '2026-09-09T08:00:00+02:00'),
    ]
    assert.equal(cycleTime(storia, FINALE), 7)
  })

  test('uscita ed emissione nello stesso giorno → 0', ({ assert }) => {
    const storia = [
      tr(4, 0, 1, '2026-09-01T08:00:00+02:00'),
      tr(4, 1, 2, '2026-09-01T09:00:00+02:00'),
      tr(4, 2, 3, '2026-09-01T10:00:00+02:00'),
      tr(4, 3, 4, '2026-09-01T11:00:00+02:00'),
      tr(4, 4, 5, '2026-09-01T12:00:00+02:00'),
    ]
    assert.equal(cycleTime(storia, FINALE), 0)
  })

  test('a cavallo dell’ora legale e del cambio d’anno', ({ assert }) => {
    const ottobre = [
      tr(5, 0, 1, '2026-10-24T23:30:00+02:00'),
      tr(5, 4, 5, '2026-10-26T00:30:00+01:00'),
    ]
    assert.equal(cycleTime(ottobre, FINALE), 2)
    const capodanno = [
      tr(6, 0, 1, '2026-12-28T09:00:00+01:00'),
      tr(6, 4, 5, '2027-01-04T09:00:00+01:00'),
    ]
    assert.equal(cycleTime(capodanno, FINALE), 7)
  })
})

// ---------------------------------------------------------------------------
// Throughput
// ---------------------------------------------------------------------------

test.group('Flusso · throughput', () => {
  test('W39 (21–27/09): elaborati distinti arrivati allo stato finale, confini in ora di Roma', ({
    assert,
  }) => {
    const transizioni = [
      tr(1, 4, 5, '2026-09-21T00:30:00+02:00'), // lunedì 00:30 → sì
      tr(2, 4, 5, '2026-09-27T21:30:00Z'), // domenica 23:30 a Roma → sì
      tr(3, 4, 5, '2026-09-27T22:30:00Z'), // lunedì 28/09 00:30 a Roma → no
      tr(4, 4, 5, '2026-09-22T10:00:00+02:00'), // sì…
      tr(4, 5, 4, '2026-09-23T10:00:00+02:00'),
      tr(4, 4, 5, '2026-09-24T10:00:00+02:00'), // …contato una volta sola
      tr(5, 4, 5, '2026-09-20T23:59:00+02:00'), // domenica prima → no
      tr(6, 3, 4, '2026-09-23T10:00:00+02:00'), // non è lo stato finale → no
    ]
    assert.equal(throughput(transizioni, '2026-09-21', FINALE), 3)
  })

  test('nessuna transizione → 0', ({ assert }) => {
    assert.equal(throughput([], '2026-09-21', FINALE), 0)
  })

  test('nessun arrivo allo stato finale nella settimana → 0', ({ assert }) => {
    const transizioni = [
      tr(1, 0, 1, '2026-09-22T10:00:00+02:00'),
      tr(2, 4, 5, '2026-09-14T10:00:00+02:00'),
    ]
    assert.equal(throughput(transizioni, '2026-09-21', FINALE), 0)
  })

  test('W53 2026 (28/12–03/01/2027) e W1 2027', ({ assert }) => {
    const transizioni = [
      tr(1, 4, 5, '2026-12-28T08:00:00+01:00'),
      tr(2, 4, 5, '2027-01-03T12:00:00+01:00'),
      tr(3, 4, 5, '2027-01-04T00:10:00+01:00'),
    ]
    assert.equal(throughput(transizioni, '2026-12-28', FINALE), 2)
    assert.equal(throughput(transizioni, '2027-01-04', FINALE), 1)
  })

  test('settimana con il ritorno all’ora solare (19–25/10/2026)', ({ assert }) => {
    const transizioni = [
      tr(1, 4, 5, '2026-10-25T22:30:00Z'), // domenica 23:30 CET → sì
      tr(2, 4, 5, '2026-10-25T23:30:00Z'), // lunedì 26/10 00:30 CET → no
      tr(3, 4, 5, '2026-10-18T22:30:00Z'), // lunedì 19/10 00:30 CEST → sì
    ]
    assert.equal(throughput(transizioni, '2026-10-19', FINALE), 2)
  })
})

// ---------------------------------------------------------------------------
// CFD
// ---------------------------------------------------------------------------

const COLONNE: Record<number, string> = {
  0: 'da_fare',
  1: 'in_corso',
  2: 'in_corso',
  3: 'in_verifica',
  4: 'in_verifica',
  5: 'emesso',
}

/**
 * Le colonne a zero possono comparire o no: il contratto non lo fissa.
 * Si confrontano solo i conteggi diversi da zero.
 */
function senzaZeri(punti: PuntoCfd[]) {
  return punti.map((p) => ({
    giorno: p.giorno,
    perColonna: Object.fromEntries(Object.entries(p.perColonna).filter(([, n]) => n !== 0)),
  }))
}

test.group('Flusso · CFD', () => {
  test('ricostruzione a fine giornata (ora di Roma) dal 01/09 al 03/09', ({ assert }) => {
    const transizioni = [
      tr(1, null, 0, '2026-08-31T09:00:00+02:00'),
      tr(1, 0, 1, '2026-09-02T10:00:00+02:00'),
      tr(1, 1, 2, '2026-09-03T10:00:00+02:00'),
      tr(2, null, 0, '2026-08-31T09:00:00+02:00'),
      tr(2, 0, 1, '2026-09-03T21:30:00Z'), // 03/09 23:30 a Roma → conta il 03/09
      tr(3, null, 0, '2026-09-02T12:00:00+02:00'),
      tr(3, 0, 1, '2026-09-02T22:30:00Z'), // 03/09 00:30 a Roma → non conta il 02/09
      tr(4, null, 0, '2026-09-04T09:00:00+02:00'), // creato dopo l'intervallo
      tr(5, null, 0, '2026-08-20T09:00:00+02:00'),
      tr(5, 0, 1, '2026-08-21T09:00:00+02:00'),
      tr(5, 1, 2, '2026-08-24T09:00:00+02:00'),
      tr(5, 2, 3, '2026-08-26T09:00:00+02:00'),
      tr(5, 3, 4, '2026-09-01T12:00:00+02:00'),
      tr(5, 4, 5, '2026-09-02T15:00:00+02:00'),
    ]
    assert.deepEqual(senzaZeri(cfd(transizioni, COLONNE, '2026-09-01', '2026-09-03')), [
      { giorno: '2026-09-01', perColonna: { da_fare: 2, in_verifica: 1 } },
      { giorno: '2026-09-02', perColonna: { da_fare: 2, in_corso: 1, emesso: 1 } },
      { giorno: '2026-09-03', perColonna: { in_corso: 3, emesso: 1 } },
    ])
  })

  test('un solo giorno (dal = al)', ({ assert }) => {
    const transizioni = [tr(1, null, 0, '2026-09-01T09:00:00+02:00')]
    assert.deepEqual(senzaZeri(cfd(transizioni, COLONNE, '2026-09-01', '2026-09-01')), [
      { giorno: '2026-09-01', perColonna: { da_fare: 1 } },
    ])
  })

  test('nessuna transizione: un punto per giorno con colonne vuote', ({ assert }) => {
    assert.deepEqual(senzaZeri(cfd([], COLONNE, '2026-09-01', '2026-09-02')), [
      { giorno: '2026-09-01', perColonna: {} },
      { giorno: '2026-09-02', perColonna: {} },
    ])
  })

  test('ritorno all’ora solare (25/10, 25 h): tre giorni, transizione di notte', ({ assert }) => {
    const transizioni = [
      tr(1, null, 0, '2026-10-20T10:00:00+02:00'),
      tr(1, 0, 1, '2026-10-25T23:30:00Z'), // 26/10 00:30 CET
    ]
    assert.deepEqual(senzaZeri(cfd(transizioni, COLONNE, '2026-10-24', '2026-10-26')), [
      { giorno: '2026-10-24', perColonna: { da_fare: 1 } },
      { giorno: '2026-10-25', perColonna: { da_fare: 1 } },
      { giorno: '2026-10-26', perColonna: { in_corso: 1 } },
    ])
  })

  test('passaggio all’ora legale (29/03, 23 h): tre giorni, nessuno saltato', ({ assert }) => {
    const punti = cfd([], COLONNE, '2026-03-28', '2026-03-30')
    assert.deepEqual(
      punti.map((p) => p.giorno),
      ['2026-03-28', '2026-03-29', '2026-03-30']
    )
  })

  test('cambio d’anno: giorni dal 31/12/2026 al 01/01/2027', ({ assert }) => {
    const punti = cfd([], COLONNE, '2026-12-31', '2027-01-01')
    assert.deepEqual(
      punti.map((p) => p.giorno),
      ['2026-12-31', '2027-01-01']
    )
  })
})

// ---------------------------------------------------------------------------
// Regola di avanzamento e WIP
// ---------------------------------------------------------------------------

test.group('Flusso · avanzamento di uno stato alla volta', () => {
  test('avanti di uno stato: ammesso, anche senza motivo', ({ assert }) => {
    assert.isNull(controllaPassaggioStato(0, 1, null))
    assert.isNull(controllaPassaggioStato(2, 3, null))
    assert.isNull(controllaPassaggioStato(4, 5, ''))
  })

  test('avanti di più stati: rifiutato con messaggio', ({ assert }) => {
    for (const [da, a] of [
      [1, 3],
      [0, 5],
      [3, 5],
    ]) {
      const errore = controllaPassaggioStato(da, a, 'motivo qualsiasi')
      assert.isString(errore, `${da} → ${a}`)
      assert.isAbove(errore!.trim().length, 0)
    }
  })

  test('indietro con motivo: ammesso, anche di più stati', ({ assert }) => {
    assert.isNull(controllaPassaggioStato(2, 1, 'Calcoli da rifare dopo nuovo input'))
    assert.isNull(controllaPassaggioStato(5, 1, 'Riapertura su richiesta del cliente'))
  })

  test('indietro senza motivo (null, vuoto o solo spazi): rifiutato', ({ assert }) => {
    for (const motivo of [null, '', '   ']) {
      const errore = controllaPassaggioStato(3, 2, motivo)
      assert.isString(errore, `motivo ${JSON.stringify(motivo)}`)
      assert.isAbove(errore!.trim().length, 0)
    }
  })
})

test.group('Flusso · sforamento WIP', () => {
  test('WIP 4 (In corso): con 3 si può aggiungere, con 4 si sfora', ({ assert }) => {
    assert.isFalse(sforaWip(3, 4))
    assert.isTrue(sforaWip(4, 4))
    assert.isTrue(sforaWip(5, 4))
  })

  test('colonna vuota con limite 0 → sfora; senza limite mai', ({ assert }) => {
    assert.isTrue(sforaWip(0, 0))
    assert.isFalse(sforaWip(0, null))
    assert.isFalse(sforaWip(50, null))
  })
})
