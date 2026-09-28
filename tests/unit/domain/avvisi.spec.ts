/**
 * Test del verificatore T1 per app/domain/avvisi.ts (Obeya: "da affrontare in riunione").
 * Soglie da app/domain/soglie.ts (SOGLIE_DEFAULT, valori di esempio).
 * Casi calcolati a mano: docs/formule/casi-di-prova.md (sezione Avvisi).
 *
 * Il contratto fissa gravità, ordine e contenuto dei messaggi ma non il testo
 * esatto né i codici: si verificano gravità, ordine e le parti essenziali
 * del messaggio. Le ore nei messaggi sono ore intere (formato.ore, come nel prototipo).
 */
import { test } from '@japa/runner'
import { generaAvvisi, type DatiAvvisi, type SoglieAvvisi } from '#domain/avvisi'
import { SOGLIE_DEFAULT } from '#domain/soglie'

const SOGLIE: SoglieAvvisi = {
  spi: SOGLIE_DEFAULT.spi,
  cpi: SOGLIE_DEFAULT.cpi,
  giorniPreavvisoVincoli: 7,
  giorniElaboratoFermo: 10,
}

/** Dati neutri: nessun avviso */
function datiVuoti(): DatiAvvisi {
  return {
    spi: 1,
    cpi: 1,
    pvMinuti: 6000,
    evMinuti: 6000,
    bacMinuti: 12_000,
    eacMinuti: 12_000,
    etcMinuti: 6000,
    oggi: '2026-09-24',
    vincoliAperti: [],
    colonne: [],
    elaboratiFermi: [],
  }
}

/** CL-2026-031 al 24/09/2026 (dati di esempio) */
function datiCl2026031(): DatiAvvisi {
  return {
    spi: 14_520 / 18_720, // 0,7756
    cpi: 0.75625,
    pvMinuti: 18_720,
    evMinuti: 14_520,
    bacMinuti: 25_440,
    eacMinuti: 33_640,
    etcMinuti: 14_440,
    oggi: '2026-09-24',
    vincoliAperti: [
      {
        codice: 'V-12',
        descrizione: "Layout arredi P1 dall'architetto",
        dataNecessaria: '2026-09-29',
      },
      {
        codice: 'V-13',
        descrizione: 'Planimetria architettonica rev. C',
        dataNecessaria: '2026-09-29',
      },
      {
        codice: 'V-14',
        descrizione: "Conferma ricambi d'aria dal committente",
        dataNecessaria: '2026-10-06',
      },
      {
        codice: 'V-15',
        descrizione: 'Verificatore interno disponibile',
        dataNecessaria: '2026-09-29',
      },
      {
        codice: 'V-16',
        descrizione: 'Tavole strutturali aggiornate dallo strutturista',
        dataNecessaria: '2026-10-13',
      },
    ],
    colonne: [
      { nome: 'Da fare', conteggio: 2, limite: null },
      { nome: 'In corso', conteggio: 5, limite: 4 },
      { nome: 'In verifica', conteggio: 3, limite: 3 },
      { nome: 'Emesso', conteggio: 1, limite: null },
    ],
    elaboratiFermi: [
      { codice: 'ELE-SC-201', giorniNelloStato: 15 },
      { codice: 'MEC-PL-102', giorniNelloStato: 10 },
      { codice: 'IDR-PL-301', giorniNelloStato: 9 },
    ],
  }
}

