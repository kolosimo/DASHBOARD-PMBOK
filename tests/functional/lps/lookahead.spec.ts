/**
 * LPS · lookahead e registro vincoli: stato pronta/vincolata calcolato,
 * vincoli molti-a-molti, rimuovi / riapri / annulla, attività, 409.
 */
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import Vincolo from '#models/vincolo'
import AttivitaLookahead from '#models/attivita_lookahead'
import AuditLog from '#models/audit_log'
import Utente from '#models/utente'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'
import { attivitaLookahead, registroVincoli, riepilogoLps } from '#modules/lps/queries'

const W40 = '2026-09-28'
const W45 = '2026-11-02'

async function scuola() {
  return Commessa.findByOrFail('codice', 'CL-2026-031')
}

async function sessione(slug: string, commessaId: number) {
  const b = new Browser()
  await b.loginSviluppo(slug)
  const html = await (await b.vai(`/commesse/${commessaId}/lps/lookahead?da=${W40}`)).text()
  const csrf = Browser.csrfDa(html)
  return { b, csrf, htmx: { 'hx-request': 'true', 'x-csrf-token': csrf } }
}

async function vincolo(commessaId: number, codice: string) {
  return Vincolo.query().where('commessa_id', commessaId).where('codice', codice).firstOrFail()
}

async function statoAttivita(commessaId: number, codice: string) {
  const righe = await attivitaLookahead(commessaId, W40, W45)
  return righe.find((a) => a.codice === codice)!
}

test.group('LPS · stato delle attività', (group) => {
  conTransazione(group)

  test('pronta se nessun vincolo collegato è aperto o da analizzare', async ({ assert }) => {
    const c = await scuola()
    const l1 = await statoAttivita(c.id, 'L1')
    assert.isFalse(l1.pronta)
    assert.equal(l1.vincoliAperti, 1)
    assert.equal(l1.disciplinaCodice, 'MEC', 'disciplina presa dall’elaborato')
    assert.isTrue((await statoAttivita(c.id, 'L3')).pronta, 'V-17 è rimosso')
    assert.isTrue((await statoAttivita(c.id, 'L7')).pronta, 'nessun vincolo')

    // da_analizzare blocca, annullato no
    const v12 = await vincolo(c.id, 'V-12')
    await v12.merge({ stato: 'da_analizzare' }).save()
    assert.isFalse((await statoAttivita(c.id, 'L1')).pronta)
    await v12.merge({ stato: 'annullato' }).save()
    assert.isTrue((await statoAttivita(c.id, 'L1')).pronta)
  })
})

