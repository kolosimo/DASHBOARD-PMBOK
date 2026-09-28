/**
 * LPS · piano settimanale: esito, causa obbligatoria, promessa, chiusura,
 * impegni aggiunti dopo la promessa, permessi del last planner, 409.
 */
import { test } from '@japa/runner'
import Commessa from '#models/commessa'
import PianoSettimanale from '#models/piano_settimanale'
import Impegno from '#models/impegno'
import AuditLog from '#models/audit_log'
import SnapshotLps from '#models/snapshot_lps'
import Utente from '#models/utente'
import AttivitaLookahead from '#models/attivita_lookahead'
import { ascoltaEventi, type Evento } from '#shared/eventi'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'
import { riepilogoLps } from '#modules/lps/queries'

const W39 = '2026-09-21'
const W41 = '2026-10-05'

async function scuola() {
  return Commessa.findByOrFail('codice', 'CL-2026-031')
}

async function utente(slug: string) {
  return Utente.findByOrFail('email', `${slug}@climosfera.example`)
}

/** Browser autenticato con il token CSRF della pagina del piano */
async function sessione(slug: string, commessaId: number, settimana = W39) {
  const b = new Browser()
  await b.loginSviluppo(slug)
  const html = await (
    await b.vai(`/commesse/${commessaId}/lps/settimana?settimana=${settimana}`)
  ).text()
  const csrf = Browser.csrfDa(html)
  const htmx = { 'hx-request': 'true', 'x-csrf-token': csrf }
  return { b, csrf, htmx }
}

async function impegniW39(commessaId: number) {
  const piano = await PianoSettimanale.query()
    .where('commessa_id', commessaId)
    .where('settimana', W39)
    .firstOrFail()
  const impegni = await Impegno.query().where('piano_id', piano.id).orderBy('ordine')
  return { piano, impegni }
}

