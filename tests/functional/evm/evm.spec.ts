/**
 * Test funzionali del modulo EVM (agente A5).
 * Dati di esempio: CL-2026-031 al 24/09/2026 (docs/formule/formule.md).
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import { riepilogoEvm, serieCurvaS, snapshotCommessa } from '#modules/evm/queries'
import { scattaSnapshotEvm, ultimaSettimanaChiusa } from '#modules/evm/snapshot_service'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

const OGGI = '2026-09-24'

async function commessa(codice: string) {
  return Commessa.findByOrFail('codice', codice)
}

async function statoId(codice: string): Promise<number> {
  const r = await db.from('stati_elaborato').where('codice', codice).select('id').firstOrFail()
  return Number(r.id)
}

async function elaboratoId(codice: string): Promise<number> {
  const r = await db.from('elaborati').where('codice', codice).select('id').firstOrFail()
  return Number(r.id)
}

test.group('EVM · riepilogo live', (group) => {
  conTransazione(group)

  test('CL-2026-031 al 24/09/2026: BAC 424 h, PV 312 h, EV 242 h, AC 320 h', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const r = await riepilogoEvm(c.id, OGGI)
    assert.equal(r.bacMinuti, 25_440)
    assert.equal(r.pvMinuti, 18_720)
    assert.equal(r.evMinuti, 14_520)
    assert.equal(r.acMinuti, 19_200)
    assert.closeTo(r.spi!, 0.775641, 1e-6)
    assert.equal(r.cpi, 0.75625)
    assert.equal(r.eacMinuti, 33_640)
    assert.equal(r.etcMinuti, 14_440)
    assert.equal(r.vacMinuti, -8200)
    assert.equal(r.settimana, '2026-09-21')
    assert.isNotNull(r.baselineId)
    assert.lengthOf(r.perElaborato, 9)
    assert.lengthOf(r.fuoriBaseline, 0)

    const ele = r.perElaborato.find((e) => e.codice === 'ELE-SC-201')!
    assert.equal(ele.budgetMinuti, 64 * 60)
    assert.equal(ele.evMinuti, 32 * 60)
    assert.equal(ele.pvMinuti, 32 * 60)
    assert.equal(ele.statoPianificatoNome, 'Calcoli e dimensionamento')
  })

  test('commessa senza baseline né ore: nessuna divisione per zero', async ({ assert }) => {
    const c = await commessa('CL-2026-018')
    const r = await riepilogoEvm(c.id, OGGI)
    assert.isNull(r.baselineId)
    assert.equal(r.bacMinuti, 0)
    assert.equal(r.pvMinuti, 0)
    assert.equal(r.acMinuti, 0)
    assert.isNull(r.spi)
    assert.isNull(r.cpi)
    assert.isNull(r.eacMinuti)
    assert.isNull(r.etcMinuti)
    assert.isNull(r.vacMinuti)

    const serie = await serieCurvaS(c.id, OGGI)
    assert.lengthOf(serie, 1)
    assert.isFalse(serie[0].daSnapshot)
  })

  test('elaborato fuori baseline: segnalato, ore in AC, niente EV né PV', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const disciplina = await db.from('discipline').where('codice', 'MEC').firstOrFail()
    const [nuovo] = await db
      .table('elaborati')
      .insert({
        commessa_id: c.id,
        codice: 'MEC-PL-120',
        titolo: 'Centrale termica – schema',
        disciplina_id: disciplina.id,
        budget_minuti: 1200,
        stato_id: await statoId('calcoli'),
      })
      .returning(['id'])
    const utente = await db.from('utenti').where('email', 'like', 'mec2@%').firstOrFail()
    await db
      .table('registrazioni_ore')
      .insert({ utente_id: utente.id, elaborato_id: nuovo.id, data: '2026-09-22', minuti: 120 })

    const r = await riepilogoEvm(c.id, OGGI)
    assert.deepEqual(
      r.fuoriBaseline.map((e) => e.codice),
      ['MEC-PL-120']
    )
    assert.equal(r.bacMinuti, 25_440)
    assert.equal(r.evMinuti, 14_520)
    assert.equal(r.acMinuti, 19_200 + 120)
    const riga = r.perElaborato.find((e) => e.codice === 'MEC-PL-120')!
    assert.isTrue(riga.fuoriBaseline)
    assert.equal(riga.evMinuti, 0)
    assert.equal(riga.acMinuti, 120)

    const b = new Browser()
    await b.loginSviluppo('pm1')
    const html = await (await b.vai(`/commesse/${c.id}/evm`)).text()
    assert.include(html, 'data-testid="fuori-baseline"')
    assert.include(html, 'elaborato fuori baseline')
  })
})

test.group('EVM · curva S dagli snapshot', (group) => {
  conTransazione(group)

  test('storia dagli snapshot, settimana corrente live, settimane senza snapshot vuote', async ({
    assert,
  }) => {
    const c = await commessa('CL-2026-031')
    const serie = await serieCurvaS(c.id, '2026-09-28')
    const perSettimana = new Map(serie.map((p) => [p.settimana, p]))
    // W30–W38 dagli snapshot del seed
    const w38 = perSettimana.get('2026-09-14')!
    assert.isTrue(w38.daSnapshot)
    assert.isNotNull(w38.evMinuti)
    // W39 chiusa ma non ancora fotografata (scadenza ore non passata): niente ricostruzione
    const w39 = perSettimana.get('2026-09-21')!
    assert.isFalse(w39.daSnapshot)
    assert.isNull(w39.evMinuti)
    assert.isNull(w39.acMinuti)
    // W40 = settimana corrente: calcolo live
    const w40 = perSettimana.get('2026-09-28')!
    assert.isFalse(w40.daSnapshot)
    assert.equal(w40.evMinuti, 14_520)
    // PV per tutte le settimane della baseline (W30–W46)
    assert.equal(perSettimana.get('2026-11-09')!.pvMinuti, 424 * 60)
    assert.isNull(perSettimana.get('2026-11-09')!.evMinuti)
  })

  test('le settimane passate non cambiano se cambiano stati o pesi', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const prima = await serieCurvaS(c.id, OGGI)
    const snapPrima = await snapshotCommessa(c.id)

    // Un elaborato avanza di stato e l'admin cambia i pesi della configurazione
    await db
      .from('elaborati')
      .where('id', await elaboratoId('MEC-PL-102'))
      .update({ stato_id: await statoId('calcoli'), stato_dal: '2026-09-24T10:00:00+02:00' })
    await db.from('stati_elaborato').where('codice', 'calcoli').update({ peso_ev_percento: 60 })
    await db.from('stati_elaborato').where('codice', 'impostato').update({ peso_ev_percento: 10 })

    const dopo = await serieCurvaS(c.id, OGGI)
    assert.equal(dopo.length, prima.length)
    for (const [i, element] of prima.entries()) {
      if (element.settimana < '2026-09-21') {
        assert.deepEqual(dopo[i], element, `settimana ${element.settimana}`)
      }
    }
    assert.deepEqual(await snapshotCommessa(c.id), snapPrima)

    // Settimana corrente: EV cresce di 48 h × (50% − 20%) con i pesi congelati (non 60%)
    const live = dopo.find((p) => p.settimana === '2026-09-21')!
    assert.equal(live.evMinuti, 14_520 + 48 * 60 * 0.3)
    const r = await riepilogoEvm(c.id, OGGI)
    assert.equal(r.evMinuti, 14_520 + 864)
  })

  test('SVG della curva S nella pagina, senza valori non numerici', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const b = new Browser()
    await b.loginSviluppo('pm1')
    const r = await b.vai(`/commesse/${c.id}/evm`)
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'data-testid="curva-s"')
    assert.notInclude(html, 'NaN')
    assert.include(html, 'Stima a completamento')
    assert.include(html, 'Ore ancora necessarie')
    assert.include(html, 'data-testid="registro-evm"')
    assert.include(html, 'data-testid="storico-evm"')
  })
})

test.group('EVM · job snapshot', (group) => {
  conTransazione(group)

  test('ultima settimana chiusa rispetta la scadenza di modifica ore', ({ assert }) => {
    // W39 (21–27/09): ore modificabili fino al 04/10 compreso
    assert.equal(ultimaSettimanaChiusa('2026-10-04', 7), '2026-09-14')
    assert.equal(ultimaSettimanaChiusa('2026-10-05', 7), '2026-09-21')
    assert.equal(ultimaSettimanaChiusa('2026-09-28', 0), '2026-09-21')
  })

  test('crea lo snapshot della settimana chiusa ed è idempotente', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const primo = await scattaSnapshotEvm('2026-10-05')
    assert.deepEqual(primo.creati, [{ commessaId: c.id, settimana: '2026-09-21' }])
    assert.lengthOf(primo.rettificati, 0)

    const w39 = (await snapshotCommessa(c.id)).find((s) => s.settimana === '2026-09-21')!
    assert.equal(w39.pvMinuti, 18_720)
    assert.equal(w39.evMinuti, 14_520)
    assert.equal(w39.acMinuti, 19_200)
    assert.equal(w39.bacMinuti, 25_440)
    assert.closeTo(w39.spi!, 0.7756, 1e-4)
    assert.closeTo(w39.cpi!, 0.7563, 1e-4)
    assert.equal(w39.eacMinuti, 33_640)
    assert.isFalse(w39.rettificato)
    const perElaborato = await db.from('snapshot_evm_elaborato').where('snapshot_id', w39.id)
    assert.lengthOf(perElaborato, 9)

    const quanti = (await snapshotCommessa(c.id)).length
    const secondo = await scattaSnapshotEvm('2026-10-05')
    assert.lengthOf(secondo.creati, 0)
    assert.lengthOf(secondo.rettificati, 0)
    assert.lengthOf(await snapshotCommessa(c.id), quanti)
  })

  test('EV dello snapshot dallo stato a fine settimana, non da quello attuale', async ({
    assert,
  }) => {
    const c = await commessa('CL-2026-031')
    // MEC-PL-102 passa a "calcoli" lunedì 28/09 (W40): lo snapshot di W39 non lo vede
    const id = await elaboratoId('MEC-PL-102')
    const impostato = await statoId('impostato')
    const calcoli = await statoId('calcoli')
    await db
      .from('elaborati')
      .where('id', id)
      .update({ stato_id: calcoli, stato_dal: '2026-09-28T09:00:00+02:00' })
    await db.table('transizioni_elaborato').insert({
      elaborato_id: id,
      da_stato_id: impostato,
      a_stato_id: calcoli,
      avvenuta_il: '2026-09-28T09:00:00+02:00',
    })
    await scattaSnapshotEvm('2026-10-05')
    const w39 = (await snapshotCommessa(c.id)).find((s) => s.settimana === '2026-09-21')!
    assert.equal(w39.evMinuti, 14_520)
    const riga = await db
      .from('snapshot_evm_elaborato')
      .where('snapshot_id', w39.id)
      .where('elaborato_id', id)
      .firstOrFail()
    assert.equal(Number(riga.stato_id), impostato)
  })

  test('rettifica tardiva: lo snapshot resta, viene segnato rettificato', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    await scattaSnapshotEvm('2026-10-05')
    const utente = await db.from('utenti').where('email', 'like', 'idr1@%').firstOrFail()
    await db.table('registrazioni_ore').insert({
      utente_id: utente.id,
      elaborato_id: await elaboratoId('IDR-PL-301'),
      data: '2026-09-26',
      minuti: 60,
    })

    const esito = await scattaSnapshotEvm('2026-10-06')
    assert.lengthOf(esito.creati, 0)
    assert.deepEqual(esito.rettificati, [
      { commessaId: c.id, settimana: '2026-09-21', acPrima: 19_200, acOra: 19_260 },
    ])
    const w39 = (await snapshotCommessa(c.id)).find((s) => s.settimana === '2026-09-21')!
    assert.equal(w39.acMinuti, 19_200)
    assert.isTrue(w39.rettificato)
    assert.equal(w39.acRettificatoMinuti, 19_260)

    // Di nuovo: nessuna nuova rettifica
    assert.lengthOf((await scattaSnapshotEvm('2026-10-06')).rettificati, 0)

    const serie = await serieCurvaS(c.id, '2026-10-06')
    const punto = serie.find((p) => p.settimana === '2026-09-21')!
    assert.isTrue(punto.daSnapshot)
    assert.isTrue(punto.rettificato)
    assert.equal(punto.acMinuti, 19_200)

    const b = new Browser()
    await b.loginSviluppo('pm1')
    const html = await (await b.vai(`/commesse/${c.id}/evm`)).text()
    assert.include(html, 'data-testid="rettificato"')

    const audit = await db.from('audit_log').where('azione', 'evm.snapshot_rettificato')
    assert.lengthOf(audit, 1)
  })

  test('commessa senza baseline: nessuno snapshot', async ({ assert }) => {
    const c = await commessa('CL-2026-018')
    await scattaSnapshotEvm('2026-12-31')
    assert.lengthOf(await snapshotCommessa(c.id), 0)
  })
})

test.group('EVM · pagina e permessi', (group) => {
  conTransazione(group)

  test('la commessa senza dati mostra n.d. e nessun errore', async ({ assert }) => {
    const c = await commessa('CL-2026-018')
    const b = new Browser()
    await b.loginSviluppo('pm2')
    const r = await b.vai(`/commesse/${c.id}/evm`)
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'n.d.')
    assert.include(html, 'data-testid="senza-baseline"')
    assert.notInclude(html, 'NaN')
    assert.notInclude(html, 'Infinity')
  })

  test('frammento aggiornabile per HTMX', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const b = new Browser()
    await b.loginSviluppo('mec1')
    const r = await b.get(`/commesse/${c.id}/evm/contenuto`, { 'hx-request': 'true' })
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'id="evm-contenuto"')
    assert.notInclude(html, '<html')
  })

  test('progettista: vede l’EVM ma non l’editor della baseline', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const b = new Browser()
    await b.loginSviluppo('mec1')
    const pagina = await b.vai(`/commesse/${c.id}/evm`)
    assert.equal(pagina.status, 200)
    const html = await pagina.text()
    assert.notInclude(html, 'data-testid="link-baseline"')
    const csrf = Browser.csrfDa(html)
    const crea = await b.post(
      `/commesse/${c.id}/evm/baseline`,
      { motivo: 'x' },
      { 'hx-request': 'true', 'x-csrf-token': csrf }
    )
    // Bouncer rifiuta: 403, oppure redirezione indietro con messaggio per i form
    assert.oneOf(crea.status, [302, 403])
    assert.notEqual(crea.headers.get('location'), `/commesse/${c.id}/evm/baseline`)
    const editor = await b.get(`/commesse/${c.id}/evm/baseline`)
    assert.equal(editor.status, 403)
    assert.lengthOf(await db.from('baseline').where('stato', 'bozza'), 0)
  })

  test('non membro: 403', async ({ assert }) => {
    const c = await commessa('CL-2026-018')
    const b = new Browser()
    await b.loginSviluppo('idr1')
    const r = await b.get(`/commesse/${c.id}/evm`)
    assert.equal(r.status, 403)
  })
})
