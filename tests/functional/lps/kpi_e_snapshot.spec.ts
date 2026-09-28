/**
 * LPS · KPI (riepilogoLps, paretoCause), snapshot settimanali e grafici SVG.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import SnapshotLps from '#models/snapshot_lps'
import PianoSettimanale from '#models/piano_settimanale'
import Impegno from '#models/impegno'
import AttivitaLookahead from '#models/attivita_lookahead'
import Utente from '#models/utente'
import { conTransazione } from '#tests/helpers/db'
import { paretoCause, riepilogoLps } from '#modules/lps/queries'
import { eseguiSnapshotSettimanali, settimaneDaFotografare } from '#modules/lps/snapshot'
import { escapeXml, graficoPareto, graficoPpc } from '#modules/lps/grafici'
import { elencoJob } from '#shared/scheduler'

const W31 = '2026-07-27'
const W38 = '2026-09-14'
const W39 = '2026-09-21'
const W40 = '2026-09-28'
const W42 = '2026-10-12'

/** Lunedì 28/09/2026 alle 06:10 ora di Roma */
const LUNEDI_W40 = new Date('2026-09-28T04:10:00Z')
/** Lunedì 05/10/2026 alle 06:10 ora di Roma */
const LUNEDI_W41 = new Date('2026-10-05T04:10:00Z')

async function scuola() {
  return Commessa.findByOrFail('codice', 'CL-2026-031')
}

