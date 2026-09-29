/**
 * Integrazione tra moduli (Fase 2, B4): letture incrociate tramite le funzioni
 * di queries.ts dei moduli proprietari e stato iniziale scritto dal flusso.
 */
import { existsSync } from 'node:fs'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import Commessa from '#models/commessa'
import Elaborato from '#models/elaborato'
import AttivitaLookahead from '#models/attivita_lookahead'
import CambioStatoService from '#modules/flusso/cambio_stato_service'
import { riepilogoFlusso, statiAllIstante } from '#modules/flusso/queries'
import { elaboratoInBaselineApprovata, righeElaborati } from '#modules/evm/queries'
import { minutiPerElaborato } from '#modules/ore/queries'
import { oggiRoma } from '#shared/calendario'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

async function scuola() {
  return Commessa.findByOrFail('codice', 'CL-2026-031')
}
async function uffici() {
  return Commessa.findByOrFail('codice', 'CL-2026-018')
}
async function entra(come: string, commessaId: number) {
  const b = new Browser()
  await b.loginSviluppo(come)
  const html = await (await b.vai(`/commesse/${commessaId}/anagrafica`)).text()
  return { b, csrf: Browser.csrfDa(html) }
}
async function transizioni(elaboratoId: number) {
  return db.from('transizioni_elaborato').where('elaborato_id', elaboratoId).orderBy('id')
}

test.group('Integrazione · stato iniziale dal modulo flusso', (group) => {
  conTransazione(group)

  test('creazione da form: stato iniziale e transizione di nascita', async ({ assert }) => {
    const c = await uffici()
    const mec = await db.from('discipline').where('codice', 'MEC').firstOrFail()
    const { b, csrf } = await entra('pm2', c.id)
    const r = await b.post(`/commesse/${c.id}/elaborati`, {
      _csrf: csrf,
      codice: 'B4-NUOVO-1',
      titolo: 'Centrale termica – schema',
      disciplina_id: String(mec.id),
      budget_ore: '8',
      classe_servizio: 'standard',
    })
    assert.equal(r.status, 302)
    const el = await Elaborato.findByOrFail('codice', 'B4-NUOVO-1')
    const iniziale = await db.from('stati_elaborato').orderBy('ordine').firstOrFail()
    assert.equal(el.statoId, iniziale.id)

    const storia = await transizioni(el.id)
    assert.lengthOf(storia, 1)
    assert.isNull(storia[0].da_stato_id)
    assert.equal(storia[0].a_stato_id, iniziale.id)
    assert.equal(new Date(storia[0].avvenuta_il).getTime(), el.statoDal.toMillis())
    const utente = await db.from('utenti').where('nome', 'PM 2').firstOrFail()
    assert.equal(storia[0].utente_id, utente.id)
  })

  test('import: ogni elaborato ha la sua transizione di nascita', async ({ assert }) => {
    const c = await uffici()
    const { b, csrf } = await entra('pm2', c.id)
    const testo = 'B4-I-1\tSchema UTA\tMEC\t10\nB4-I-2\tQuadro BMS\tELE\t5'
    const r = await b.post(`/commesse/${c.id}/elaborati/import`, { _csrf: csrf, testo })
    assert.equal(r.status, 302)
    for (const codice of ['B4-I-1', 'B4-I-2']) {
      const el = await Elaborato.findByOrFail('codice', codice)
      const storia = await transizioni(el.id)
      assert.lengthOf(storia, 1, codice)
      assert.isNull(storia[0].da_stato_id)
      assert.equal(storia[0].a_stato_id, el.statoId)
    }
  })

  test('un elaborato nuovo compare nel CFD e nel Kanban della commessa', async ({ assert }) => {
    const c = await uffici()
    const { b, csrf } = await entra('pm2', c.id)
    await b.post(`/commesse/${c.id}/elaborati/import`, {
      _csrf: csrf,
      testo: 'B4-CFD-1\tSchema idrico\tIDR\t4',
    })
    const riepilogo = await riepilogoFlusso(c.id, oggiRoma())
    const prima = riepilogo.colonne[0]
    assert.isTrue(prima.schede.some((s) => s.codice === 'B4-CFD-1'))
  })

  test('registraCreazione su un elaborato inesistente: errore 404', async ({ assert }) => {
    await db.transaction(async (trx) => {
      await assert.rejects(() => CambioStatoService.registraCreazione(999999, null, trx))
    })
  })
})