test.group('LPS · azioni sui vincoli', (group) => {
  conTransazione(group)

  test('rimuovi: L1 diventa pronta, PCR W40 = 1/3, audit ed evento', async ({ assert }) => {
    const c = await scuola()
    const v12 = await vincolo(c.id, 'V-12')
    const { b, htmx } = await sessione('pm1', c.id)
    const r = await b.post(
      `/commesse/${c.id}/lps/vincoli/${v12.id}/rimuovi`,
      { version: String(v12.version), da: W40, filtro: 'tutti' },
      htmx
    )
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.match(html.trim(), /^<div\s+id="lookahead-lps"/)
    assert.include(html, 'data-testid="riapri-V-12"')
    assert.include(html, '1 di 3 vincoli in scadenza nella settimana rimossi')
    assert.include(JSON.parse(r.headers.get('hx-trigger')!).toast, 'V-12 rimosso')

    const dopo = await Vincolo.findOrFail(v12.id)
    assert.equal(dopo.stato, 'rimosso')
    assert.isNotNull(dopo.rimossoIl)
    assert.isTrue((await statoAttivita(c.id, 'L1')).pronta)
    assert.equal((await riepilogoLps(c.id, W40)).pcr, 1 / 3)
    assert.lengthOf(await AuditLog.query().where('azione', 'lps.vincolo.rimuovi'), 1)
  })

  test('riapri un rimosso e annulla un aperto', async ({ assert }) => {
    const c = await scuola()
    const v17 = await vincolo(c.id, 'V-17')
    const v13 = await vincolo(c.id, 'V-13')
    const { b, htmx } = await sessione('pm1', c.id)
    const r1 = await b.post(
      `/commesse/${c.id}/lps/vincoli/${v17.id}/riapri`,
      { version: String(v17.version), da: W40 },
      htmx
    )
    assert.equal(r1.status, 200)
    const riaperto = await Vincolo.findOrFail(v17.id)
    assert.equal(riaperto.stato, 'aperto')
    assert.isNull(riaperto.rimossoIl)
    assert.isFalse((await statoAttivita(c.id, 'L3')).pronta)

    const r2 = await b.post(
      `/commesse/${c.id}/lps/vincoli/${v13.id}/annulla`,
      { version: String(v13.version), da: W40 },
      htmx
    )
    assert.equal(r2.status, 200)
    const annullato = await Vincolo.findOrFail(v13.id)
    assert.equal(annullato.stato, 'annullato')
    assert.isNotNull(annullato.annullatoIl)
    // W40: V-13 annullato durante la settimana esce dal denominatore → 0/2
    assert.equal((await riepilogoLps(c.id, W40)).pcr, 0)
  })

  test('azione non coerente con lo stato: 422 con messaggio', async ({ assert }) => {
    const c = await scuola()
    const v17 = await vincolo(c.id, 'V-17')
    const { b, htmx } = await sessione('pm1', c.id)
    const r = await b.post(
      `/commesse/${c.id}/lps/vincoli/${v17.id}/rimuovi`,
      { version: String(v17.version), da: W40 },
      htmx
    )
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'non è aperto')
  })

  test('versione vecchia: 409 con il lookahead aggiornato', async ({ assert }) => {
    const c = await scuola()
    const v15 = await vincolo(c.id, 'V-15')
    const { b, htmx } = await sessione('pm1', c.id)
    const campi = { version: String(v15.version), da: W40 }
    assert.equal(
      (await b.post(`/commesse/${c.id}/lps/vincoli/${v15.id}/rimuovi`, campi, htmx)).status,
      200
    )
    const r = await b.post(`/commesse/${c.id}/lps/vincoli/${v15.id}/riapri`, campi, htmx)
    assert.equal(r.status, 409)
    const html = await r.text()
    assert.include(html, 'data-testid="conflitto"')
    assert.include(html, 'id="lookahead-lps"')
    assert.equal((await Vincolo.findOrFail(v15.id)).stato, 'rimosso')
  })

  test('progettista e direzione non cambiano i vincoli (403)', async ({ assert }) => {
    const c = await scuola()
    const v12 = await vincolo(c.id, 'V-12')
    for (const slug of ['mec1', 'direzione']) {
      const { b, htmx } = await sessione(slug, c.id)
      const r = await b.post(
        `/commesse/${c.id}/lps/vincoli/${v12.id}/rimuovi`,
        { version: String(v12.version), da: W40 },
        htmx
      )
      assert.equal(r.status, 403, slug)
    }
    assert.equal((await Vincolo.findOrFail(v12.id)).stato, 'aperto')
  })
})

