import { test } from '@japa/runner'
import { _svuotaRegistro, eseguiOra, prossimaEsecuzione, registraJob } from '#shared/scheduler'

test.group('Scheduler in-process', (group) => {
  group.each.teardown(() => _svuotaRegistro())

  test('settimanale lunedì 06:00 ora di Roma, anche dopo il cambio d’ora', ({ assert }) => {
    const p = { tipo: 'settimanale', giorno: 1, ora: 6, minuto: 0 } as const
    // giovedì 22/10/2026 (CEST) → lunedì 26/10/2026 06:00 CET = 05:00 UTC
    assert.equal(
      prossimaEsecuzione(p, new Date('2026-10-22T10:00:00Z')).toISOString(),
      '2026-10-26T05:00:00.000Z'
    )
    // giovedì 24/09/2026 → lunedì 28/09/2026 06:00 CEST = 04:00 UTC
    assert.equal(
      prossimaEsecuzione(p, new Date('2026-09-24T10:00:00Z')).toISOString(),
      '2026-09-28T04:00:00.000Z'
    )
    // lunedì 28/09 alle 07:00 Roma → la settimana dopo
    assert.equal(
      prossimaEsecuzione(p, new Date('2026-09-28T05:00:00Z')).toISOString(),
      '2026-10-05T04:00:00.000Z'
    )
  })

  test('giornaliera', ({ assert }) => {
    const p = { tipo: 'giornaliera', ora: 23, minuto: 30 } as const
    assert.equal(
      prossimaEsecuzione(p, new Date('2026-09-24T10:00:00Z')).toISOString(),
      '2026-09-24T21:30:00.000Z'
    )
  })

  test('un job non parte due volte in parallelo e gli errori non si propagano', async ({
    assert,
  }) => {
    let esecuzioni = 0
    let sblocca: () => void = () => {}
    registraJob({
      nome: 'prova',
      descrizione: 'job di prova',
      pianificazione: { tipo: 'intervallo', ogniMs: 60_000 },
      esegui: () =>
        new Promise<void>((ok) => {
          esecuzioni++
          sblocca = ok
        }),
    })
    const prima = eseguiOra('prova')
    await eseguiOra('prova')
    sblocca()
    await prima
    assert.equal(esecuzioni, 1)

    registraJob({
      nome: 'rotto',
      descrizione: 'job che fallisce',
      pianificazione: { tipo: 'intervallo', ogniMs: 60_000 },
      esegui: async () => {
        throw new Error('boom')
      },
    })
    await assert.doesNotReject(() => eseguiOra('rotto'))
    assert.throws(() =>
      registraJob({
        nome: 'prova',
        descrizione: 'doppione',
        pianificazione: { tipo: 'intervallo', ogniMs: 1 },
        esegui: async () => {},
      })
    )
  })
})
