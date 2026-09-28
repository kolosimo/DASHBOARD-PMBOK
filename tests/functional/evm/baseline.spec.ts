/**
 * Baseline EVM: bozza, editor delle date, approvazione che congela pesi,
 * BAC e PV settimanale, re-baseline con motivo (agente A5).
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import { riepilogoEvm, serieCurvaS, snapshotCommessa } from '#modules/evm/queries'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

const OGGI = '2026-09-24'

async function commessa(codice: string) {
  return Commessa.findByOrFail('codice', codice)
}

async function accedi(utente: string, commessaId: number) {
  const b = new Browser()
  await b.loginSviluppo(utente)
  const r = await b.vai(`/commesse/${commessaId}/evm/baseline`)
  const html = await r.text()
  return { b, csrf: Browser.csrfDa(html), status: r.status, html }
}

async function bozza(commessaId: number) {
  return db.from('baseline').where('commessa_id', commessaId).where('stato', 'bozza').first()
}

/** Righe della bozza per un elaborato, in ordine di stato */
async function dateElaborato(baselineId: number, codice: string) {
  return db
    .from('baseline_date_stato as d')
    .join('elaborati as e', 'e.id', 'd.elaborato_id')
    .join('stati_elaborato as s', 's.id', 'd.stato_id')
    .where('d.baseline_id', baselineId)
    .where('e.codice', codice)
    .orderBy('s.ordine')
    .select('d.id', 'd.stato_id', 'd.data_prevista', 'd.version', 'e.id as elaborato_id')
}

function campiDate(righe: Record<string, unknown>[], date: string[]) {
  const campi: Record<string, string> = {}
  righe.forEach((r, i) => {
    campi[`data_${r.stato_id}`] = date[i]
    campi[`versione_${r.stato_id}`] = String(r.version)
  })
  return campi
}

const HTMX = (csrf: string) => ({ 'hx-request': 'true', 'x-csrf-token': csrf })