test.group('Integrazione · statiAllIstante (flusso) usata dall’EVM', (group) => {
  conTransazione(group)

  test('lo stato a un istante passato ignora i passaggi successivi', async ({ assert }) => {
    const c = await scuola()
    const el = await Elaborato.findByOrFail('codice', 'MEC-PL-102')
    const statoPrima = el.statoId
    const istantePrima = new Date(Date.now() - 1000).toISOString()

    const attuale = await db.from('stati_elaborato').where('id', statoPrima).firstOrFail()
    const successivo = await db
      .from('stati_elaborato')
      .where('ordine', '>', attuale.ordine)
      .orderBy('ordine')
      .firstOrFail()
    const esito = await CambioStatoService.cambia({
      elaboratoId: el.id,
      commessaId: c.id,
      versioneAttesa: el.version,
      aStatoId: successivo.id,
      utenteId: null,
    })
    const istanteDopo = new Date(esito.elaborato.statoDal.toMillis() + 1000).toISOString()

    const prima = await statiAllIstante(c.id, istantePrima)
    const dopo = await statiAllIstante(c.id, istanteDopo)
    assert.equal(prima.get(el.id), statoPrima)
    assert.equal(dopo.get(el.id), esito.aStato.id)

    // L'EVM (snapshot) legge lo stesso stato
    const righe = await righeElaborati(c.id, oggiRoma(), istantePrima)
    assert.equal(righe.find((r) => r.elaboratoId === el.id)!.statoId, statoPrima)
    const attuali = await righeElaborati(c.id, oggiRoma(), null)
    assert.equal(attuali.find((r) => r.elaboratoId === el.id)!.statoId, esito.aStato.id)
  })

  test('un elaborato nato dopo l’istante non ha stato (null)', async ({ assert }) => {
    const c = await scuola()
    const istante = new Date(Date.now() - 1000).toISOString()
    const { b, csrf } = await entra('pm1', c.id)
    await b.post(`/commesse/${c.id}/elaborati/import`, {
      _csrf: csrf,
      testo: 'B4-TARDI-1\tTavola tarda\tMEC\t4',
    })
    const el = await Elaborato.findByOrFail('codice', 'B4-TARDI-1')
    const stati = await statiAllIstante(c.id, istante)
    assert.isTrue(stati.has(el.id))
    assert.isNull(stati.get(el.id))
  })
})

test.group('Integrazione · elaboratoInBaselineApprovata (EVM)', (group) => {
  conTransazione(group)

  test('vero per un elaborato della baseline approvata, falso per uno nuovo', async ({
    assert,
  }) => {
    const c = await scuola()
    const inBaseline = await db
      .from('baseline_date_stato as d')
      .join('baseline as b', 'b.id', 'd.baseline_id')
      .where('b.commessa_id', c.id)
      .where('b.stato', 'approvata')
      .select('d.elaborato_id')
      .firstOrFail()
    assert.isTrue(await elaboratoInBaselineApprovata(inBaseline.elaborato_id))

    const { b, csrf } = await entra('pm1', c.id)
    await b.post(`/commesse/${c.id}/elaborati/import`, {
      _csrf: csrf,
      testo: 'B4-FUORI-1\tFuori baseline\tMEC\t4',
    })
    const nuovo = await Elaborato.findByOrFail('codice', 'B4-FUORI-1')
    assert.isFalse(await elaboratoInBaselineApprovata(nuovo.id))
  })

  test('l’anagrafica blocca l’eliminazione con il messaggio della baseline', async ({ assert }) => {
    const c = await scuola()
    const riga = await db
      .from('baseline_date_stato as d')
      .join('baseline as b', 'b.id', 'd.baseline_id')
      .join('elaborati as e', 'e.id', 'd.elaborato_id')
      .where('b.commessa_id', c.id)
      .where('b.stato', 'approvata')
      .select('e.id', 'e.version')
      .firstOrFail()
    const { b, csrf } = await entra('pm1', c.id)
    const r = await b.post(`/commesse/${c.id}/elaborati/${riga.id}/elimina`, {
      _csrf: csrf,
      version: String(riga.version),
      conferma: 'on',
    })
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'baseline approvata')
    assert.isNotNull(await Elaborato.find(riga.id))
  })
})