test.group('LPS · registro vincoli (inserimento e modifica)', (group) => {
  conTransazione(group)

  test('nuovo vincolo collegato a due attività, responsabile esterno, codice V-18', async ({
    assert,
  }) => {
    const c = await scuola()
    const l1 = await AttivitaLookahead.query()
      .where('commessa_id', c.id)
      .where('codice', 'L1')
      .firstOrFail()
    const l7 = await AttivitaLookahead.query()
      .where('commessa_id', c.id)
      .where('codice', 'L7')
      .firstOrFail()
    const { b, csrf } = await sessione('pm1', c.id)
    const corpo = new URLSearchParams({
      _csrf: csrf,
      descrizione: 'Quote dei cavedi dallo strutturista',
      categoria: 'informazioni',
      stato: 'da_analizzare',
      responsabile_esterno: 'Strutturista',
      data_necessaria: '2026-10-09',
      identificato_il: '2026-09-28',
    })
    corpo.append('attivita[]', String(l1.id))
    corpo.append('attivita[]', String(l7.id))
    const r = await fetch(b.url(`/commesse/${c.id}/lps/vincoli`), {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'cookie': [...b.cookie].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: corpo.toString(),
    })
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), `/commesse/${c.id}/lps/lookahead`)

    const [v] = (await registroVincoli(c.id)).filter((x) => x.codice === 'V-18')
    assert.exists(v)
    assert.equal(v.stato, 'da_analizzare')
    assert.equal(v.responsabileEsterno, 'Strutturista')
    assert.isNull(v.responsabileId)
    assert.deepEqual(
      v.attivita.map((a) => a.codice),
      ['L1', 'L7']
    )
    assert.isFalse((await statoAttivita(c.id, 'L7')).pronta, 'da analizzare blocca')
    assert.lengthOf(await AuditLog.query().where('azione', 'lps.vincolo.creato'), 1)
  })

  test('senza responsabile: errore e ritorno al modulo con i valori', async ({ assert }) => {
    const c = await scuola()
    const { b, csrf } = await sessione('pm1', c.id)
    const r = await b.post(`/commesse/${c.id}/lps/vincoli`, {
      _csrf: csrf,
      descrizione: 'Vincolo senza responsabile',
      categoria: 'altro',
      stato: 'aperto',
    })
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), `/commesse/${c.id}/lps/vincoli/nuovo`)
    const html = await (await b.vai(r.headers.get('location')!)).text()
    assert.include(html, 'Indica chi rimuove il vincolo')
    assert.include(html, 'value="Vincolo senza responsabile"')
    const n = await db.from('vincoli').where('commessa_id', c.id).count('* as n').first()
    assert.equal(Number(n!.n), 6)
  })

  test('modifica: nuovi collegamenti e versione vecchia → 409', async ({ assert }) => {
    const c = await scuola()
    const v14 = await vincolo(c.id, 'V-14')
    const l4 = await AttivitaLookahead.query()
      .where('commessa_id', c.id)
      .where('codice', 'L4')
      .firstOrFail()
    const l6 = await AttivitaLookahead.query()
      .where('commessa_id', c.id)
      .where('codice', 'L6')
      .firstOrFail()
    const pm1 = await Utente.findByOrFail('email', 'pm1@climosfera.example')
    const { b, csrf } = await sessione('pm1', c.id)
    const modulo = await (await b.vai(`/commesse/${c.id}/lps/vincoli/${v14.id}/modifica`)).text()
    assert.include(modulo, 'aria dal committente')

    const campi = {
      '_csrf': csrf,
      'version': String(v14.version),
      'descrizione': 'Conferma ricambi d’aria (rev.)',
      'categoria': 'approvazione',
      'stato': 'aperto',
      'responsabile_id': String(pm1.id),
      'data_necessaria': '2026-10-06',
      'identificato_il': '2026-09-07',
      'attivita[]': String(l6.id),
    }
    const r = await b.post(`/commesse/${c.id}/lps/vincoli/${v14.id}`, campi)
    assert.equal(r.status, 302)
    const [dopo] = await registroVincoli(c.id, 'tutti', v14.id)
    assert.deepEqual(
      dopo.attivita.map((a) => a.codice),
      ['L6']
    )
    assert.equal(dopo.version, v14.version + 1)
    assert.isTrue((await statoAttivita(c.id, 'L4')).pronta, 'L4 non è più collegata')
    void l4

    const r2 = await b.post(`/commesse/${c.id}/lps/vincoli/${v14.id}`, campi)
    assert.equal(r2.status, 409)
  })
})

