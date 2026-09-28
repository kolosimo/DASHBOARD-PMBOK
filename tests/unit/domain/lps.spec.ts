/**
 * Test del verificatore T1 per app/domain/lps.ts (PPC, PCR, TMR/TA, Pareto).
 * Casi calcolati a mano: docs/formule/casi-di-prova.md (sezione Last Planner).
 */
import { test } from '@japa/runner'
import { calcolaPcr, calcolaPpc, calcolaTmrTa, paretoCause } from '#domain/lps'
import type { AttivitaSnapshotLps, ImpegnoLps, VincoloLps } from '#domain/types'

let prossimoId = 1
function imp(
  fatto: boolean | null,
  aggiuntoDopoPromessa = false,
  causaId: number | null = null
): ImpegnoLps {
  return { impegnoId: prossimoId++, fatto, causaId, aggiuntoDopoPromessa }
}

// ---------------------------------------------------------------------------
// PPC
// ---------------------------------------------------------------------------

test.group('LPS · PPC', () => {
  test('W39 (dati di esempio): 5 fatti su 7 promessi → 0,714', ({ assert }) => {
    const impegni = [
      imp(true),
      imp(true),
      imp(true),
      imp(true),
      imp(true),
      imp(false, false, 1),
      imp(false, false, 4),
    ]
    const r = calcolaPpc(impegni)
    assert.equal(r.promessi, 7)
    assert.equal(r.fatti, 5)
    assert.equal(r.ppc, 5 / 7)
    assert.closeTo(r.ppc!, 0.714, 0.001)
  })

  test('un impegno aggiunto dopo la promessa è escluso da numeratore e denominatore', ({
    assert,
  }) => {
    const base = [imp(true), imp(true), imp(true), imp(true), imp(true), imp(false), imp(false)]
    assert.deepEqual(calcolaPpc([...base, imp(true, true)]), { promessi: 7, fatti: 5, ppc: 5 / 7 })
    assert.deepEqual(calcolaPpc([...base, imp(false, true)]), { promessi: 7, fatti: 5, ppc: 5 / 7 })
    assert.deepEqual(calcolaPpc([...base, imp(null, true)]), { promessi: 7, fatti: 5, ppc: 5 / 7 })
  })

  test('un impegno non segnato (fatto = null) conta come promesso e non fatto', ({ assert }) => {
    assert.deepEqual(calcolaPpc([imp(true), imp(null), imp(false), imp(true)]), {
      promessi: 4,
      fatti: 2,
      ppc: 0.5,
    })
  })

  test('tutti fatti → 1; nessuno fatto → 0 (non null)', ({ assert }) => {
    assert.deepEqual(calcolaPpc([imp(true), imp(true)]), { promessi: 2, fatti: 2, ppc: 1 })
    assert.deepEqual(calcolaPpc([imp(false), imp(null)]), { promessi: 2, fatti: 0, ppc: 0 })
  })

  test('nessun impegno promesso → PPC null', ({ assert }) => {
    assert.deepEqual(calcolaPpc([]), { promessi: 0, fatti: 0, ppc: null })
  })

  test('solo impegni aggiunti dopo la promessa → PPC null', ({ assert }) => {
    assert.deepEqual(calcolaPpc([imp(true, true), imp(false, true)]), {
      promessi: 0,
      fatti: 0,
      ppc: null,
    })
  })
})

// ---------------------------------------------------------------------------
// PCR
// ---------------------------------------------------------------------------

function vin(
  vincoloId: number,
  campi: Partial<Omit<VincoloLps, 'vincoloId'>> & { dataNecessaria: string | null }
): VincoloLps {
  return {
    vincoloId,
    stato: 'aperto',
    identificatoIl: '2026-09-10',
    rimossoIl: null,
    annullatoIl: null,
    ...campi,
  }
}

/** Registro vincoli dei dati di esempio (V-12…V-17), identificati tutti il 10/09 */
function registroEsempio(rimossoV12Il: string | null): VincoloLps[] {
  return [
    vin(12, {
      dataNecessaria: '2026-09-29',
      stato: rimossoV12Il ? 'rimosso' : 'aperto',
      rimossoIl: rimossoV12Il,
    }),
    vin(13, { dataNecessaria: '2026-09-29' }),
    vin(14, { dataNecessaria: '2026-10-06' }),
    vin(15, { dataNecessaria: '2026-09-29' }),
    vin(16, { dataNecessaria: '2026-10-13' }),
    vin(17, { dataNecessaria: '2026-10-06', stato: 'rimosso', rimossoIl: '2026-09-22' }),
  ]
}

