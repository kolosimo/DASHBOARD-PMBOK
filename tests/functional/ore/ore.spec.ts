import { test } from '@japa/runner'
import Commessa from '#models/commessa'
import Elaborato from '#models/elaborato'
import Utente from '#models/utente'
import Impostazione from '#models/impostazione'
import RegistrazioneOre from '#models/registrazione_ore'
import AuditLog from '#models/audit_log'
import { ascoltaEventi } from '#shared/eventi'
import { aggiungiSettimane, lunediDellaSettimana, oggiRoma } from '#shared/calendario'
import { oreCommessa, orePerPersona } from '#modules/ore/queries'
import { minutiDaTesto, statoSettimana } from '#modules/ore/registrazione_service'
import * as D from '#database/dati_esempio'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

const W39 = D.LUNEDI_CORRENTE

async function utente(slug: string) {
  return Utente.findByOrFail('email', `${slug}@${D.DOMINIO_EMAIL}`)
}
async function elaborato(codice: string) {
  return Elaborato.findByOrFail('codice', codice)
}

/** Browser autenticato con il token CSRF letto dalla pagina delle ore */
async function accedi(slug: string, pagina = '/ore') {
  const b = new Browser()
  await b.loginSviluppo(slug)
  const r = await b.vai(pagina)
  const csrf = Browser.csrfDa(await r.text())
  return { b, htmx: { 'hx-request': 'true', 'x-csrf-token': csrf } }
}

/** Lunedì della settimana in corso: è sempre un giorno passato o oggi */
function lunediCorrente() {
  return lunediDellaSettimana(oggiRoma())
}

test.group('Ore · regole pure', () => {
  test('ore scritte in decimali o h:mm diventano minuti', ({ assert }) => {
    assert.equal(minutiDaTesto('1,5'), 90)
    assert.equal(minutiDaTesto('1.25'), 75)
    assert.equal(minutiDaTesto('1:30'), 90)
    assert.equal(minutiDaTesto(' 8 '), 480)
    assert.equal(minutiDaTesto(''), 0)
    assert.isNull(minutiDaTesto('abc'))
    assert.isNull(minutiDaTesto('-2'))
  })

  test('settimana modificabile fino a N giorni dopo la domenica', ({ assert }) => {
    assert.deepEqual(statoSettimana('2026-09-21', 7, '2026-10-04'), {
      chiusa: false,
      modificabileFinoAl: '2026-10-04',
    })
    assert.isTrue(statoSettimana('2026-09-21', 7, '2026-10-05').chiusa)
    assert.isFalse(statoSettimana('2026-09-21', 0, '2026-09-27').chiusa)
    assert.isTrue(statoSettimana('2026-09-21', 0, '2026-09-28').chiusa)
  })
})

test.group('Ore · query', (group) => {
  conTransazione(group)

  test('oreCommessa: totali per elaborato della settimana W39 e cumulati', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const ore = await oreCommessa(c.id, W39)
    assert.equal(ore.settimana, W39)
    assert.lengthOf(ore.perElaborato, D.ELABORATI.length)

    const pl101 = ore.perElaborato.find((r) => r.codice === 'MEC-PL-101')!
    assert.equal(pl101.minutiSettimana, 13 * 60)
    assert.equal(pl101.budgetMinuti, 48 * 60)
    const attesoPl101 = D.ELABORATI.find((e) => e.codice === 'MEC-PL-101')!.ac + 13
    assert.equal(pl101.minutiTotali, attesoPl101 * 60)

    // W39: mec1 13 + 5 h, ele1 11 h
    assert.equal(ore.totaleSettimanaMinuti, 29 * 60)
    // AC della commessa a fine W39: 320 h (come nel prototipo)
    assert.equal(ore.totaleCommessaMinuti, 320 * 60)
    assert.equal(
      ore.totaleCommessaMinuti,
      ore.perElaborato.reduce((a, r) => a + r.minutiTotali, 0)
    )
  })

  test('oreCommessa: le ore dopo la settimana non contano nel cumulato', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const w38 = aggiungiSettimane(W39, -1)
    const ore = await oreCommessa(c.id, w38)
    assert.equal(ore.totaleCommessaMinuti, (320 - 29) * 60)
  })

  test('commessa senza ore: totali a zero, niente divisioni', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const ore = await oreCommessa(c.id, W39)
    assert.equal(ore.totaleSettimanaMinuti, 0)
    assert.equal(ore.totaleCommessaMinuti, 0)
  })

  test('orePerPersona: in ordine alfabetico, non per ore', async ({ assert }) => {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const persone = await orePerPersona(c.id, W39)
    const nomi = persone.map((p) => p.nome)
    assert.deepEqual(
      nomi,
      [...nomi].sort((a, b) => a.localeCompare(b))
    )
    const mec1 = persone.find((p) => p.nome === 'Progettista MEC 1')!
    assert.equal(mec1.minutiSettimana, 18 * 60)
  })
})

