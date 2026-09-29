/**
 * Portafoglio (agente B1): commesse del PM, totali per la direzione, PPC
 * delle ultime 4 settimane pesato sugli impegni, nessun dato per persona.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import Utente from '#models/utente'
import {
  ppcPesato,
  righePortafoglio,
  settimanePpc,
  totaliPortafoglio,
  type RigaPortafoglio,
} from '#modules/portafoglio/queries'
import { indicatoriSettimana } from '#modules/lps/queries'
import { riepilogoEvm } from '#modules/evm/queries'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

const OGGI = '2026-09-24'
const W39 = '2026-09-21'

async function utente(slug: string) {
  return Utente.findByOrFail('email', `${slug}@climosfera.example`)
}

test.group('Portafoglio · PPC pesato sulle ultime 4 settimane', () => {
  test('finestra: 4 settimane concluse; con il piano corrente chiuso scorre in avanti', ({
    assert,
  }) => {
    assert.deepEqual(settimanePpc(W39, false), [
      '2026-08-24',
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
    ])
    assert.deepEqual(settimanePpc(W39, true), [
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ])
  })

  test('pesato sugli impegni, non media dei PPC; bozze e settimane fuori finestra escluse', ({
    assert,
  }) => {
    const r = ppcPesato(
      [
        { settimana: '2026-08-17', stato: 'chiuso', promessi: 10, fatti: 0 }, // fuori finestra
        { settimana: '2026-08-24', stato: 'chiuso', promessi: 2, fatti: 2 }, // 100%
        { settimana: '2026-08-31', stato: 'chiuso', promessi: 8, fatti: 4 }, // 50%
        { settimana: '2026-09-07', stato: 'bozza', promessi: 5, fatti: 0 }, // bozza: non conta
        { settimana: '2026-09-14', stato: 'promesso', promessi: 10, fatti: 6 },
        { settimana: W39, stato: 'promesso', promessi: 7, fatti: 1 }, // in corso: non conta
      ],
      W39
    )
    // (2 + 4 + 6) / (2 + 8 + 10) = 12 / 20; la media dei PPC sarebbe 0,7
    assert.equal(r.promessi, 20)
    assert.equal(r.fatti, 12)
    assert.equal(r.ppc, 0.6)
  })

  test('nessun impegno promesso → null (n.d.), niente divisione per zero', ({ assert }) => {
    assert.isNull(ppcPesato([], W39).ppc)
    assert.isNull(
      ppcPesato([{ settimana: '2026-09-14', stato: 'chiuso', promessi: 0, fatti: 0 }], W39).ppc
    )
  })

  test('totali: indici ricalcolati sulle somme; SPI solo sulle commesse con baseline', ({
    assert,
  }) => {
    const base = {
      nome: '',
      vincoliAperti: 1,
      prossimaMilestone: null,
      stato: 'attiva' as const,
      spi: null,
      cpi: null,
      ppc4Settimane: null,
    }
    const righe: RigaPortafoglio[] = [
      {
        ...base,
        commessaId: 1,
        codice: 'A',
        baselinePresente: true,
        bacMinuti: 6000,
        pvMinuti: 3000,
        evMinuti: 2400,
        acMinuti: 3000,
        impegniPromessi4Settimane: 10,
        impegniFatti4Settimane: 8,
      },
      {
        ...base,
        commessaId: 2,
        codice: 'B',
        baselinePresente: false,
        bacMinuti: 1200,
        pvMinuti: 0,
        evMinuti: 600,
        acMinuti: 1000,
        impegniPromessi4Settimane: 0,
        impegniFatti4Settimane: 0,
      },
    ]
    const t = totaliPortafoglio(righe)
    assert.equal(t.commesse, 2)
    assert.equal(t.bacMinuti, 7200)
    assert.equal(t.spi, 0.8) // 2400 / 3000
    assert.equal(t.cpi, 0.75) // 3000 / 4000
    assert.equal(t.ppc4Settimane, 0.8)
    assert.equal(t.vincoliAperti, 2)
    assert.isNull(totaliPortafoglio([]).spi)
    assert.isNull(totaliPortafoglio([]).cpi)
  })
})

test.group('Portafoglio · righe', (group) => {
  conTransazione(group)

  test('pm1 al 24/09: le sue commesse aperte con SPI, CPI, PPC e vincoli', async ({ assert }) => {
    const righe = await righePortafoglio(await utente('pm1'), OGGI)
    const codici = righe.map((r) => r.codice)
    assert.include(codici, 'CL-2026-031')
    assert.include(codici, 'CL-2025-077')
    assert.notInclude(codici, 'CL-2026-018')

    const scuola = righe.find((r) => r.codice === 'CL-2026-031')!
    const evm = await riepilogoEvm(scuola.commessaId, OGGI)
    assert.equal(scuola.spi, evm.spi)
    assert.equal(scuola.cpi, evm.cpi)
    assert.equal(scuola.prossimaMilestone?.titolo, 'Esecutivo meccanico')

    // PPC: stesso risultato sommando gli impegni di indicatoriSettimana (modulo LPS)
    let promessi = 0
    let fatti = 0
    const corrente = await indicatoriSettimana(scuola.commessaId, W39)
    for (const w of settimanePpc(W39, corrente.statoPiano === 'chiuso')) {
      const ind = await indicatoriSettimana(scuola.commessaId, w)
      if (ind.statoPiano === null || ind.statoPiano === 'bozza') continue
      promessi += ind.ppc.promessi
      fatti += ind.ppc.fatti
    }
    assert.isAbove(promessi, 0)
    assert.equal(scuola.impegniPromessi4Settimane, promessi)
    assert.equal(scuola.impegniFatti4Settimane, fatti)
    assert.equal(scuola.ppc4Settimane, promessi === 0 ? null : fatti / promessi)
  })

  test('commesse chiuse escluse; commessa nuova senza dati: tutto n.d.', async ({ assert }) => {
    const pm1 = await utente('pm1')
    await Commessa.query().where('codice', 'CL-2025-077').update({ stato: 'chiusa' })
    const nuova = await Commessa.create({
      codice: 'CL-2026-901',
      nome: 'Nuova',
      stato: 'attiva',
      pmId: pm1.id,
    })
    const righe = await righePortafoglio(pm1, OGGI)
    assert.notInclude(
      righe.map((r) => r.codice),
      'CL-2025-077'
    )
    const r = righe.find((x) => x.commessaId === nuova.id)!
    assert.isNull(r.spi)
    assert.isNull(r.cpi)
    assert.isNull(r.ppc4Settimane)
    assert.equal(r.vincoliAperti, 0)
    assert.isNull(r.prossimaMilestone)
    assert.isFalse(r.baselinePresente)
  })
})

test.group('Portafoglio · pagina e permessi', (group) => {
  conTransazione(group)

  test('PM: le sue commesse con semafori, senza totali di portafoglio', async ({ assert }) => {
    const b = new Browser()
    await b.loginSviluppo('pm1')
    const r = await b.get('/portafoglio')
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'Le mie commesse aperte')
    assert.include(html, 'data-codice="CL-2026-031"')
    assert.notInclude(html, 'data-codice="CL-2026-018"')
    assert.notInclude(html, 'data-testid="totali-portafoglio"')
    assert.match(html, /class="pill [gwcn] /)
    assert.notInclude(html, 'NaN')
  })

  test('direzione: tutte le commesse e i totali, nessun nome di persona', async ({ assert }) => {
    const b = new Browser()
    await b.loginSviluppo('direzione')
    const r = await b.get('/portafoglio')
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'Tutte le commesse aperte')
    assert.include(html, 'data-testid="totali-portafoglio"')
    for (const codice of ['CL-2026-031', 'CL-2026-018', 'CL-2025-077']) {
      assert.include(html, `data-codice="${codice}"`)
    }
    // nessun dato per persona: né PM né membri del team
    const nomi = await db.from('utenti').whereNot('ruolo', 'direzione').select('nome')
    for (const u of nomi) assert.notInclude(html, `>${u.nome}<`)
    assert.notInclude(html, 'PM 1')
    assert.notInclude(html, 'Progettista')
  })

  test('utente senza commesse: stato vuoto con indicazioni', async ({ assert }) => {
    await db.from('membri_commessa').delete()
    await db.from('commesse').update({ pm_id: null })
    const b = new Browser()
    await b.loginSviluppo('pm2')
    const html = await (await b.get('/portafoglio')).text()
    assert.include(html, 'data-testid="portafoglio-vuoto"')
    assert.include(html, 'Chiedi all')
  })

  test('admin senza commesse: link per creare la prima', async ({ assert }) => {
    await db.from('commesse').update({ stato: 'chiusa' })
    const b = new Browser()
    await b.loginSviluppo('admin')
    const html = await (await b.get('/portafoglio')).text()
    assert.include(html, 'data-testid="portafoglio-vuoto"')
    assert.include(html, 'href="/admin/commesse"')
  })

  test('non autenticato: redirezione all’accesso', async ({ assert }) => {
    const r = await new Browser().get('/portafoglio')
    assert.equal(r.status, 302)
  })
})