test.group('EVM · re-baseline', (group) => {
  conTransazione(group)

  test('re-baseline: motivo obbligatorio, date copiate, approvazione congela tutto', async ({
    assert,
  }) => {
    const c = await commessa('CL-2026-031')
    const vecchia = await db
      .from('baseline')
      .where('commessa_id', c.id)
      .where('stato', 'approvata')
      .firstOrFail()
    const { b, csrf, status, html } = await accedi('pm1', c.id)
    assert.equal(status, 200)
    assert.include(html, 'Motivo della re-baseline')

    // Senza motivo: 422
    const senza = await b.post(`/commesse/${c.id}/evm/baseline`, { _csrf: csrf, motivo: ' ' })
    assert.equal(senza.status, 422)
    assert.include(await senza.text(), 'serve il motivo')
    assert.isNull(await bozza(c.id))

    // Con motivo: bozza con le date della baseline attiva
    const crea = await b.post(`/commesse/${c.id}/evm/baseline`, {
      _csrf: csrf,
      motivo: 'Variante del committente sul piano primo',
    })
    assert.equal(crea.status, 302)
    const nuova = await bozza(c.id)
    assert.equal(nuova.numero, 2)
    assert.equal(nuova.note, 'Variante del committente sul piano primo')
    const vecchieDate = await dateElaborato(vecchia.id, 'MEC-PL-102')
    const nuoveDate = await dateElaborato(nuova.id, 'MEC-PL-102')
    assert.deepEqual(
      nuoveDate.map((d) => d.data_prevista),
      vecchieDate.map((d) => d.data_prevista)
    )
    const tutte = await db.from('baseline_date_stato').where('baseline_id', nuova.id)
    assert.lengthOf(tutte, 9 * 5)

    // Salvataggio di una riga (HTMX)
    const date = ['2026-09-01', '2026-10-12', '2026-10-26', '2026-11-02', '2026-11-06']
    const salva = await b.post(
      `/commesse/${c.id}/evm/baseline/${nuova.id}/elaborati/${nuoveDate[0].elaborato_id}`,
      campiDate(nuoveDate, date),
      HTMX(csrf)
    )
    assert.equal(salva.status, 200)
    assert.include(await salva.text(), 'salvata')
    const salvate = await dateElaborato(nuova.id, 'MEC-PL-102')
    assert.deepEqual(
      salvate.map((d) => d.data_prevista),
      date
    )

    // Stessa versione di prima: 409 con il frammento aggiornato
    const doppio = await b.post(
      `/commesse/${c.id}/evm/baseline/${nuova.id}/elaborati/${nuoveDate[0].elaborato_id}`,
      campiDate(nuoveDate, date),
      HTMX(csrf)
    )
    assert.equal(doppio.status, 409)
    assert.include(await doppio.text(), 'data-testid="conflitto"')

    // Date fuori sequenza: 422
    const storte = await b.post(
      `/commesse/${c.id}/evm/baseline/${nuova.id}/elaborati/${nuoveDate[0].elaborato_id}`,
      campiDate(salvate, ['2026-10-01', '2026-09-01', '2026-10-26', '2026-11-02', '2026-11-06']),
      HTMX(csrf)
    )
    assert.equal(storte.status, 422)
    assert.include(await storte.text(), 'ordine degli stati')

    // L'admin cambia un peso prima dell'approvazione: la nuova baseline lo congela
    await db.from('stati_elaborato').where('codice', 'calcoli').update({ peso_ev_percento: 60 })
    const snapshotPrima = await snapshotCommessa(c.id)
    const seriePrima = await serieCurvaS(c.id, OGGI)

    const approva = await b.post(`/commesse/${c.id}/evm/baseline/${nuova.id}/approva`, {
      _csrf: csrf,
      version: String(nuova.version),
    })
    assert.equal(approva.status, 302)
    assert.equal(approva.headers.get('location'), `/commesse/${c.id}/evm`)

    const approvata = await db.from('baseline').where('id', nuova.id).firstOrFail()
    assert.equal(approvata.stato, 'approvata')
    assert.equal(approvata.bac_minuti, 25_440)
    assert.equal(approvata.pesi_stati.calcoli, 60)
    assert.equal(approvata.pesi_stati.emesso_cliente, 100)
    assert.isNotNull(approvata.approvata_il)
    const superata = await db.from('baseline').where('id', vecchia.id).firstOrFail()
    assert.equal(superata.stato, 'superata')

    // PV cumulato per settimana: non decrescente, termina al BAC
    const pv = await db
      .from('baseline_pv_settimana')
      .where('baseline_id', nuova.id)
      .orderBy('settimana')
    assert.isAbove(pv.length, 10)
    for (let i = 1; i < pv.length; i++) assert.isAtLeast(pv[i].pv_minuti, pv[i - 1].pv_minuti)
    assert.equal(pv[pv.length - 1].pv_minuti, 25_440)
    assert.equal(pv[0].settimana, '2026-06-29') // settimana dell'inizio commessa (01/07/2026)

    // La storia non cambia: snapshot identici, EV e AC passati identici
    assert.deepEqual(await snapshotCommessa(c.id), snapshotPrima)
    const serieDopo = await serieCurvaS(c.id, OGGI)
    for (const p of seriePrima.filter((x) => x.daSnapshot)) {
      const d = serieDopo.find((x) => x.settimana === p.settimana)!
      assert.equal(d.evMinuti, p.evMinuti)
      assert.equal(d.acMinuti, p.acMinuti)
      assert.isTrue(d.daSnapshot)
    }

    // Il calcolo live usa i pesi della nuova baseline (calcoli = 60%)
    const r = await riepilogoEvm(c.id, OGGI)
    assert.equal(r.baselineId, nuova.id)
    // In "calcoli" ci sono MEC-PL-101, MEC-PL-110, ELE-SC-201: (48 + 56 + 64) h × 10% in più
    assert.equal(r.evMinuti, 14_520 + (48 + 56 + 64) * 6)

    const audit = await db.from('audit_log').where('azione', 'evm.baseline_approvata')
    assert.lengthOf(audit, 1)
    assert.lengthOf(await db.from('audit_log').where('azione', 'evm.baseline_superata'), 1)
    assert.lengthOf(await db.from('audit_log').where('azione', 'evm.rebaseline_creata'), 1)
  })

  test('approvazione con versione superata: 409 e nulla cambia', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const { b, csrf } = await accedi('pm1', c.id)
    await b.post(`/commesse/${c.id}/evm/baseline`, { _csrf: csrf, motivo: 'Prova conflitto' })
    const nuova = await bozza(c.id)
    await db
      .from('baseline')
      .where('id', nuova.id)
      .update({ version: nuova.version + 1 })
    const r = await b.post(`/commesse/${c.id}/evm/baseline/${nuova.id}/approva`, {
      _csrf: csrf,
      version: String(nuova.version),
    })
    assert.equal(r.status, 409)
    assert.equal((await db.from('baseline').where('id', nuova.id).firstOrFail()).stato, 'bozza')
    assert.lengthOf(await db.from('baseline_pv_settimana').where('baseline_id', nuova.id), 0)
  })

  test('una sola bozza alla volta; la bozza si può scartare', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const { b, csrf } = await accedi('pm1', c.id)
    await b.post(`/commesse/${c.id}/evm/baseline`, { _csrf: csrf, motivo: 'Prima bozza' })
    const seconda = await b.post(`/commesse/${c.id}/evm/baseline`, {
      _csrf: csrf,
      motivo: 'Seconda bozza',
    })
    assert.equal(seconda.status, 422)
    const nuova = await bozza(c.id)
    const scarta = await b.post(`/commesse/${c.id}/evm/baseline/${nuova.id}/scarta`, {
      _csrf: csrf,
      version: String(nuova.version),
    })
    assert.equal(scarta.status, 302)
    assert.isNull(await bozza(c.id))
    assert.lengthOf(await db.from('baseline_date_stato').where('baseline_id', nuova.id), 0)
  })
})