test.group('LPS · PCR(w)', () => {
  test('W40 (28/09–04/10): V-12, V-13, V-15 da rimuovere; rimosso solo V-12 → 1/3', ({
    assert,
  }) => {
    const r = calcolaPcr(registroEsempio('2026-10-01'), '2026-09-28')
    assert.equal(r.daRimuovere, 3)
    assert.equal(r.rimossi, 1)
    assert.equal(r.pcr, 1 / 3)
  })

  test('W40 senza rimozioni → PCR 0 (non null)', ({ assert }) => {
    assert.deepEqual(calcolaPcr(registroEsempio(null), '2026-09-28'), {
      daRimuovere: 3,
      rimossi: 0,
      pcr: 0,
    })
  })

  test('W39 (21–27/09): nessun vincolo aperto scade entro il 27/09 → PCR null', ({ assert }) => {
    assert.deepEqual(calcolaPcr(registroEsempio(null), '2026-09-21'), {
      daRimuovere: 0,
      rimossi: 0,
      pcr: null,
    })
  })

  test('nessun vincolo → PCR null', ({ assert }) => {
    assert.deepEqual(calcolaPcr([], '2026-09-28'), { daRimuovere: 0, rimossi: 0, pcr: null })
  })

  test('confini della settimana sulla data necessaria: domenica sì, lunedì dopo no', ({
    assert,
  }) => {
    const r = calcolaPcr(
      [
        vin(1, { dataNecessaria: '2026-10-04' }), // domenica di W40 → dentro
        vin(2, { dataNecessaria: '2026-10-05' }), // lunedì di W41 → fuori
        vin(3, { dataNecessaria: null }), // senza data necessaria → fuori
      ],
      '2026-09-28'
    )
    assert.deepEqual(r, { daRimuovere: 1, rimossi: 0, pcr: 0 })
  })

  test('vincolo scaduto prima di w e ancora aperto al lunedì conta (data ≤ domenica)', ({
    assert,
  }) => {
    const r = calcolaPcr(
      [
        vin(1, { dataNecessaria: '2026-09-20' }),
        vin(2, { dataNecessaria: '2026-09-30', stato: 'rimosso', rimossoIl: '2026-09-30' }),
      ],
      '2026-09-28'
    )
    assert.deepEqual(r, { daRimuovere: 2, rimossi: 1, pcr: 0.5 })
  })

  test('identificazione: il lunedì stesso conta, dopo il lunedì no', ({ assert }) => {
    const r = calcolaPcr(
      [
        vin(1, { identificatoIl: '2026-09-28', dataNecessaria: '2026-10-02' }),
        vin(2, {
          identificatoIl: '2026-09-29',
          dataNecessaria: '2026-10-02',
          stato: 'rimosso',
          rimossoIl: '2026-09-30',
        }),
      ],
      '2026-09-28'
    )
    assert.deepEqual(r, { daRimuovere: 1, rimossi: 0, pcr: 0 })
  })

  test('stato "da analizzare" al lunedì conta come aperto', ({ assert }) => {
    const r = calcolaPcr(
      [vin(1, { stato: 'da_analizzare', dataNecessaria: '2026-10-01' })],
      '2026-09-28'
    )
    assert.deepEqual(r, { daRimuovere: 1, rimossi: 0, pcr: 0 })
  })

  test('rimozione: prima del lunedì esce; il lunedì e la domenica contano; dopo w no', ({
    assert,
  }) => {
    const r = calcolaPcr(
      [
        // rimosso domenica 27/09, prima di w → fuori dal denominatore
        vin(1, { dataNecessaria: '2026-10-01', stato: 'rimosso', rimossoIl: '2026-09-27' }),
        // rimosso lunedì 28/09 → dentro, rimosso
        vin(2, { dataNecessaria: '2026-10-01', stato: 'rimosso', rimossoIl: '2026-09-28' }),
        // rimosso domenica 04/10 → dentro, rimosso
        vin(3, { dataNecessaria: '2026-10-01', stato: 'rimosso', rimossoIl: '2026-10-04' }),
        // rimosso lunedì 05/10, dopo w → dentro, non rimosso entro w
        vin(4, { dataNecessaria: '2026-10-01', stato: 'rimosso', rimossoIl: '2026-10-05' }),
      ],
      '2026-09-28'
    )
    assert.deepEqual(r, { daRimuovere: 3, rimossi: 2, pcr: 2 / 3 })
  })

  test('annullati: prima del lunedì o durante w escono dal conteggio; dopo w restano', ({
    assert,
  }) => {
    const r = calcolaPcr(
      [
        vin(1, { dataNecessaria: '2026-10-01', stato: 'annullato', annullatoIl: '2026-09-25' }),
        vin(2, { dataNecessaria: '2026-10-01', stato: 'annullato', annullatoIl: '2026-09-30' }),
        vin(3, { dataNecessaria: '2026-10-01', stato: 'annullato', annullatoIl: '2026-10-06' }),
        vin(4, { dataNecessaria: '2026-10-01', stato: 'rimosso', rimossoIl: '2026-10-02' }),
      ],
      '2026-09-28'
    )
    assert.deepEqual(r, { daRimuovere: 2, rimossi: 1, pcr: 0.5 })
  })

  test('tutti annullati durante w → denominatore 0 → PCR null', ({ assert }) => {
    const r = calcolaPcr(
      [vin(1, { dataNecessaria: '2026-10-01', stato: 'annullato', annullatoIl: '2026-09-29' })],
      '2026-09-28'
    )
    assert.deepEqual(r, { daRimuovere: 0, rimossi: 0, pcr: null })
  })

  test('W53 2026 (28/12–03/01/2027): la domenica è nel 2027', ({ assert }) => {
    const r = calcolaPcr(
      [
        vin(1, {
          dataNecessaria: '2027-01-02',
          stato: 'rimosso',
          rimossoIl: '2027-01-03',
        }),
        vin(2, { dataNecessaria: '2027-01-03' }),
        vin(3, { dataNecessaria: '2027-01-04' }), // W1 2027 → fuori
      ],
      '2026-12-28'
    )
    assert.deepEqual(r, { daRimuovere: 2, rimossi: 1, pcr: 0.5 })
  })

  test('settimana del cambio dell’ora legale (19–25/10/2026): la domenica 25/10 è dentro', ({
    assert,
  }) => {
    const r = calcolaPcr(
      [
        vin(1, { dataNecessaria: '2026-10-25', stato: 'rimosso', rimossoIl: '2026-10-25' }),
        vin(2, { dataNecessaria: '2026-10-26' }),
      ],
      '2026-10-19'
    )
    assert.deepEqual(r, { daRimuovere: 1, rimossi: 1, pcr: 1 })
  })
})