test.group('LPS · esito degli impegni', (group) => {
  conTransazione(group)

  test('il PM segna "no" e poi la causa: frammento aggiornato, audit ed evento', async ({
    assert,
  }) => {
    const c = await scuola()
    const { impegni } = await impegniW39(c.id)
    const primo = impegni[0] // fatto = true nel seed
    const { b, htmx } = await sessione('pm1', c.id)
    const eventi: Evento[] = []
    const smetti = ascoltaEventi((_canale, e) => eventi.push(e))

    const r = await b.post(
      `/commesse/${c.id}/lps/impegni/${primo.id}/esito`,
      { version: String(primo.version), fatto: 'no', fatto_attuale: 'si' },
      htmx
    )
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'id="piano-lps"')
    assert.include(html, 'causa mancante')
    assert.include(html, '4 di 7 impegni mantenuti')

    const dopo = await Impegno.findOrFail(primo.id)
    assert.isFalse(dopo.fatto)
    assert.equal(dopo.version, primo.version + 1)

    const r2 = await b.post(
      `/commesse/${c.id}/lps/impegni/${primo.id}/esito`,
      {
        'version': String(dopo.version),
        'fatto_attuale': 'no',
        'causa_id': '1',
        'perche[]': 'Manca la planimetria',
      },
      htmx
    )
    assert.equal(r2.status, 200)
    const finale = await Impegno.findOrFail(primo.id)
    assert.isFalse(finale.fatto)
    assert.equal(finale.causaId, 1)
    assert.deepEqual(finale.cinquePerche, ['Manca la planimetria'])
    smetti()

    assert.isTrue(eventi.some((e) => e.tipo === 'piano.aggiornato' && e.commessaId === c.id))
    const audit = await AuditLog.query().where('azione', 'lps.impegno.esito')
    assert.lengthOf(audit, 2)
  })

  test('"sì" azzera causa e 5 perché', async ({ assert }) => {
    const c = await scuola()
    const { impegni } = await impegniW39(c.id)
    const no = impegni.find((i) => i.fatto === false)!
    const { b, htmx } = await sessione('pm1', c.id)
    const r = await b.post(
      `/commesse/${c.id}/lps/impegni/${no.id}/esito`,
      { version: String(no.version), fatto: 'si' },
      htmx
    )
    assert.equal(r.status, 200)
    const dopo = await Impegno.findOrFail(no.id)
    assert.isTrue(dopo.fatto)
    assert.isNull(dopo.causaId)
    assert.isNull(dopo.cinquePerche)
  })

  test('il last planner segna le proprie righe, non quelle degli altri', async ({ assert }) => {
    const c = await scuola()
    const mec1 = await utente('mec1')
    const { impegni } = await impegniW39(c.id)
    const mia = impegni.find((i) => i.lastPlannerId === mec1.id)!
    const altrui = impegni.find((i) => i.lastPlannerId !== mec1.id)!
    const { b, htmx } = await sessione('mec1', c.id)

    const ok = await b.post(
      `/commesse/${c.id}/lps/impegni/${mia.id}/esito`,
      { version: String(mia.version), fatto: 'no' },
      htmx
    )
    assert.equal(ok.status, 200)
    assert.isFalse((await Impegno.findOrFail(mia.id)).fatto)

    const vietato = await b.post(
      `/commesse/${c.id}/lps/impegni/${altrui.id}/esito`,
      { version: String(altrui.version), fatto: 'no' },
      htmx
    )
    assert.equal(vietato.status, 403)
    assert.equal((await Impegno.findOrFail(altrui.id)).fatto, altrui.fatto)
  })

  test('l’osservatore (pm2) non segna nulla', async ({ assert }) => {
    const c = await scuola()
    const { impegni } = await impegniW39(c.id)
    const { b, htmx } = await sessione('pm2', c.id)
    const r = await b.post(
      `/commesse/${c.id}/lps/impegni/${impegni[0].id}/esito`,
      { version: String(impegni[0].version), fatto: 'no' },
      htmx
    )
    assert.equal(r.status, 403)
  })

  test('versione vecchia: 409 con il frammento aggiornato', async ({ assert }) => {
    const c = await scuola()
    const { impegni } = await impegniW39(c.id)
    const imp = impegni[1]
    const a = await sessione('pm1', c.id)
    const r1 = await a.b.post(
      `/commesse/${c.id}/lps/impegni/${imp.id}/esito`,
      { version: String(imp.version), fatto: 'no' },
      a.htmx
    )
    assert.equal(r1.status, 200)
    const r2 = await a.b.post(
      `/commesse/${c.id}/lps/impegni/${imp.id}/esito`,
      { version: String(imp.version), fatto: 'si' },
      a.htmx
    )
    assert.equal(r2.status, 409)
    const html = await r2.text()
    assert.include(html, 'data-testid="conflitto"')
    assert.include(html, 'id="piano-lps"')
    assert.isFalse((await Impegno.findOrFail(imp.id)).fatto)
  })

  test('esito su un piano in bozza: 422 con messaggio', async ({ assert }) => {
    const c = await scuola()
    const { piano, impegni } = await impegniW39(c.id)
    await piano.merge({ stato: 'bozza' }).save()
    const { b, htmx } = await sessione('pm1', c.id)
    const r = await b.post(
      `/commesse/${c.id}/lps/impegni/${impegni[0].id}/esito`,
      { version: String(impegni[0].version), fatto: 'no' },
      htmx
    )
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'l’esito si segna dopo la promessa')
  })
})