test.group('Ore · timesheet personale', (group) => {
  conTransazione(group)

  test('righe: prima gli elaborati di cui si è responsabili, poi gli altri', async ({ assert }) => {
    const { b } = await accedi('mec1')
    const html = await (await b.vai(`/ore?settimana=${W39}`)).text()
    assert.include(html, 'data-testid="timesheet"')
    const pos = (codice: string) => html.indexOf(`data-testid="riga-${codice}"`)
    for (const proprio of ['MEC-RT-001', 'MEC-PL-101', 'MEC-PL-102']) {
      assert.isAbove(pos(proprio), -1, proprio)
      assert.isBelow(pos(proprio), pos('MEC-CA-002'), `${proprio} prima di MEC-CA-002`)
    }
    // Elaborati di una commessa di cui mec1 non fa parte: nessuna riga
    assert.notInclude(html, 'CL-2026-018')
  })

  test('totali giorno e settimana (W39 di mec1: 18 h)', async ({ assert }) => {
    const { b } = await accedi('mec1')
    const html = await (await b.vai(`/ore?settimana=${W39}`)).text()
    const cella = (id: string) => {
      const m = html.match(new RegExp(`data-testid="${id}"[^>]*>([\\s\\S]*?)</td>`))
      return m ? m[1].replace(/<[^>]+>/g, '').trim() : null
    }
    assert.equal(cella('totale-settimana'), '18 h')
    assert.equal(cella('totale-giorno-2026-09-21'), '6 h')
    assert.equal(cella('totale-giorno-2026-09-22'), '6 h')
    assert.equal(cella('totale-riga-MEC-PL-101'), '13 h')
    assert.include(html, 'value="4"')
  })

  test('navigazione: settimana precedente e successiva', async ({ assert }) => {
    const { b } = await accedi('mec1')
    const html = await (await b.vai(`/ore?settimana=${W39}`)).text()
    assert.include(html, `/ore?settimana=${aggiungiSettimane(W39, -1)}`)
    // Una data qualsiasi porta al lunedì della sua settimana
    const html2 = await (await b.vai('/ore?settimana=2026-09-24')).text()
    assert.include(html2, 'W39 · dal 21/09/2026 al 27/09/2026')
  })

  test('salva una cella: minuti, versione, audit ed evento; il campo non viene sostituito', async ({
    assert,
  }) => {
    const mec1 = await utente('mec1')
    const e = await elaborato('MEC-PL-102')
    const giorno = lunediCorrente()
    await RegistrazioneOre.query().where('utente_id', mec1.id).where('data', giorno).delete()

    const eventi: string[] = []
    const smetti = ascoltaEventi((_c, ev) => eventi.push(ev.tipo))
    const { b, htmx } = await accedi('mec1')
    const r = await b.post(
      '/ore/celle',
      { elaborato_id: String(e.id), data: giorno, ore: '1,5', version: '0' },
      htmx
    )
    smetti()
    assert.equal(r.status, 200)
    const html = await r.text()
    // Solo sostituzioni fuori banda: il campo con il focus resta al suo posto
    assert.notInclude(html, `id="c-${e.id}-${giorno}"`)
    assert.match(html, new RegExp(`id="v-${e.id}-${giorno}"[\\s\\S]*?value="1"`))
    assert.include(html, 'hx-swap-oob')
    assert.include(r.headers.get('hx-trigger') ?? '', 'toast')

    const riga = await RegistrazioneOre.query()
      .where('utente_id', mec1.id)
      .where('elaborato_id', e.id)
      .where('data', giorno)
      .firstOrFail()
    assert.equal(riga.minuti, 90)
    assert.equal(riga.version, 1)
    const voce = await AuditLog.query()
      .where('azione', 'ore.registrate')
      .where('entita_id', String(riga.id))
      .firstOrFail()
    assert.equal(voce.utenteId, mec1.id)
    assert.include(eventi, 'ore.registrate')

    // Modifica con la versione giusta, poi cancellazione con la cella vuota
    const r2 = await b.post(
      '/ore/celle',
      { elaborato_id: String(e.id), data: giorno, ore: '2', version: '1' },
      htmx
    )
    assert.equal(r2.status, 200)
    assert.equal((await RegistrazioneOre.findOrFail(riga.id)).minuti, 120)
    const r3 = await b.post(
      '/ore/celle',
      { elaborato_id: String(e.id), data: giorno, ore: '', version: '2' },
      htmx
    )
    assert.equal(r3.status, 200)
    assert.isNull(await RegistrazioneOre.find(riga.id))
    assert.isNotNull(await AuditLog.query().where('azione', 'ore.cancellate').first())
  })

  test('POST con un utente diverso da sé: 403, anche per l’admin', async ({ assert }) => {
    const mec1 = await utente('mec1')
    const mec2 = await utente('mec2')
    const e = await elaborato('MEC-PL-102')
    const giorno = lunediCorrente()
    const prima = await RegistrazioneOre.query().count('* as n').firstOrFail()

    const { b, htmx } = await accedi('mec1')
    const r = await b.post(
      '/ore/celle',
      {
        elaborato_id: String(e.id),
        data: giorno,
        ore: '3',
        version: '0',
        utente_id: String(mec2.id),
      },
      htmx
    )
    assert.equal(r.status, 403)

    const admin = await accedi('admin')
    const r2 = await admin.b.post(
      '/ore/celle',
      {
        elaborato_id: String(e.id),
        data: giorno,
        ore: '3',
        version: '0',
        utente_id: String(mec1.id),
      },
      admin.htmx
    )
    assert.equal(r2.status, 403)

    const dopo = await RegistrazioneOre.query().count('* as n').firstOrFail()
    assert.equal(dopo.$extras.n, prima.$extras.n)
  })

  test('settimana chiusa: 422 e nessun salvataggio', async ({ assert }) => {
    const mec1 = await utente('mec1')
    const e = await elaborato('MEC-PL-101')
    const giornoChiuso = '2026-07-20'
    const { b, htmx } = await accedi('mec1')
    const esistente = await RegistrazioneOre.query()
      .where('utente_id', mec1.id)
      .where('elaborato_id', e.id)
      .where('data', giornoChiuso)
      .first()
    const r = await b.post(
      '/ore/celle',
      {
        elaborato_id: String(e.id),
        data: giornoChiuso,
        ore: '7',
        version: String(esistente?.version ?? 0),
      },
      htmx
    )
    assert.equal(r.status, 422)
    const html = await r.text()
    assert.include(html, 'La settimana è chiusa')
    assert.include(html, 'data-testid="errore-ore"')
    const dopo = await RegistrazioneOre.query()
      .where('utente_id', mec1.id)
      .where('elaborato_id', e.id)
      .where('data', giornoChiuso)
      .first()
    assert.equal(dopo?.minuti ?? 0, esistente?.minuti ?? 0)

    // La pagina della settimana chiusa mostra i campi disabilitati
    const pagina = await (await b.vai(`/ore?settimana=${giornoChiuso}`)).text()
    assert.include(pagina, 'data-testid="settimana-chiusa"')
  })

  test('giorno futuro e ore non valide: 422', async ({ assert }) => {
    const e = await elaborato('MEC-PL-102')
    const { b, htmx } = await accedi('mec1')
    const r = await b.post(
      '/ore/celle',
      { elaborato_id: String(e.id), data: '2099-01-05', ore: '2', version: '0' },
      htmx
    )
    assert.equal(r.status, 422)
    assert.include(await r.text(), 'giorni futuri')

    const r2 = await b.post(
      '/ore/celle',
      { elaborato_id: String(e.id), data: lunediCorrente(), ore: 'tre', version: '0' },
      htmx
    )
    assert.equal(r2.status, 422)
    assert.include(await r2.text(), 'non è un numero di ore valido')

    const r3 = await b.post(
      '/ore/celle',
      { elaborato_id: String(e.id), data: lunediCorrente(), ore: '25', version: '0' },
      htmx
    )
    assert.equal(r3.status, 422)
  })

  test('oltre il massimo giornaliero: salvato con avviso', async ({ assert }) => {
    const mec1 = await utente('mec1')
    const e = await elaborato('MEC-PL-102')
    const giorno = lunediCorrente()
    await RegistrazioneOre.query().where('utente_id', mec1.id).where('data', giorno).delete()
    const { b, htmx } = await accedi('mec1')
    const r = await b.post(
      '/ore/celle',
      { elaborato_id: String(e.id), data: giorno, ore: '13', version: '0' },
      htmx
    )
    assert.equal(r.status, 200)
    const html = await r.text()
    assert.include(html, 'data-testid="avviso-ore"')
    assert.include(html, 'oltre il massimo di 12 h')
  })

  test('versione superata (altra scheda): 409 con il valore attuale', async ({ assert }) => {
    const mec1 = await utente('mec1')
    const e = await elaborato('MEC-PL-102')
    const giorno = lunediCorrente()
    await RegistrazioneOre.query().where('utente_id', mec1.id).where('data', giorno).delete()
    await RegistrazioneOre.create({
      utenteId: mec1.id,
      elaboratoId: e.id,
      data: giorno,
      minuti: 60,
      version: 1,
    })
    const { b, htmx } = await accedi('mec1')
    const r = await b.post(
      '/ore/celle',
      { elaborato_id: String(e.id), data: giorno, ore: '4', version: '0' },
      htmx
    )
    assert.equal(r.status, 409)
    const html = await r.text()
    assert.include(html, 'data-testid="conflitto"')
    assert.include(html, `id="c-${e.id}-${giorno}"`)
    assert.include(html, 'value="1"')
  })

  test('elaborato di una commessa di cui non si fa parte: 403', async ({ assert }) => {
    const uffici = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const modello = await elaborato('MEC-PL-102')
    const estraneo = await Elaborato.create({
      commessaId: uffici.id,
      codice: 'MEC-TEST-999',
      titolo: 'Elaborato di prova',
      disciplinaId: modello.disciplinaId,
      budgetMinuti: 600,
      classeServizio: 'standard',
      statoId: modello.statoId,
    })
    const { b, htmx } = await accedi('mec1')
    const r = await b.post(
      '/ore/celle',
      { elaborato_id: String(estraneo.id), data: lunediCorrente(), ore: '1', version: '0' },
      htmx
    )
    assert.equal(r.status, 403)
    assert.isNull(await RegistrazioneOre.findBy('elaborato_id', estraneo.id))
  })
})