// ---------------------------------------------------------------------------
// TMR / TA
// ---------------------------------------------------------------------------

function att(codiceAttivita: string, settimanaInizio: string, settimanaFine: string) {
  return { codiceAttivita, settimanaInizio, settimanaFine, pronta: false } as AttivitaSnapshotLps
}

/** Snapshot del lookahead scattato a W38 (14/09) per la settimana w = W40 (28/09) */
const SNAPSHOT_W38: AttivitaSnapshotLps[] = [
  att('L1', '2026-09-21', '2026-09-28'), // finisce in w → anticipata
  att('L2', '2026-09-28', '2026-10-12'), // inizia in w → anticipata
  att('L3', '2026-10-05', '2026-10-12'), // dopo w → no
  att('L4', '2026-09-14', '2026-09-21'), // prima di w → no
  att('L5', '2026-09-14', '2026-10-05'), // attraversa w → anticipata
]

test.group('LPS · TMR / TA', () => {
  test('caso normale: 3 anticipate, 2 entrate nel piano di 5 impegni', ({ assert }) => {
    // Anticipate(W40) = {L1, L2, L5}; nel piano: L1, L2 (anticipate), L3, X9 (no); 5 impegni
    const r = calcolaTmrTa('2026-09-28', SNAPSHOT_W38, ['L1', 'L2', 'L3', 'X9'], 5)
    assert.equal(r.tmr, 2 / 3)
    assert.equal(r.ta, 2 / 5)
  })

  test('tutte le anticipate nel piano e tutti gli impegni anticipati → 1 e 1', ({ assert }) => {
    const r = calcolaTmrTa('2026-09-28', SNAPSHOT_W38, ['L1', 'L2', 'L5'], 3)
    assert.deepEqual(r, { tmr: 1, ta: 1 })
  })

  test('nessuna anticipata entrata nel piano → TMR 0, TA 0', ({ assert }) => {
    const r = calcolaTmrTa('2026-09-28', SNAPSHOT_W38, ['L3', 'L4'], 2)
    assert.deepEqual(r, { tmr: 0, ta: 0 })
  })

  test('manca lo snapshot di w−2 → TMR e TA null', ({ assert }) => {
    assert.deepEqual(calcolaTmrTa('2026-09-28', null, ['L1', 'L2'], 2), { tmr: null, ta: null })
  })

  test('piano vuoto (0 impegni) → TA null; TMR 0', ({ assert }) => {
    const r = calcolaTmrTa('2026-09-28', SNAPSHOT_W38, [], 0)
    assert.isNull(r.ta)
    assert.equal(r.tmr, 0)
  })

  test('nessuna attività dello snapshot cade in w → TMR null; TA 0', ({ assert }) => {
    const snap = [att('L3', '2026-10-05', '2026-10-12'), att('L4', '2026-09-14', '2026-09-21')]
    const r = calcolaTmrTa('2026-09-28', snap, ['L3'], 2)
    assert.isNull(r.tmr)
    assert.equal(r.ta, 0)
  })

  test('cambio d’anno: w = W1 2027 (04/01), snapshot di W52 2026 (21/12)', ({ assert }) => {
    const snap = [
      att('A1', '2026-12-28', '2027-01-04'), // W53 2026 → W1 2027: anticipata
      att('A2', '2026-12-28', '2026-12-28'), // solo W53 → no
      att('A3', '2027-01-04', '2027-01-11'), // anticipata
    ]
    const r = calcolaTmrTa('2027-01-04', snap, ['A1', 'A2'], 4)
    assert.equal(r.tmr, 1 / 2)
    assert.equal(r.ta, 1 / 4)
  })
})