test.group('LPS · riepilogoLps e paretoCause', (group) => {
  conTransazione(group)

  test('W39 dei dati di esempio', async ({ assert }) => {
    const c = await scuola()
    const r = await riepilogoLps(c.id, W39)
    assert.equal(r.statoPiano, 'promesso')
    assert.equal(r.promessi, 7)
    assert.equal(r.fatti, 5)
    assert.equal(r.ppc, 5 / 7)
    assert.equal(r.vincoliAperti, 5)
    assert.isNull(r.pcr, 'nessun vincolo aperto scade entro il 27/09')
    assert.isNull(r.tmr)
    assert.isNull(r.ta)
    assert.lengthOf(r.storicoPpc, 9)
    assert.deepEqual(r.storicoPpc[0], { settimana: W31, ppc: 0.5, daSnapshot: true })
    assert.deepEqual(r.storicoPpc[8], { settimana: W39, ppc: 5 / 7, daSnapshot: false })
  })

  test('W40: nessun piano, PCR 0/3', async ({ assert }) => {
    const c = await scuola()
    const r = await riepilogoLps(c.id, W40)
    assert.isNull(r.statoPiano)
    assert.isNull(r.ppc)
    assert.equal(r.pcr, 0)
    assert.equal(r.storicoPpc[r.storicoPpc.length - 1].settimana, W40)
  })

  test('Pareto W31–W38 come in formule.md; W31–W39 aggiunge input mancante e risorsa', async ({
    assert,
  }) => {
    const c = await scuola()
    const storico = await paretoCause(c.id, W31, W38)
    assert.deepEqual(
      storico.map((v) => [v.codice, v.conteggio]),
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
    const conW39 = await paretoCause(c.id, W31, W39)
    assert.deepEqual(
      conW39.slice(0, 3).map((v) => [v.codice, v.conteggio]),
      [
        ['input_mancante', 10],
        ['approvazione_attesa', 5],
        ['risorsa_non_disponibile', 5],
      ]
    )
    assert.deepEqual(await paretoCause(c.id, W40, W42), [])
  })
})

test.group('LPS · snapshot settimanali', (group) => {
  conTransazione(group)

  test('lunedì W40: W39 aspetta la chiusura del piano; lookahead fotografato; idempotente', async ({
    assert,
  }) => {
    const c = await scuola()
    assert.deepEqual(await settimaneDaFotografare(c.id, W40), [])
    const e1 = await eseguiSnapshotSettimanali(LUNEDI_W40)
    assert.equal(e1.snapshotLps, 0)
    const righe = await db
      .from('snapshot_lookahead')
      .where('commessa_id', c.id)
      .where('settimana', W40)
      .orderBy('codice_attivita')
    assert.lengthOf(righe, 9)
    const l1 = righe.find((r) => r.codice_attivita === 'L1')
    assert.isFalse(l1.pronta)
    assert.equal(l1.vincoli_aperti, 1)

    const e2 = await eseguiSnapshotSettimanali(LUNEDI_W40)
    assert.deepEqual(e2, { snapshotLps: 0, righeLookahead: 0 })
    const n = await db.from('snapshot_lookahead').where('settimana', W40).count('* as n').first()
    assert.equal(Number(n!.n), 9)
  })

  test('lunedì W40 con il piano W39 chiuso: snapshot di W39', async ({ assert }) => {
    const c = await scuola()
    await PianoSettimanale.query()
      .where('commessa_id', c.id)
      .where('settimana', W39)
      .update({ stato: 'chiuso' })
    const e = await eseguiSnapshotSettimanali(LUNEDI_W40)
    assert.equal(e.snapshotLps, 1)
    const s = await SnapshotLps.query()
      .where('commessa_id', c.id)
      .where('settimana', W39)
      .firstOrFail()
    assert.equal(s.impegniPromessi, 7)
    assert.equal(s.impegniFatti, 5)
    assert.closeTo(s.ppc!, 5 / 7, 0.0001)
    assert.isNull(s.pcr)
  })

  test('recupero: il lunedì di W41 scatta W39 (piano non chiuso) e W40 (senza piano)', async ({
    assert,
  }) => {
    const c = await scuola()
    assert.deepEqual(await settimaneDaFotografare(c.id, '2026-10-05'), [W39, W40])
    const e = await eseguiSnapshotSettimanali(LUNEDI_W41)
    assert.equal(e.snapshotLps, 2)
    const w40 = await SnapshotLps.query()
      .where('commessa_id', c.id)
      .where('settimana', W40)
      .firstOrFail()
    assert.equal(w40.impegniPromessi, 0)
    assert.isNull(w40.ppc)
    assert.equal(w40.vincoliDaRimuovere, 3)
    assert.equal(w40.vincoliRimossi, 0)
    assert.equal(w40.pcr, 0)
    // Rieseguito: nessun duplicato
    assert.equal((await eseguiSnapshotSettimanali(LUNEDI_W41)).snapshotLps, 0)
    // Lo storico dopo lo snapshot legge W39 dallo snapshot
    const r = await riepilogoLps(c.id, '2026-10-05')
    assert.deepEqual(r.storicoPpc.slice(-3), [
      { settimana: W39, ppc: arrotonda4(5 / 7), daSnapshot: true },
      { settimana: W40, ppc: null, daSnapshot: true },
      { settimana: '2026-10-05', ppc: null, daSnapshot: false },
    ])
  })

  test('TMR e TA di W42 dallo snapshot del lookahead di W40', async ({ assert }) => {
    const c = await scuola()
    await eseguiSnapshotSettimanali(LUNEDI_W40)
    const att = async (codice: string) =>
      AttivitaLookahead.query().where('commessa_id', c.id).where('codice', codice).firstOrFail()
    const mec1 = await Utente.findByOrFail('email', 'mec1@climosfera.example')
    const piano = await PianoSettimanale.create({
      commessaId: c.id,
      settimana: W42,
      stato: 'promesso',
    })
    const base = { pianoId: piano.id, lastPlannerId: mec1.id, aggiuntoDopoPromessa: false }
    await Impegno.createMany([
      { ...base, attivitaId: (await att('L2')).id, descrizione: 'Schemi quadri', ordine: 1 },
      { ...base, attivitaId: (await att('L6')).id, descrizione: 'Coordinamento', ordine: 2 },
      { ...base, attivitaId: null, descrizione: 'Impegno libero', ordine: 3 },
      {
        ...base,
        attivitaId: (await att('L4')).id,
        descrizione: 'Aggiunto dopo',
        ordine: 4,
        aggiuntoDopoPromessa: true,
      },
    ])
    // Anticipate(W42) nello snapshot W40: L2, L4, L6, L7 → nel piano L2 e L6
    const r = await riepilogoLps(c.id, W42)
    assert.equal(r.tmr, 2 / 4)
    assert.equal(r.ta, 2 / 3)
  })

  test('il job è registrato con il suo nome', async ({ assert }) => {
    await import('#modules/lps/jobs')
    assert.isTrue(elencoJob().some((j) => j.nome === 'lps.snapshot_settimanali'))
  })
})

/** Il driver restituisce i numeric arrotondati a 4 decimali */
function arrotonda4(x: number) {
  return Math.round(x * 10000) / 10000
}

test.group('LPS · grafici SVG', () => {
  test('PPC: barre, n.d. per null, soglia e testi escapati', ({ assert }) => {
    const svg = graficoPpc(
      [
        { settimana: W38, ppc: 0.727, daSnapshot: true },
        { settimana: W39, ppc: null, daSnapshot: false },
      ],
      { soglia: { verde: 0.7, giallo: 0.55, verso: 'alto' } }
    )
    assert.match(svg, /^<svg[^>]+role="img"/)
    assert.include(svg, 'W38: PPC 73% (settimana chiusa)')
    assert.include(svg, '>n.d.<')
    assert.include(svg, 'in linea da 70%')
    assert.equal((svg.match(/<path /g) ?? []).length, 1)
  })

  test('Pareto: ordine, conteggi, cumulata; elenco vuoto', ({ assert }) => {
    const svg = graficoPareto([
      { causaId: 1, codice: 'a', nome: 'Input <mancante> & altro', conteggio: 3 },
      { causaId: 2, codice: 'b', nome: 'Risorsa', conteggio: 1 },
    ])
    assert.include(svg, 'Input &lt;mancante&gt; &amp; altro')
    assert.include(svg, '>75%<')
    assert.include(svg, '>100%<')
    assert.include(graficoPareto([]), 'Nessun impegno non fatto nel periodo')
    assert.equal(escapeXml(`"a'`), '&quot;a&#39;')
  })
})