test.group('Ore · correzione dell’admin', (group) => {
  conTransazione(group)

  test('solo l’admin; motivo obbligatorio; settimana chiusa correggibile con audit', async ({
    assert,
  }) => {
    const mec1 = await utente('mec1')
    const e = await elaborato('MEC-PL-101')
    const giorno = '2026-07-21'
    const esistente = await RegistrazioneOre.query()
      .where('utente_id', mec1.id)
      .where('elaborato_id', e.id)
      .where('data', giorno)
      .first()
    const campi = {
      elaborato_id: String(e.id),
      data: giorno,
      ore: '2,5',
      version: String(esistente?.version ?? 0),
      utente_id: String(mec1.id),
    }

    const pm = await accedi('pm1')
    assert.equal((await pm.b.vai(`/ore/correzione?utente=${mec1.id}`)).status, 403)
    assert.equal((await pm.b.post('/ore/correzione/celle', campi, pm.htmx)).status, 403)

    const admin = await accedi('admin', `/ore/correzione?utente=${mec1.id}&settimana=2026-07-20`)
    const senzaMotivo = await admin.b.post('/ore/correzione/celle', campi, admin.htmx)
    assert.equal(senzaMotivo.status, 422)

    const ok = await admin.b.post(
      '/ore/correzione/celle',
      { ...campi, motivo: 'Ore segnate sull’elaborato sbagliato' },
      admin.htmx
    )
    assert.equal(ok.status, 200)
    const riga = await RegistrazioneOre.query()
      .where('utente_id', mec1.id)
      .where('elaborato_id', e.id)
      .where('data', giorno)
      .firstOrFail()
    assert.equal(riga.minuti, 150)
    const voci = await AuditLog.query().whereIn('azione', [
      'ore.corrette_da_admin',
      'ore.correzione_motivo',
    ])
    assert.isAbove(voci.length, 0)
    const admin1 = await utente('admin')
    assert.isTrue(voci.every((v) => v.utenteId === admin1.id))
    assert.isTrue(
      voci.some((v) => JSON.stringify(v.datiDopo).includes('Ore segnate sull’elaborato sbagliato'))
    )
  })
})

