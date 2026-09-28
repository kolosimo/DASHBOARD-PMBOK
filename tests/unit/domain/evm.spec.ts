/**
 * Test del verificatore T1 per app/domain/evm.ts.
 * Casi calcolati a mano: docs/formule/casi-di-prova.md (sezione EVM).
 * Tutti i valori sono in minuti interi (1 h = 60 min).
 */
import { test } from '@japa/runner'
import {
  calcolaAc,
  calcolaBac,
  calcolaCpi,
  calcolaEv,
  calcolaIndicatori,
  calcolaPv,
  calcolaSpi,
  evmDaElaborati,
} from '#domain/evm'
import type { ElaboratoEvm } from '#domain/types'

/** Pesi cumulativi confermati al Gate 0, per ordine di stato 0…5 */
const PESI = [0, 20, 50, 70, 85, 100] as const

function el(
  elaboratoId: number,
  budgetMinuti: number,
  pesoStatoPercento: number,
  pesoPianificatoPercento: number,
  acMinuti: number
): ElaboratoEvm {
  return { elaboratoId, budgetMinuti, pesoStatoPercento, pesoPianificatoPercento, acMinuti }
}

/**
 * CL-2026-031 al 24/09/2026 (dati di esempio, docs/formule/formule.md).
 * Budget, pesi attuali e pianificati come da tabella; la ripartizione di AC per
 * elaborato è di comodo (conta solo il totale 320 h = 19.200 min).
 */
const CL_2026_031: ElaboratoEvm[] = [
  el(1, 40 * 60, 70, 85, 2400), // MEC-RT-001
  el(2, 60 * 60, 100, 100, 3900), // MEC-CA-002
  el(3, 48 * 60, 50, 85, 2700), // MEC-PL-101
  el(4, 48 * 60, 20, 70, 1500), // MEC-PL-102
  el(5, 56 * 60, 50, 70, 2700), // MEC-PL-110
  el(6, 64 * 60, 50, 50, 2700), // ELE-SC-201
  el(7, 36 * 60, 70, 70, 1500), // ELE-PL-210
  el(8, 40 * 60, 20, 50, 900), // IDR-PL-301
  el(9, 32 * 60, 85, 85, 900), // ANT-RT-401
]

test.group('EVM · BAC, EV, PV, AC', () => {
  test('pesi cumulativi 0/20/50/70/85/100: EV di un elaborato da 10 h in ogni stato', ({
    assert,
  }) => {
    const attesi = [0, 120, 300, 420, 510, 600]
    PESI.forEach((peso, i) => {
      assert.equal(calcolaEv([el(1, 600, peso, 0, 0)]), attesi[i], `stato di ordine ${i}`)
    })
  })

  test('CL-2026-031: BAC 25.440, EV 14.520, PV 18.720, AC 19.200 min', ({ assert }) => {
    assert.equal(calcolaBac(CL_2026_031), 25_440) // 424 h
    assert.equal(calcolaEv(CL_2026_031), 14_520) // 242 h
    assert.equal(calcolaPv(CL_2026_031), 18_720) // 312 h
    assert.equal(calcolaAc(CL_2026_031), 19_200) // 320 h
  })

  test('EV usa il peso dello stato attuale, PV quello dello stato pianificato', ({ assert }) => {
    const e = [el(1, 1000, 20, 70, 0)]
    assert.equal(calcolaEv(e), 200)
    assert.equal(calcolaPv(e), 700)
  })

  test('arrotondamento al minuto sulla somma, non per riga', ({ assert }) => {
    // 3 elaborati da 1 min al 20%: 0,2 + 0,2 + 0,2 = 0,6 → 1 (arrotondando per riga sarebbe 0)
    const e = [el(1, 1, 20, 20, 0), el(2, 1, 20, 20, 0), el(3, 1, 20, 20, 0)]
    assert.equal(calcolaEv(e), 1)
    assert.equal(calcolaPv(e), 1)
  })

  test('arrotondamento al minuto più vicino', ({ assert }) => {
    // 7 min × 85% = 5,95 → 6; 7 min × 20% = 1,4 → 1
    assert.equal(calcolaEv([el(1, 7, 85, 20, 0)]), 6)
    assert.equal(calcolaPv([el(1, 7, 85, 20, 0)]), 1)
  })

  test('caso limite: nessun elaborato → tutto 0', ({ assert }) => {
    assert.equal(calcolaBac([]), 0)
    assert.equal(calcolaEv([]), 0)
    assert.equal(calcolaPv([]), 0)
    assert.equal(calcolaAc([]), 0)
  })

  test('AC somma i minuti registrati anche su elaborati non iniziati', ({ assert }) => {
    const e = [el(1, 600, 0, 0, 90), el(2, 600, 0, 20, 45)]
    assert.equal(calcolaAc(e), 135)
    assert.equal(calcolaEv(e), 0)
    assert.equal(calcolaPv(e), 120)
  })
})