test.group('LPS · attività del lookahead', (group) => {
  conTransazione(group)

  test('nuova attività con disciplina propria e last planner, poi modifica ed elimina', async ({
    assert,
  }) => {
    const c = await scuola()
    const ele1 = await Utente.findByOrFail('email', 'ele1@climosfera.example')
    const ant = await db.from('discipline').where('codice', 'ANT').firstOrFail()
    const { b, csrf } = await sessione('pm1', c.id)
    const r = await b.post(`/commesse/${c.id}/lps/attivita`, {
      _csrf: csrf,
      codice: 'L8',
      titolo: 'Verifica compartimentazioni',
      tipo: 'attivita',
      disciplina_id: String(ant.id),
      responsabile_id: String(ele1.id),
      settimana_inizio: '2026-10-12',
      settimana_fine: '2026-10-19',
    })
    assert.equal(r.status, 302)
    const l8 = (await attivitaLookahead(c.id, W40, W45)).find((a) => a.codice === 'L8')!
    assert.exists(l8)
    assert.equal(l8.disciplinaCodice, 'ANT')
    assert.isTrue(l8.disciplinaPropria)
    assert.equal(l8.responsabileNome, 'Progettista ELE 1')
    assert.isTrue(l8.pronta)

    // Codice duplicato
    const dup = await b.post(`/commesse/${c.id}/lps/attivita`, {
      _csrf: csrf,
      codice: 'L8',
      titolo: 'Doppione',
      tipo: 'attivita',
      settimana_inizio: '2026-10-12',
      settimana_fine: '2026-10-12',
    })
    assert.equal(dup.headers.get('location'), `/commesse/${c.id}/lps/attivita/nuova`)
    const pagina = await (await b.vai(dup.headers.get('location')!)).text()
    assert.include(pagina, 'Il codice L8 è già usato')

    // Fine prima dell'inizio
    const r2 = await b.post(`/commesse/${c.id}/lps/attivita/${l8.id}`, {
      _csrf: csrf,
      version: String(l8.version),
      codice: 'L8',
      titolo: 'Verifica compartimentazioni',
      tipo: 'attivita',
      settimana_inizio: '2026-10-19',
      settimana_fine: '2026-10-12',
    })
    assert.equal(r2.status, 302)
    assert.equal(
      (await AttivitaLookahead.findOrFail(l8.id)).settimanaFine,
      '2026-10-19',
      'nessuna modifica'
    )

    const r3 = await b.post(`/commesse/${c.id}/lps/attivita/${l8.id}`, {
      _csrf: csrf,
      version: String(l8.version),
      codice: 'L8',
      titolo: 'Verifica compartimentazioni REI',
      tipo: 'attivita',
      settimana_inizio: '2026-10-12',
      settimana_fine: '2026-10-26',
    })
    assert.equal(r3.headers.get('location'), `/commesse/${c.id}/lps/lookahead`)
    const mod = await AttivitaLookahead.findOrFail(l8.id)
    assert.equal(mod.titolo, 'Verifica compartimentazioni REI')
    assert.equal(mod.settimanaFine, '2026-10-26')
    assert.equal(mod.version, 2)

    const r4 = await b.post(`/commesse/${c.id}/lps/attivita/${l8.id}/elimina`, {
      _csrf: csrf,
      version: '2',
    })
    assert.equal(r4.status, 302)
    assert.isNull(await AttivitaLookahead.find(l8.id))
    const azioni = (await AuditLog.query().where('entita', 'attivita_lookahead')).map(
      (a) => a.azione
    )
    assert.includeMembers(azioni, [
      'lps.attivita.creata',
      'lps.attivita.modificata',
      'lps.attivita.eliminata',
    ])
  })

  test('elaborato di un’altra commessa: rifiutato', async ({ assert }) => {
    const c = await scuola()
    const altra = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const [estraneo] = await db.from('elaborati').where('commessa_id', altra.id).limit(1)
    const { b, csrf } = await sessione('pm1', c.id)
    const r = await b.post(`/commesse/${c.id}/lps/attivita`, {
      _csrf: csrf,
      codice: 'L9',
      titolo: 'Con elaborato estraneo',
      tipo: 'attivita',
      elaborato_id: String(estraneo?.id ?? 999999),
      settimana_inizio: '2026-10-12',
      settimana_fine: '2026-10-12',
    })
    assert.equal(r.status, 302)
    assert.isNull(
      await AttivitaLookahead.query().where('commessa_id', c.id).where('codice', 'L9').first()
    )
  })
})