test.group('Integrazione · minutiPerElaborato (ore) usata da Kanban ed EVM', (group) => {
  conTransazione(group)

  test('totali per elaborato uguali alla somma delle registrazioni', async ({ assert }) => {
    const c = await scuola()
    const mappa = await minutiPerElaborato(c.id)
    const attese = await db
      .from('registrazioni_ore as r')
      .join('elaborati as e', 'e.id', 'r.elaborato_id')
      .where('e.commessa_id', c.id)
      .groupBy('r.elaborato_id')
      .select('r.elaborato_id')
      .sum('r.minuti as minuti')
    assert.isAbove(attese.length, 0)
    for (const a of attese) assert.equal(mappa.get(a.elaborato_id), Number(a.minuti))
    assert.equal(mappa.size, attese.length)
  })

  test('con finoAl esclude le registrazioni successive', async ({ assert }) => {
    const c = await scuola()
    const primaData = await db
      .from('registrazioni_ore as r')
      .join('elaborati as e', 'e.id', 'r.elaborato_id')
      .where('e.commessa_id', c.id)
      .min('r.data as d')
      .firstOrFail()
    const giornoPrima = new Date(new Date(primaData.d).getTime() - 86_400_000)
      .toISOString()
      .slice(0, 10)
    const nulla = await minutiPerElaborato(c.id, { finoAl: giornoPrima })
    assert.equal(nulla.size, 0)
  })

  test('Kanban ed EVM mostrano lo stesso AC per elaborato', async ({ assert }) => {
    const c = await scuola()
    const oggi = oggiRoma()
    const mappa = await minutiPerElaborato(c.id, { finoAl: oggi })
    const kanban = await riepilogoFlusso(c.id, oggi)
    const evm = await righeElaborati(c.id, oggi, null)
    for (const s of kanban.colonne.flatMap((col) => col.schede)) {
      assert.equal(s.acMinuti, mappa.get(s.elaboratoId) ?? 0, s.codice)
      assert.equal(evm.find((r) => r.elaboratoId === s.elaboratoId)!.acMinuti, s.acMinuti)
    }
  })
})

test.group('Integrazione · modelli condivisi al posto dei modelli locali', (group) => {
  conTransazione(group)

  test('i modelli locali non esistono più', ({ assert }) => {
    assert.isFalse(existsSync(app.makePath('app/modules/anagrafiche/modelli.ts')))
    assert.isFalse(existsSync(app.makePath('app/modules/lps/modelli.ts')))
  })

  test('milestone dell’elaborato e disciplina dell’attività dai modelli condivisi', async ({
    assert,
  }) => {
    const c = await scuola()
    const ms = await db.from('milestone').where('commessa_id', c.id).firstOrFail()
    const el = await Elaborato.findByOrFail('codice', 'MEC-PL-102')
    const { b, csrf } = await entra('pm1', c.id)
    const r = await b.post(`/commesse/${c.id}/elaborati/${el.id}`, {
      _csrf: csrf,
      version: String(el.version),
      codice: el.codice,
      titolo: el.titolo,
      disciplina_id: String(el.disciplinaId),
      budget_ore: String(el.budgetMinuti / 60).replace('.', ','),
      classe_servizio: el.classeServizio,
      milestone_id: String(ms.id),
    })
    assert.equal(r.status, 302)
    assert.equal((await Elaborato.findOrFail(el.id)).milestoneId, ms.id)

    const ele = await db.from('discipline').where('codice', 'ELE').firstOrFail()
    const a = await AttivitaLookahead.query().where('commessa_id', c.id).firstOrFail()
    a.disciplinaId = ele.id
    await a.save()
    assert.equal((await AttivitaLookahead.findOrFail(a.id)).disciplinaId, ele.id)
  })
})