test.group('LPS · chiusura del piano', (group) => {
  conTransazione(group)

  test('causa obbligatoria per ogni "no" e sì/no su ogni riga; poi chiude e scatta lo snapshot', async ({
    assert,
  }) => {
    const c = await scuola()
    const { piano, impegni } = await impegniW39(c.id)
    const { b, htmx } = await sessione('pm1', c.id)

    // Un "no" senza causa
    const senzaCausa = impegni[0]
    await senzaCausa.merge({ fatto: false, causaId: null }).save()
    const r1 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/chiusura`,
      { version: String(piano.version) },
      htmx
    )
    assert.equal(r1.status, 422)
    const html1 = await r1.text()
    assert.include(html1, 'scegli la causa per')
    assert.include(html1, senzaCausa.descrizione)
    assert.equal((await PianoSettimanale.findOrFail(piano.id)).stato, 'promesso')

    // Una riga non segnata
    await senzaCausa.merge({ fatto: null }).save()
    const r2 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/chiusura`,
      { version: String(piano.version) },
      htmx
    )
    assert.equal(r2.status, 422)
    assert.include(await r2.text(), 'segna sì o no su')

    await senzaCausa.merge({ fatto: false, causaId: 4 }).save()
    const r3 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/chiusura`,
      { version: String(piano.version) },
      htmx
    )
    assert.equal(r3.status, 200)
    const chiuso = await PianoSettimanale.findOrFail(piano.id)
    assert.equal(chiuso.stato, 'chiuso')
    assert.isNotNull(chiuso.chiusoIl)

    // W39 è finita (oggi è dopo il 27/09/2026): snapshot immediato
    const snap = await SnapshotLps.query()
      .where('commessa_id', c.id)
      .where('settimana', W39)
      .firstOrFail()
    assert.equal(snap.impegniPromessi, 7)
    assert.equal(snap.impegniFatti, 4)
    assert.closeTo(snap.ppc!, 4 / 7, 0.0001)
    assert.isNull(snap.tmr, 'manca lo snapshot del lookahead di W37')

    // Nessun esito si cambia più
    const r4 = await b.post(
      `/commesse/${c.id}/lps/impegni/${impegni[1].id}/esito`,
      { version: String(impegni[1].version), fatto: 'no' },
      htmx
    )
    assert.equal(r4.status, 422)
  })

  test('il progettista non chiude il piano', async ({ assert }) => {
    const c = await scuola()
    const { piano } = await impegniW39(c.id)
    const { b, htmx } = await sessione('mec1', c.id)
    const r = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/chiusura`,
      { version: String(piano.version) },
      htmx
    )
    assert.equal(r.status, 403)
  })
})