test.group('EVM · SPI e CPI', () => {
  test('SPI = EV / PV', ({ assert }) => {
    assert.equal(calcolaSpi(2400, 3000), 0.8)
    assert.equal(calcolaSpi(3300, 3000), 1.1)
    assert.closeTo(calcolaSpi(14_520, 18_720)!, 0.775641, 1e-6)
  })

  test('SPI null se PV = 0 (settimana prima dell’inizio della baseline)', ({ assert }) => {
    assert.isNull(calcolaSpi(0, 0))
    assert.isNull(calcolaSpi(120, 0))
  })

  test('SPI = 0 se EV = 0 e PV > 0', ({ assert }) => {
    assert.strictEqual(calcolaSpi(0, 600), 0)
  })

  test('CPI = EV / AC', ({ assert }) => {
    assert.equal(calcolaCpi(2400, 3000), 0.8)
    assert.equal(calcolaCpi(3000, 2400), 1.25)
    assert.equal(calcolaCpi(14_520, 19_200), 0.75625)
  })

  test('CPI null se AC = 0 (commessa senza ore)', ({ assert }) => {
    assert.isNull(calcolaCpi(0, 0))
    assert.isNull(calcolaCpi(600, 0))
  })

  test('CPI = 0 se EV = 0 e AC > 0', ({ assert }) => {
    assert.strictEqual(calcolaCpi(0, 600), 0)
  })
})

