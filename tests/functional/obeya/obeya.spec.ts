/**
 * Obeya di commessa (agente B1): avvisi dai dati, KPI, stato vuoto, tempo reale, permessi.
 * Dati di esempio: CL-2026-031 al 24/09/2026.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import Utente from '#models/utente'
import { avvisiCommessa, datiObeya, statoMilestone } from '#modules/obeya/queries'
import { riepilogoEvm } from '#modules/evm/queries'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

const OGGI = '2026-09-24'

async function commessa(codice: string) {
  return Commessa.findByOrFail('codice', codice)
}

async function commessaNuova() {
  const pm = await Utente.findByOrFail('email', 'pm1@climosfera.example')
  const c = await Commessa.create({
    codice: 'CL-2026-900',
    nome: 'Commessa appena creata',
    cliente: null,
    stato: 'attiva',
    pmId: pm.id,
  })
  await db.table('membri_commessa').insert({
    commessa_id: c.id,
    utente_id: pm.id,
    ruolo_commessa: 'pm',
  })
  return c
}

test.group('Obeya · avvisi e KPI', (group) => {
  conTransazione(group)

  test('CL-2026-031 al 24/09: prima i due critici SPI e CPI, poi le attenzioni', async ({
    assert,
  }) => {
    const c = await commessa('CL-2026-031')
    const avvisi = await avvisiCommessa(c.id, OGGI)
    assert.isAtLeast(avvisi.length, 2)
    assert.equal(avvisi[0].gravita, 'critico')
    assert.match(avvisi[0].messaggio, /^SPI 0,78: in ritardo di 70 h/)
    assert.equal(avvisi[1].gravita, 'critico')
    assert.match(avvisi[1].messaggio, /^CPI 0,76: .*561 h contro 424 h/)
    assert.isTrue(avvisi.slice(2).every((a) => a.gravita === 'attenzione'))
    // nessun avviso nomina persone del team
    const nomi = await db.from('utenti').select('nome')
    const testo = avvisi.map((a) => a.messaggio).join('\n')
    for (const u of nomi) assert.notInclude(testo, u.nome)
  })

  test('datiObeya: KPI di commessa coerenti con EVM e LPS', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const [d, evm] = await Promise.all([datiObeya(c.id, OGGI), riepilogoEvm(c.id, OGGI)])
    assert.equal(d.evm.spi, evm.spi)
    assert.equal(d.evm.cpi, evm.cpi)
    assert.equal(d.evm.eacMinuti, 33_640)
    assert.equal(d.evm.etcMinuti, 14_440)
    assert.equal(d.settimana, '2026-09-21')
    assert.isNotNull(d.lps.statoPiano)
    assert.include(d.graficoPpc, 'data-grafico="ppc"')
    assert.include(d.curvaS, '<svg')
    assert.lengthOf(d.milestone, 5)
    assert.isTrue(d.milestone[0].fatta)
    assert.isTrue(d.milestone[2].prossima)
    assert.isFalse(d.commessaVuota)
    assert.isFalse(d.primoPiano)
    assert.isFalse(d.mancano.baseline)
  })

  test('statoMilestone: fatta, prossima e data superata', ({ assert }) => {
    const ms = statoMilestone(
      [
        {
          id: 1,
          titolo: 'A',
          dataPrevista: '2026-09-01',
          dataEffettiva: '2026-09-02',
          contrattuale: true,
        },
        { id: 2, titolo: 'B', dataPrevista: '2026-09-20', dataEffettiva: null, contrattuale: true },
        {
          id: 3,
          titolo: 'C',
          dataPrevista: '2026-10-20',
          dataEffettiva: null,
          contrattuale: false,
        },
      ],
      OGGI
    )
    assert.deepEqual(
      ms.map((m) => [m.fatta, m.prossima, m.inRitardo]),
      [
        [true, false, false],
        [false, true, true],
        [false, false, false],
      ]
    )
  })
})

test.group('Obeya · stato vuoto', (group) => {
  conTransazione(group)

  test('commessa appena creata: n.d., nessun errore, nessun avviso', async ({ assert }) => {
    const c = await commessaNuova()
    const d = await datiObeya(c.id, OGGI)
    assert.isTrue(d.commessaVuota)
    assert.isTrue(d.primoPiano)
    assert.deepInclude(d.mancano, {
      elaborati: true,
      baseline: true,
      pianoSettimana: true,
      milestone: true,
      ore: true,
    })
    assert.isNull(d.evm.spi)
    assert.isNull(d.evm.cpi)
    assert.isNull(d.evm.eacMinuti)
    assert.isNull(d.evm.pvMinuti)
    assert.isNull(d.lps.ppc)
    assert.deepEqual(d.avvisi, [])
    assert.equal(d.graficoPpc, '')
    assert.equal(d.curvaS, '')
  })

  test('pagina della commessa vuota per il PM: indicazioni su cosa fare', async ({ assert }) => {
    const c = await commessaNuova()
    const b = new Browser()
    await b.loginSviluppo('pm1')
    const r = await b.get(`/commesse/${c.id}`)
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'Per partire')
    assert.include(html, 'Crea la baseline')
    assert.include(html, 'Prepara il primo piano settimanale')
    assert.include(html, 'Aggiungi gli elaborati')
    assert.include(html, 'Inserisci le milestone')
    assert.include(html, `href="/commesse/${c.id}/evm/baseline"`)
    assert.include(html, `href="/commesse/${c.id}/lps/settimana"`)
    assert.include(html, 'n.d.')
    assert.include(html, 'data-testid="nessun-avviso"')
    assert.include(html, 'data-testid="curva-s-vuota"')
    assert.include(html, 'data-testid="grafico-ppc-vuoto"')
    assert.notInclude(html, 'NaN')
    assert.notInclude(html, 'Infinity')
    assert.notInclude(html, 'undefined')
  })

  test('commessa vuota vista dalla direzione: indicazioni senza link di modifica', async ({
    assert,
  }) => {
    const c = await commessaNuova()
    const b = new Browser()
    await b.loginSviluppo('direzione')
    const r = await b.get(`/commesse/${c.id}`)
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'Creare la baseline')
    assert.include(html, 'Preparare il piano settimanale')
    assert.notInclude(html, `href="/commesse/${c.id}/evm/baseline"`)
  })
})

test.group('Obeya · pagina, tempo reale e permessi', (group) => {
  conTransazione(group)

  test('PM: KPI, master schedule, avvisi e grafici', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const b = new Browser()
    await b.loginSviluppo('pm1')
    const r = await b.get(`/commesse/${c.id}`)
    assert.equal(r.status, 200)
    const html = await r.text()
    for (const id of ['kpi-obeya', 'master-schedule', 'avvisi', 'curva-s']) {
      assert.include(html, `data-testid="${id}"`)
    }
    for (const sigla of ['SPI', 'CPI', 'EAC', 'ETC', 'PPC', 'PCR', 'Vincoli aperti']) {
      assert.include(html, sigla)
    }
    assert.include(html, 'Esecutivo meccanico')
    assert.include(html, 'data-gravita="critico"')
    assert.notInclude(html, 'NaN')
  })

  test('il contenuto si ricarica con gli eventi della commessa (SSE) e con il polling', async ({
    assert,
  }) => {
    const c = await commessa('CL-2026-031')
    const b = new Browser()
    await b.loginSviluppo('mec1')
    const pagina = await (await b.get(`/commesse/${c.id}`)).text()
    assert.include(pagina, `data-commessa-id="${c.id}"`)
    assert.include(pagina, `hx-get="/commesse/${c.id}/obeya/contenuto"`)
    assert.include(pagina, 'hx-trigger="evento-commessa from:body, polling-commessa from:body"')

    const r = await b.get(`/commesse/${c.id}/obeya/contenuto`, { 'HX-Request': 'true' })
    assert.equal(r.status, 200)
    const frammento = await r.text()
    assert.include(frammento, 'id="obeya-contenuto"')
    assert.notInclude(frammento, '<html')
  })

  test('direzione: vede l’Obeya con i soli totali, senza nomi del team', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const b = new Browser()
    await b.loginSviluppo('direzione')
    const r = await b.get(`/commesse/${c.id}`)
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'data-testid="kpi-obeya"')
    for (const nome of ['Progettista MEC 1', 'Progettista ELE 1', 'Resp. qualità', 'PM 1']) {
      assert.notInclude(html, nome)
    }
  })

  test('non membro: 403 su pagina e frammento; inesistente: 404', async ({ assert }) => {
    const uffici = await commessa('CL-2026-018')
    const b = new Browser()
    await b.loginSviluppo('mec1')
    assert.equal((await b.get(`/commesse/${uffici.id}`)).status, 403)
    assert.equal((await b.get(`/commesse/${uffici.id}/obeya/contenuto`)).status, 403)
    assert.equal((await b.get('/commesse/999999/obeya/contenuto')).status, 404)
  })

  test('non autenticato: redirezione all’accesso', async ({ assert }) => {
    const c = await commessa('CL-2026-031')
    const b = new Browser()
    const r = await b.get(`/commesse/${c.id}/obeya/contenuto`)
    assert.equal(r.status, 302)
  })
})