test.group('LPS · preparazione e promessa del piano', (group) => {
  conTransazione(group)

  test('bozza → impegni (avviso se vincolata) → promessa → aggiunto dopo la promessa fuori dal PPC', async ({
    assert,
  }) => {
    const c = await scuola()
    const { b, htmx, csrf } = await sessione('pm1', c.id, W41)

    // Prepara il piano W41 (form classico: redirect)
    const r0 = await b.post(`/commesse/${c.id}/lps/settimana/crea`, {
      _csrf: csrf,
      settimana: W41,
    })
    assert.equal(r0.status, 302)
    const piano = await PianoSettimanale.query()
      .where('commessa_id', c.id)
      .where('settimana', W41)
      .firstOrFail()
    assert.equal(piano.stato, 'bozza')

    // L4 (MEC-PL-110) è vincolata da V-14: si può aggiungere ma con avviso
    const l4 = await AttivitaLookahead.query()
      .where('commessa_id', c.id)
      .where('codice', 'L4')
      .firstOrFail()
    const r1 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/impegni`,
      { attivita_id: String(l4.id) },
      htmx
    )
    assert.equal(r1.status, 200)
    const html1 = await r1.text()
    assert.include(html1, 'data-testid="messaggio-avviso"')
    assert.include(html1, 'V-14')
    const imp1 = await Impegno.query().where('piano_id', piano.id).firstOrFail()
    assert.equal(imp1.descrizione, l4.titolo)
    assert.equal(imp1.lastPlannerId, l4.responsabileId)
    assert.equal(imp1.elaboratoId, l4.elaboratoId)
    assert.isFalse(imp1.aggiuntoDopoPromessa)

    // Impegno libero con last planner esplicito
    const mec2 = await utente('mec2')
    const r2 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/impegni`,
      { descrizione: 'Relazione tecnica VMC', last_planner_id: String(mec2.id) },
      htmx
    )
    assert.equal(r2.status, 200)
    assert.include(await r2.text(), 'data-testid="messaggio-ok"')

    // Senza last planner e senza attività: errore
    const r3 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/impegni`,
      { descrizione: 'Senza responsabile' },
      htmx
    )
    assert.equal(r3.status, 422)
    assert.include(await r3.text(), 'Scegli il last planner')

    // Promessa con avviso per l'attività vincolata
    const r4 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/promessa`,
      { version: String(piano.version) },
      htmx
    )
    assert.equal(r4.status, 200)
    const html4 = await r4.text()
    assert.include(html4, 'attività ancora vincolate: L4')
    const promesso = await PianoSettimanale.findOrFail(piano.id)
    assert.equal(promesso.stato, 'promesso')
    assert.isNotNull(promesso.promessoIl)

    // Dopo la promessa: marcato ed escluso dal PPC
    const r5 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/impegni`,
      { descrizione: 'Urgenza del cliente', last_planner_id: String(mec2.id) },
      htmx
    )
    assert.equal(r5.status, 200)
    const html5 = await r5.text()
    assert.include(html5, 'non entra nel PPC')
    assert.include(html5, 'aggiunto dopo la promessa')
    const aggiunto = await Impegno.query()
      .where('piano_id', piano.id)
      .where('descrizione', 'Urgenza del cliente')
      .firstOrFail()
    assert.isTrue(aggiunto.aggiuntoDopoPromessa)

    // Segno "sì" solo sull'aggiunto: PPC 0 su 2 promessi
    await aggiunto.merge({ fatto: true }).save()
    const riepilogo = await riepilogoLps(c.id, W41)
    assert.equal(riepilogo.promessi, 2)
    assert.equal(riepilogo.fatti, 0)
    assert.equal(riepilogo.ppc, 0)
    assert.equal(riepilogo.statoPiano, 'promesso')

    // Dopo la promessa gli impegni non si eliminano
    const r6 = await b.post(
      `/commesse/${c.id}/lps/impegni/${imp1.id}/elimina`,
      { version: String(imp1.version) },
      htmx
    )
    assert.equal(r6.status, 422)

    const azioni = (await AuditLog.query().where('commessa_id', c.id)).map((a) => a.azione)
    assert.includeMembers(azioni, [
      'lps.piano.creato',
      'lps.impegno.aggiunto',
      'lps.piano.promesso',
    ])
  })

  test('promessa di un piano vuoto: errore; in bozza si elimina un impegno', async ({ assert }) => {
    const c = await scuola()
    const { b, htmx } = await sessione('pm1', c.id, W41)
    const piano = await PianoSettimanale.create({
      commessaId: c.id,
      settimana: W41,
      stato: 'bozza',
    })
    const r1 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/promessa`,
      { version: '1' },
      htmx
    )
    assert.equal(r1.status, 422)
    assert.include(await r1.text(), 'almeno un impegno')

    const mec1 = await utente('mec1')
    const imp = await Impegno.create({
      pianoId: piano.id,
      descrizione: 'Da togliere',
      lastPlannerId: mec1.id,
      aggiuntoDopoPromessa: false,
      ordine: 1,
    })
    const r2 = await b.post(
      `/commesse/${c.id}/lps/impegni/${imp.id}/elimina`,
      { version: '1' },
      htmx
    )
    assert.equal(r2.status, 200)
    assert.isNull(await Impegno.find(imp.id))
  })

  test('il progettista non prepara il piano né aggiunge impegni', async ({ assert }) => {
    const c = await scuola()
    const { b, csrf, htmx } = await sessione('mec1', c.id, W41)
    const r = await b.post(`/commesse/${c.id}/lps/settimana/crea`, { _csrf: csrf, settimana: W41 })
    assert.equal(r.status, 403)
    const { piano } = await impegniW39(c.id)
    const r2 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/impegni`,
      { descrizione: 'x' },
      htmx
    )
    assert.equal(r2.status, 403)
  })
})