test.group('Ore · vista della commessa', (group) => {
  conTransazione(group)

  async function pagina(slug: string) {
    const c = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const b = new Browser()
    await b.loginSviluppo(slug)
    const r = await b.vai(`/commesse/${c.id}/ore?settimana=${W39}`)
    return { status: r.status, html: await r.text() }
  }

  test('PM: totali per elaborato e ore per persona (attive di default)', async ({ assert }) => {
    const { status, html } = await pagina('pm1')
    assert.equal(status, 200)
    assert.include(html, 'data-testid="ore-per-elaborato"')
    assert.match(html, /data-testid="totale-settimana"><b>29 h<\/b>/)
    assert.match(html, /data-testid="totale-commessa"><b>320 h<\/b>/)
    assert.include(html, 'data-testid="ore-per-persona"')
    assert.include(html, 'Progettista MEC 1')
    assert.include(html, 'in ordine alfabetico')
  })

  test('ore per persona disattivate: il PM vede solo i totali', async ({ assert }) => {
    const imp = await Impostazione.findByOrFail('chiave', 'ore.per_persona_visibili')
    imp.valore = false
    await imp.save()
    const { status, html } = await pagina('pm1')
    assert.equal(status, 200)
    assert.include(html, 'data-testid="ore-per-elaborato"')
    assert.notInclude(html, 'data-testid="ore-per-persona"')
    assert.notInclude(html, 'Progettista MEC 1')
    assert.include(html, 'data-testid="per-persona-spente"')
  })

  test('direzione: vede i totali ma mai le ore per persona', async ({ assert }) => {
    const { status, html } = await pagina('direzione')
    assert.equal(status, 200)
    assert.include(html, 'data-testid="ore-per-elaborato"')
    assert.notInclude(html, 'data-testid="ore-per-persona"')
    assert.notInclude(html, 'Progettista MEC 1')
  })

  test('progettista membro: totali sì, per persona no; non membro: 403', async ({ assert }) => {
    const membro = await pagina('mec1')
    assert.equal(membro.status, 200)
    assert.notInclude(membro.html, 'data-testid="ore-per-persona"')

    const uffici = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const b = new Browser()
    await b.loginSviluppo('mec1')
    assert.equal((await b.get(`/commesse/${uffici.id}/ore`)).status, 403)
  })

  test('PM osservatore di un’altra commessa (pm2 su CL-2026-031): niente ore per persona', async ({
    assert,
  }) => {
    const { status, html } = await pagina('pm2')
    assert.equal(status, 200)
    assert.notInclude(html, 'data-testid="ore-per-persona"')
  })
})