test.group('EVM · prima baseline', (group) => {
  conTransazione(group)

  test('date automatiche, elaborati mancanti, approvazione', async ({ assert }) => {
    const c = await commessa('CL-2025-077')
    const disciplina = await db.from('discipline').where('codice', 'ANT').firstOrFail()
    const nonIniziato = await db.from('stati_elaborato').where('ordine', 0).firstOrFail()
    const nuovoElaborato = (codice: string, ore: number) => ({
      commessa_id: c.id,
      codice,
      titolo: `Elaborato ${codice}`,
      disciplina_id: disciplina.id,
      budget_minuti: ore * 60,
      stato_id: nonIniziato.id,
    })
    await db.table('elaborati').insert(nuovoElaborato('ANT-RT-501', 30))

    const { b, csrf, html } = await accedi('pm1', c.id)
    assert.include(html, 'Crea la bozza con date automatiche')
    const crea = await b.post(`/commesse/${c.id}/evm/baseline`, { _csrf: csrf })
    assert.equal(crea.status, 302)
    const nuova = await bozza(c.id)
    assert.equal(nuova.numero, 1)
    const date = await dateElaborato(nuova.id, 'ANT-RT-501')
    // Distribuite tra inizio (03/11/2025) e fine prevista (29/01/2027)
    assert.equal(date[0].data_prevista, '2025-11-03')
    assert.equal(date[date.length - 1].data_prevista, '2027-01-29')

    // Un elaborato aggiunto dopo la bozza blocca l'approvazione
    await db.table('elaborati').insert(nuovoElaborato('IDR-PL-502', 18))
    const blocco = await b.post(`/commesse/${c.id}/evm/baseline/${nuova.id}/approva`, {
      _csrf: csrf,
      version: String(nuova.version),
    })
    assert.equal(blocco.status, 422)
    assert.include(await blocco.text(), 'IDR-PL-502')

    const aggiungi = await b.post(`/commesse/${c.id}/evm/baseline/${nuova.id}/mancanti`, {
      _csrf: csrf,
    })
    assert.equal(aggiungi.status, 302)
    const approva = await b.post(`/commesse/${c.id}/evm/baseline/${nuova.id}/approva`, {
      _csrf: csrf,
      version: String(nuova.version),
    })
    assert.equal(approva.status, 302)

    const approvata = await db.from('baseline').where('id', nuova.id).firstOrFail()
    assert.equal(approvata.stato, 'approvata')
    assert.equal(approvata.bac_minuti, 48 * 60)
    const pv = await db
      .from('baseline_pv_settimana')
      .where('baseline_id', nuova.id)
      .orderBy('settimana')
    assert.equal(pv[0].settimana, '2025-11-03')
    assert.equal(pv[pv.length - 1].settimana, '2027-01-25')
    assert.equal(pv[pv.length - 1].pv_minuti, 48 * 60)

    // Nessuna ora registrata: CPI ed EAC n.d., SPI calcolato
    const r = await riepilogoEvm(c.id, OGGI)
    assert.equal(r.bacMinuti, 48 * 60)
    assert.isNull(r.cpi)
    assert.isNull(r.eacMinuti)
    assert.equal(r.evMinuti, 0)
    assert.isAbove(r.pvMinuti, 0)
    assert.strictEqual(r.spi, 0)

    const pagina = await (await b.vai(`/commesse/${c.id}/evm`)).text()
    assert.include(pagina, 'data-testid="baseline-attiva"')
    assert.notInclude(pagina, 'NaN')
  })
})