test.group('EVM · indicatori derivati (EAC, ETC, VAC)', () => {
  test('caso normale: BAC 6000, PV 3000, EV 2400, AC 3000', ({ assert }) => {
    const r = calcolaIndicatori({ bacMinuti: 6000, pvMinuti: 3000, evMinuti: 2400, acMinuti: 3000 })
    assert.deepEqual(r, {
      bacMinuti: 6000,
      pvMinuti: 3000,
      evMinuti: 2400,
      acMinuti: 3000,
      spi: 0.8,
      cpi: 0.8,
      eacMinuti: 7500,
      etcMinuti: 4500,
      vacMinuti: -1500,
    })
  })

  test('commessa più efficiente del previsto: CPI 1,25 → VAC positivo', ({ assert }) => {
    const r = calcolaIndicatori({ bacMinuti: 6000, pvMinuti: 3000, evMinuti: 3000, acMinuti: 2400 })
    assert.equal(r.spi, 1)
    assert.equal(r.cpi, 1.25)
    assert.equal(r.eacMinuti, 4800)
    assert.equal(r.etcMinuti, 2400)
    assert.equal(r.vacMinuti, 1200)
  })

  test('EAC arrotondato al minuto; ETC e VAC dall’EAC arrotondato', ({ assert }) => {
    // CPI = 300/700 = 0,428571…; EAC = 1000 / 0,428571… = 2333,33 → 2333
    const r = calcolaIndicatori({ bacMinuti: 1000, pvMinuti: 500, evMinuti: 300, acMinuti: 700 })
    assert.closeTo(r.cpi!, 0.428571, 1e-6)
    assert.equal(r.eacMinuti, 2333)
    assert.equal(r.etcMinuti, 1633)
    assert.equal(r.vacMinuti, -1333)
    assert.isTrue(Number.isInteger(r.eacMinuti))
  })

  test('CL-2026-031: SPI 0,7756, CPI 0,75625, EAC 33.640, ETC 14.440, VAC −8.200', ({ assert }) => {
    const r = calcolaIndicatori({
      bacMinuti: 25_440,
      pvMinuti: 18_720,
      evMinuti: 14_520,
      acMinuti: 19_200,
    })
    assert.closeTo(r.spi!, 0.775641, 1e-6)
    assert.equal(r.cpi, 0.75625)
    assert.equal(r.eacMinuti, 33_640) // 25.440 / 0,75625 = 33.639,67 → 560,7 h
    assert.equal(r.etcMinuti, 14_440) // 240,7 h
    assert.equal(r.vacMinuti, -8200) // −136,7 h
  })

  test('AC = 0: CPI, EAC, ETC, VAC null; SPI calcolato', ({ assert }) => {
    const r = calcolaIndicatori({ bacMinuti: 6000, pvMinuti: 600, evMinuti: 300, acMinuti: 0 })
    assert.equal(r.spi, 0.5)
    assert.isNull(r.cpi)
    assert.isNull(r.eacMinuti)
    assert.isNull(r.etcMinuti)
    assert.isNull(r.vacMinuti)
  })

  test('EV = 0 e AC > 0: CPI 0 ed EAC, ETC, VAC null (niente divisione per zero)', ({ assert }) => {
    const r = calcolaIndicatori({ bacMinuti: 6000, pvMinuti: 600, evMinuti: 0, acMinuti: 240 })
    assert.strictEqual(r.cpi, 0)
    assert.strictEqual(r.spi, 0)
    assert.isNull(r.eacMinuti)
    assert.isNull(r.etcMinuti)
    assert.isNull(r.vacMinuti)
  })

  test('PV = 0: SPI null, il resto calcolato', ({ assert }) => {
    const r = calcolaIndicatori({ bacMinuti: 6000, pvMinuti: 0, evMinuti: 600, acMinuti: 600 })
    assert.isNull(r.spi)
    assert.equal(r.cpi, 1)
    assert.equal(r.eacMinuti, 6000)
    assert.equal(r.etcMinuti, 5400)
    assert.equal(r.vacMinuti, 0)
  })

  test('tutto a zero: tutti gli indici null', ({ assert }) => {
    const r = calcolaIndicatori({ bacMinuti: 0, pvMinuti: 0, evMinuti: 0, acMinuti: 0 })
    assert.deepEqual(r, {
      bacMinuti: 0,
      pvMinuti: 0,
      evMinuti: 0,
      acMinuti: 0,
      spi: null,
      cpi: null,
      eacMinuti: null,
      etcMinuti: null,
      vacMinuti: null,
    })
  })
})

test.group('EVM · evmDaElaborati', () => {
  test('CL-2026-031 dagli elaborati', ({ assert }) => {
    const r = evmDaElaborati(CL_2026_031)
    assert.equal(r.bacMinuti, 25_440)
    assert.equal(r.pvMinuti, 18_720)
    assert.equal(r.evMinuti, 14_520)
    assert.equal(r.acMinuti, 19_200)
    assert.closeTo(r.spi!, 0.775641, 1e-6)
    assert.equal(r.cpi, 0.75625)
    assert.equal(r.eacMinuti, 33_640)
    assert.equal(r.etcMinuti, 14_440)
    assert.equal(r.vacMinuti, -8200)
  })

  test('equivale a calcolaIndicatori sui valori di base', ({ assert }) => {
    // BAC 1500, EV 500 + 100 = 600, PV 700 + 250 = 950, AC 1000
    const e = [el(1, 1000, 50, 70, 800), el(2, 500, 20, 50, 200)]
    assert.deepEqual(
      evmDaElaborati(e),
      calcolaIndicatori({ bacMinuti: 1500, pvMinuti: 950, evMinuti: 600, acMinuti: 1000 })
    )
  })

  test('nessun elaborato: valori 0 e indici null', ({ assert }) => {
    const r = evmDaElaborati([])
    assert.equal(r.bacMinuti, 0)
    assert.isNull(r.spi)
    assert.isNull(r.cpi)
    assert.isNull(r.eacMinuti)
    assert.isNull(r.etcMinuti)
    assert.isNull(r.vacMinuti)
  })
})