test.group('Avvisi · Obeya', () => {
  test('CL-2026-031: 2 critici, poi vincoli, WIP ed elaborati fermi, in quest’ordine', ({
    assert,
  }) => {
    const avvisi = generaAvvisi(datiCl2026031(), SOGLIE)
    assert.deepEqual(
      avvisi.map((a) => a.gravita),
      [
        'critico',
        'critico',
        'attenzione',
        'attenzione',
        'attenzione',
        'attenzione',
        'attenzione',
        'attenzione',
      ]
    )
    const [spi, cpi, v1, v2, v3, wip, f1, f2] = avvisi.map((a) => a.messaggio)

    // 1. SPI 0,78 in rosso: PV − EV = 18.720 − 14.520 = 4.200 min = 70 h
    assert.match(spi, /^SPI /)
    assert.include(spi, 'in ritardo di 70 h')
    assert.include(spi, 'rispetto al piano')

    // 2. CPI 0,76 in rosso: EAC 33.640 min ≈ 561 h, BAC 424 h, ETC 14.440 min ≈ 241 h
    assert.match(cpi, /^CPI /)
    assert.include(cpi, '561 h')
    assert.include(cpi, '424 h')
    assert.include(cpi, '241 h')

    // 3. vincoli entro 7 giorni dal 24/09 (≤ 01/10): V-12, V-13, V-15, nell'ordine dei dati
    assert.include(v1, 'V-12')
    assert.include(v2, 'V-13')
    assert.include(v3, 'V-15')

    // 4. solo "In corso" (5 su 4) è oltre il limite; "In verifica" (3 su 3) no
    assert.include(wip, 'In corso')

    // 5. fermi da ≥ 10 giorni: ELE-SC-201 (15) e MEC-PL-102 (10); IDR-PL-301 (9) no
    assert.include(f1, 'ELE-SC-201')
    assert.include(f1, '15')
    assert.include(f2, 'MEC-PL-102')

    const tutti = avvisi.map((a) => a.messaggio).join('\n')
    assert.notInclude(tutti, 'V-14')
    assert.notInclude(tutti, 'V-16')
    assert.notInclude(tutti, 'In verifica')
    assert.notInclude(tutti, 'IDR-PL-301')
    for (const a of avvisi) assert.isAbove(a.codice.length, 0)
  })

  test('nessuna condizione → nessun avviso', ({ assert }) => {
    assert.deepEqual(generaAvvisi(datiVuoti(), SOGLIE), [])
  })

  test('indici null non generano avvisi', ({ assert }) => {
    const dati = { ...datiVuoti(), spi: null, cpi: null, eacMinuti: null, etcMinuti: null }
    assert.deepEqual(generaAvvisi(dati, SOGLIE), [])
  })

  test('SPI e CPI in giallo (0,90) non generano avvisi; al confine del rosso (0,85) nemmeno', ({
    assert,
  }) => {
    assert.deepEqual(generaAvvisi({ ...datiVuoti(), spi: 0.9, cpi: 0.9 }, SOGLIE), [])
    assert.deepEqual(generaAvvisi({ ...datiVuoti(), spi: 0.85, cpi: 0.85 }, SOGLIE), [])
  })

  test('appena sotto 0,85 → critico', ({ assert }) => {
    const avvisi = generaAvvisi(
      { ...datiVuoti(), spi: 0.8499, pvMinuti: 6000, evMinuti: 5100 },
      SOGLIE
    )
    assert.lengthOf(avvisi, 1)
    assert.equal(avvisi[0].gravita, 'critico')
    assert.include(avvisi[0].messaggio, 'in ritardo di 15 h') // (6000 − 5100) / 60
  })

  test('le soglie vengono dal parametro (impostazioni), non sono fisse', ({ assert }) => {
    const permissive: SoglieAvvisi = {
      ...SOGLIE,
      spi: { verde: 0.7, giallo: 0.6, verso: 'alto' },
      cpi: { verde: 0.7, giallo: 0.6, verso: 'alto' },
    }
    const d = { ...datiCl2026031(), vincoliAperti: [], colonne: [], elaboratiFermi: [] }
    assert.deepEqual(generaAvvisi(d, permissive), [])
    const severe: SoglieAvvisi = {
      ...SOGLIE,
      spi: { verde: 1.2, giallo: 1.1, verso: 'alto' },
      cpi: { verde: 1.2, giallo: 1.1, verso: 'alto' },
    }
    const avvisi = generaAvvisi({ ...datiVuoti(), spi: 1, cpi: 1 }, severe)
    assert.deepEqual(
      avvisi.map((a) => a.gravita),
      ['critico', 'critico']
    )
  })

  test('vincoli: scaduti e al limite del preavviso sì; oltre o senza data no', ({ assert }) => {
    const d: DatiAvvisi = {
      ...datiVuoti(),
      vincoliAperti: [
        { codice: 'V-1', descrizione: 'già scaduto', dataNecessaria: '2026-09-20' },
        { codice: 'V-2', descrizione: 'oggi', dataNecessaria: '2026-09-24' },
        { codice: 'V-3', descrizione: 'oggi + 7', dataNecessaria: '2026-10-01' },
        { codice: 'V-4', descrizione: 'oggi + 8', dataNecessaria: '2026-10-02' },
        { codice: 'V-5', descrizione: 'senza data', dataNecessaria: null },
      ],
    }
    const avvisi = generaAvvisi(d, SOGLIE)
    assert.lengthOf(avvisi, 3)
    assert.isTrue(avvisi.every((a) => a.gravita === 'attenzione'))
    assert.include(avvisi[0].messaggio, 'V-1')
    assert.include(avvisi[1].messaggio, 'V-2')
    assert.include(avvisi[2].messaggio, 'V-3')
  })

  test('preavviso a cavallo di fine anno: oggi 28/12/2026, 7 giorni → fino al 04/01/2027', ({
    assert,
  }) => {
    const d: DatiAvvisi = {
      ...datiVuoti(),
      oggi: '2026-12-28',
      vincoliAperti: [
        { codice: 'V-8', descrizione: 'a gennaio', dataNecessaria: '2027-01-04' },
        { codice: 'V-9', descrizione: 'troppo avanti', dataNecessaria: '2027-01-05' },
      ],
    }
    const avvisi = generaAvvisi(d, SOGLIE)
    assert.lengthOf(avvisi, 1)
    assert.include(avvisi[0].messaggio, 'V-8')
  })

  test('WIP: oltre il limite sì, uguale al limite no, senza limite mai', ({ assert }) => {
    const d: DatiAvvisi = {
      ...datiVuoti(),
      colonne: [
        { nome: 'In corso', conteggio: 4, limite: 4 },
        { nome: 'In verifica', conteggio: 4, limite: 3 },
        { nome: 'Da fare', conteggio: 30, limite: null },
      ],
    }
    const avvisi = generaAvvisi(d, SOGLIE)
    assert.lengthOf(avvisi, 1)
    assert.equal(avvisi[0].gravita, 'attenzione')
    assert.include(avvisi[0].messaggio, 'In verifica')
  })

  test('elaborati fermi: soglia inclusa (≥ giorni)', ({ assert }) => {
    const d: DatiAvvisi = {
      ...datiVuoti(),
      elaboratiFermi: [
        { codice: 'A', giorniNelloStato: 9 },
        { codice: 'B-10', giorniNelloStato: 10 },
      ],
    }
    const avvisi = generaAvvisi(d, SOGLIE)
    assert.lengthOf(avvisi, 1)
    assert.include(avvisi[0].messaggio, 'B-10')
  })
})
