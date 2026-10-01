/**
 * LPS · punti Fibonacci sugli impegni: valori ammessi, modifica solo in bozza,
 * 409 sulla versione vecchia, permessi, capacità indicativa dai piani chiusi.
 */
import { test } from '@japa/runner'
import Commessa from '#models/commessa'
import PianoSettimanale from '#models/piano_settimanale'
import Impegno from '#models/impegno'
import AuditLog from '#models/audit_log'
import Utente from '#models/utente'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'
import { pianoSettimana, puntiSettimana } from '#modules/lps/queries'

const W39 = '2026-09-21'
const W41 = '2026-10-05'

async function scuola() {
  return Commessa.findByOrFail('codice', 'CL-2026-031')
}

async function utente(slug: string) {
  return Utente.findByOrFail('email', `${slug}@climosfera.example`)
}

async function sessione(slug: string, commessaId: number, settimana = W41) {
  const b = new Browser()
  await b.loginSviluppo(slug)
  const html = await (
    await b.vai(`/commesse/${commessaId}/lps/settimana?settimana=${settimana}`)
  ).text()
  const htmx = { 'hx-request': 'true', 'x-csrf-token': Browser.csrfDa(html) }
  return { b, htmx }
}

async function bozzaW41(commessaId: number) {
  return PianoSettimanale.create({ commessaId, settimana: W41, stato: 'bozza' })
}

test.group('LPS · punti Fibonacci', (group) => {
  conTransazione(group)

  test('impegno aggiunto con i punti; valore fuori scala rifiutato', async ({ assert }) => {
    const c = await scuola()
    const piano = await bozzaW41(c.id)
    const mec1 = await utente('mec1')
    const { b, htmx } = await sessione('pm1', c.id)

    const r1 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/impegni`,
      { descrizione: 'Dimensionamento collettori', last_planner_id: String(mec1.id), punti: '5' },
      htmx
    )
    assert.equal(r1.status, 200)
    const html = await r1.text()
    assert.include(html, 'Punti promessi')
    const imp = await Impegno.query().where('piano_id', piano.id).firstOrFail()
    assert.equal(imp.punti, 5)

    const r2 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/impegni`,
      { descrizione: 'Troppo grande', last_planner_id: String(mec1.id), punti: '21' },
      htmx
    )
    assert.equal(r2.status, 422)
    assert.include(await r2.text(), 'punti (1, 2, 3, 5, 8 o 13)')

    // Senza punti: non stimato
    const r3 = await b.post(
      `/commesse/${c.id}/lps/piani/${piano.id}/impegni`,
      { descrizione: 'Da stimare', last_planner_id: String(mec1.id), punti: '' },
      htmx
    )
    assert.equal(r3.status, 200)
    const nonStimato = await Impegno.query()
      .where('piano_id', piano.id)
      .where('descrizione', 'Da stimare')
      .firstOrFail()
    assert.isNull(nonStimato.punti)
  })

  test('in bozza il PM cambia i punti (audit); 409 sulla versione vecchia', async ({ assert }) => {
    const c = await scuola()
    const piano = await bozzaW41(c.id)
    const mec1 = await utente('mec1')
    const imp = await Impegno.create({
      pianoId: piano.id,
      descrizione: 'Schema funzionale',
      lastPlannerId: mec1.id,
      punti: 3,
      aggiuntoDopoPromessa: false,
      ordine: 1,
    })
    const { b, htmx } = await sessione('pm1', c.id)

    const r1 = await b.post(
      `/commesse/${c.id}/lps/impegni/${imp.id}/punti`,
      { version: '1', punti: '8' },
      htmx
    )
    assert.equal(r1.status, 200)
    assert.include(await r1.text(), 'Punti salvati.')
    const dopo = await Impegno.findOrFail(imp.id)
    assert.equal(dopo.punti, 8)
    assert.equal(dopo.version, 2)
    const audit = await AuditLog.query()
      .where('azione', 'lps.impegno.punti')
      .where('entita_id', imp.id)
      .first()
    assert.isNotNull(audit)

    // Di nuovo con la versione vecchia: conflitto
    const r2 = await b.post(
      `/commesse/${c.id}/lps/impegni/${imp.id}/punti`,
      { version: '1', punti: '2' },
      htmx
    )
    assert.equal(r2.status, 409)
    assert.equal((await Impegno.findOrFail(imp.id)).punti, 8)

    // Vuoto = torna "non stimato"
    const r3 = await b.post(
      `/commesse/${c.id}/lps/impegni/${imp.id}/punti`,
      { version: String(dopo.version), punti: '' },
      htmx
    )
    assert.equal(r3.status, 200)
    assert.isNull((await Impegno.findOrFail(imp.id)).punti)
  })

  test('dopo la promessa i punti non si cambiano più', async ({ assert }) => {
    const c = await scuola()
    const w39 = await PianoSettimanale.query()
      .where('commessa_id', c.id)
      .where('settimana', W39)
      .firstOrFail()
    const imp = await Impegno.query().where('piano_id', w39.id).orderBy('ordine').firstOrFail()
    const { b, htmx } = await sessione('pm1', c.id, W39)
    const r = await b.post(
      `/commesse/${c.id}/lps/impegni/${imp.id}/punti`,
      { version: String(imp.version), punti: '13' },
      htmx
    )
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'solo mentre il piano è in bozza')
    assert.equal((await Impegno.findOrFail(imp.id)).punti, imp.punti)
  })

  test('il progettista non cambia i punti', async ({ assert }) => {
    const c = await scuola()
    const piano = await bozzaW41(c.id)
    const mec1 = await utente('mec1')
    const imp = await Impegno.create({
      pianoId: piano.id,
      descrizione: 'Mio impegno',
      lastPlannerId: mec1.id,
      punti: 2,
      aggiuntoDopoPromessa: false,
      ordine: 1,
    })
    const { b, htmx } = await sessione('mec1', c.id)
    const r = await b.post(
      `/commesse/${c.id}/lps/impegni/${imp.id}/punti`,
      { version: '1', punti: '13' },
      htmx
    )
    assert.equal(r.status, 403)
    assert.equal((await Impegno.findOrFail(imp.id)).punti, 2)
  })

  test('capacità indicativa dalle ultime 4 settimane chiuse (dati di esempio)', async ({
    assert,
  }) => {
    const c = await scuola()
    const piano = await pianoSettimana(c.id, W39)
    const punti = await puntiSettimana(c.id, W39, piano!.impegni)
    // W35–W38 chiuse: 23, 25, 18 e 29 punti fatti
    assert.deepEqual(punti.capacita, { media: 23.75, settimane: 4 })
    assert.equal(punti.piano.promessi, 24)
    assert.isTrue(punti.oltreCapacita)

    const { b } = await sessione('pm1', c.id, W39)
    const html = await (await b.vai(`/commesse/${c.id}/lps/settimana?settimana=${W39}`)).text()
    assert.include(html, 'capacità indicativa 23,8 a settimana')
    assert.include(html, 'oltre la capacità')
  })
})