// ---------------------------------------------------------------------------
// Pareto delle cause
// ---------------------------------------------------------------------------

/** Cause dei dati di esempio, ordine 1…8. Passate volutamente in ordine sparso. */
const CAUSE = [
  { id: 8, codice: 'altro', nome: 'Altro', ordine: 8 },
  { id: 5, codice: 'stima_ottimista', nome: 'Stima troppo ottimista', ordine: 5 },
  { id: 1, codice: 'input_mancante', nome: 'Input mancante da altri', ordine: 1 },
  { id: 7, codice: 'priorita_cambiata', nome: 'Priorità cambiata dal PM', ordine: 7 },
  { id: 2, codice: 'criteri_cambiati', nome: 'Criteri o requisiti cambiati', ordine: 2 },
  { id: 4, codice: 'risorsa_non_disponibile', nome: 'Risorsa non disponibile', ordine: 4 },
  { id: 6, codice: 'errore_rilavorazione', nome: 'Errore o rilavorazione', ordine: 6 },
  { id: 3, codice: 'approvazione_attesa', nome: 'Approvazione cliente/ente attesa', ordine: 3 },
]

function nonFatti(causaId: number, n: number): ImpegnoLps[] {
  return Array.from({ length: n }, () => imp(false, false, causaId))
}

test.group('LPS · Pareto delle cause', () => {
  test('dati di esempio W31–W38: ordine decrescente, a parità per ordine della causa', ({
    assert,
  }) => {
    const impegni = [
      ...nonFatti(1, 9),
      ...nonFatti(3, 5),
      ...nonFatti(5, 4), // stima (ordine 5) prima di risorsa nell'array…
      ...nonFatti(4, 4), // …ma a parità vince risorsa (ordine 4)
      ...nonFatti(2, 3),
      ...nonFatti(7, 2),
      ...nonFatti(6, 2),
      ...nonFatti(8, 1),
      imp(true),
      imp(true),
    ]
    const r = paretoCause(impegni, CAUSE)
    assert.deepEqual(
      r.map((v) => [v.codice, v.conteggio]),
      [
        ['input_mancante', 9],
        ['approvazione_attesa', 5],
        ['risorsa_non_disponibile', 4],
        ['stima_ottimista', 4],
        ['criteri_cambiati', 3],
        ['errore_rilavorazione', 2],
        ['priorita_cambiata', 2],
        ['altro', 1],
      ]
    )
    assert.deepEqual(r[0], {
      causaId: 1,
      codice: 'input_mancante',
      nome: 'Input mancante da altri',
      conteggio: 9,
    })
  })

  test('contano solo gli impegni con fatto = false; le cause a 0 non compaiono', ({ assert }) => {
    const impegni = [
      imp(false, false, 4),
      imp(null, false, 1), // non segnato: non entra nel Pareto
      imp(true, false, 1), // fatto: la causa non conta
      imp(false, false, 4),
      imp(false, false, 2),
    ]
    assert.deepEqual(paretoCause(impegni, CAUSE), [
      {
        causaId: 4,
        codice: 'risorsa_non_disponibile',
        nome: 'Risorsa non disponibile',
        conteggio: 2,
      },
      {
        causaId: 2,
        codice: 'criteri_cambiati',
        nome: 'Criteri o requisiti cambiati',
        conteggio: 1,
      },
    ])
  })

  test('nessun impegno non fatto → elenco vuoto', ({ assert }) => {
    assert.deepEqual(paretoCause([], CAUSE), [])
    assert.deepEqual(paretoCause([imp(true), imp(null)], CAUSE), [])
  })
})
