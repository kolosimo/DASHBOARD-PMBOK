/**
 * Matrice "rotte × ruoli": per ogni rotta registrata nel router di Adonis e per
 * ogni ruolo della matrice attesa (matrice_attesa.ts) si verifica l'esito HTTP.
 *
 * Ogni rotta è un test a sé, in una transazione annullata alla fine: le
 * richieste POST dei ruoli autorizzati (con corpo vuoto) non lasciano tracce.
 * I ruoli si provano dal meno al più autorizzato, così le eventuali modifiche
 * di un ruolo autorizzato non cambiano l'esito dei ruoli che devono essere negati.
 */
import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import Utente from '#models/utente'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'
import {
  CORPI_DI_PROVA,
  FIGLI_NON_CONTROLLATI,
  ESCLUSE,
  GET_CON_REDIREZIONE_AMMESSA,
  MATRICE,
  RUOLI,
  UTENTE_PER_RUOLO,
  type Esito,
  type Ruolo,
} from './matrice_attesa.js'

interface RottaRegistrata {
  nome: string
  metodo: 'GET' | 'POST'
  pattern: string
}

/** Rotte registrate nel router (dominio principale), una per nome */
function rotteRegistrate(): RottaRegistrata[] {
  const elenco: RottaRegistrata[] = []
  for (const rotte of Object.values(router.toJSON())) {
    for (const r of rotte) {
      const metodo = r.methods.includes('POST') ? 'POST' : 'GET'
      elenco.push({ nome: r.name ?? `${metodo} ${r.pattern}`, metodo, pattern: r.pattern })
    }
  }
  return elenco
}

/** Identificativi reali della commessa di esempio per i parametri delle rotte */
async function parametri(): Promise<Record<string, string>> {
  const scuola = await Commessa.findByOrFail('codice', 'CL-2026-031')
  const ele2 = await Utente.findByOrFail('email', 'ele2@climosfera.example')
  const mec1 = await Utente.findByOrFail('email', 'mec1@climosfera.example')
  const primo = async (tabella: string, filtro: Record<string, unknown> = {}) => {
    const r = await db.from(tabella).where(filtro).orderBy('id').first()
    if (!r) throw new Error(`nessuna riga in ${tabella}`)
    return String(r.id)
  }
  const piano = await db
    .from('piani_settimanali')
    .where('commessa_id', scuola.id)
    .orderBy('settimana', 'desc')
    .first()
  const impegno = await db
    .from('impegni')
    .join('piani_settimanali', 'piani_settimanali.id', 'impegni.piano_id')
    .where('piani_settimanali.commessa_id', scuola.id)
    .where((q) =>
      q.whereNot('impegni.last_planner_id', mec1.id).orWhereNull('impegni.last_planner_id')
    )
    .orderBy('impegni.id')
    .select('impegni.id')
    .first()
  return {
    id: String(scuola.id),
    colonnaId: await primo('colonne_kanban'),
    membroId: await primo('membri_commessa', { commessa_id: scuola.id, utente_id: ele2.id }),
    milestoneId: await primo('milestone', { commessa_id: scuola.id }),
    elaboratoId: await primo('elaborati', { commessa_id: scuola.id }),
    pianoId: String(piano.id),
    impegnoId: String(impegno.id),
    attivitaId: await primo('attivita_lookahead', { commessa_id: scuola.id }),
    vincoloId: await primo('vincoli', { commessa_id: scuola.id }),
    azione: 'riapri',
    baselineId: await primo('baseline', { commessa_id: scuola.id }),
    tipo: 'discipline',
    voceId: await primo('discipline'),
    statoId: await primo('stati_elaborato'),
    utenteId: String(ele2.id),
  }
}

function riempi(pattern: string, p: Record<string, string>) {
  return pattern.replace(/:([A-Za-z]+)/g, (_, nome: string) => {
    if (!(nome in p)) throw new Error(`parametro senza valore di prova: ${nome} in ${pattern}`)
    return p[nome]
  })
}

/** Utente "esterno": progettista che non è membro di nessuna commessa */
async function creaEsterno() {
  await Utente.create({
    email: `${UTENTE_PER_RUOLO.esterno}@climosfera.example`,
    nome: 'Progettista esterno (test)',
    ruolo: 'progettista',
    attivo: true,
  })
}

/** Browser collegato come il ruolo, con il token CSRF della sessione */
async function browserPer(ruolo: Ruolo) {
  const b = new Browser()
  if (ruolo === 'anonimo') {
    const html = await (await b.get('/accesso')).text()
    return { b, csrf: Browser.csrfDa(html) }
  }
  await b.loginSviluppo(UTENTE_PER_RUOLO[ruolo])
  const html = await (await b.get('/ore')).text()
  return { b, csrf: Browser.csrfDa(html) }
}

function descrivi(atteso: Esito) {
  return typeof atteso === 'number' ? String(atteso) : atteso
}

/** Esito conforme all'atteso? */
function conforme(rotta: RottaRegistrata, atteso: Esito, stato: number, dove: string) {
  const alLogin = stato === 302 && dove.startsWith('/accesso')
  if (typeof atteso === 'number') return stato === atteso
  if (atteso === 'negato') return stato === 403
  if (atteso === 'accesso') return alLogin
  if (atteso === 'home') return stato === 302 && !alLogin
  if (rotta.metodo === 'GET') {
    return (
      stato === 200 || (GET_CON_REDIREZIONE_AMMESSA.has(rotta.nome) && stato === 302 && !alLogin)
    )
  }
  return stato !== 401 && stato !== 403 && stato < 500 && !alLogin
}

/** Descrizione dello scostamento, oppure null se l'esito è quello atteso */
async function scostamento(rotta: RottaRegistrata, ruolo: Ruolo, atteso: Esito, r: Response) {
  const dove = r.headers.get('location') ?? ''
  // Consuma il corpo per liberare la connessione
  await r.arrayBuffer()
  if (conforme(rotta, atteso, r.status, dove)) return null
  return `${ruolo}: atteso ${descrivi(atteso)}, ottenuto ${r.status}${dove ? ` → ${dove}` : ''}`
}

/** Rotta registrata con quel nome */
function rottaPerNome(nome: string): RottaRegistrata {
  const r = rotteRegistrate().find((x) => x.nome === nome)
  if (!r) throw new Error(`rotta non registrata: ${nome}`)
  return r
}

test.group('Permessi · elenco delle rotte', () => {
  test('ogni rotta registrata ha una riga nella matrice attesa o un motivo di esclusione', ({
    assert,
  }) => {
    const nomi = rotteRegistrate().map((r) => r.nome)
    const senzaRiga = nomi.filter((n) => !(n in MATRICE) && !(n in ESCLUSE))
    assert.deepEqual(senzaRiga, [], 'rotte senza permessi attesi: aggiungerle a matrice_attesa.ts')
    const sparite = [...Object.keys(MATRICE), ...Object.keys(ESCLUSE)].filter(
      (n) => !nomi.includes(n)
    )
    assert.deepEqual(sparite, [], 'righe della matrice per rotte che non esistono più')
    const duplicate = nomi.filter((n, i) => nomi.indexOf(n) !== i)
    assert.deepEqual(duplicate, [], 'nomi di rotta duplicati')
  })
})

test.group('Permessi · matrice rotte × ruoli', (group) => {
  conTransazione(group)

  // I test nascono dalla matrice (il router è completo solo all'avvio del server);
  // il gruppo precedente garantisce che matrice e router coincidano.
  for (const [nome, attesa] of Object.entries(MATRICE)) {
    test(nome, async ({ assert }) => {
      const rotta = rottaPerNome(nome)
      await creaEsterno()
      const p = await parametri()
      const url = riempi(rotta.pattern, p)
      const corpo = CORPI_DI_PROVA[nome]?.(p) ?? {}
      const richiedi = (b: Browser, csrf: string, indirizzo: string) =>
        rotta.metodo === 'GET'
          ? b.get(indirizzo)
          : b.post(indirizzo, corpo, { 'x-csrf-token': csrf })

      const scostamenti: string[] = []
      for (const ruolo of RUOLI) {
        const { b, csrf } = await browserPer(ruolo)
        const s = await scostamento(rotta, ruolo, attesa[ruolo], await richiedi(b, csrf, url))
        if (s) scostamenti.push(s)
      }

      // Commessa inesistente: 404 anche per l'admin
      if (rotta.pattern.startsWith('/commesse/:id')) {
        const { b, csrf } = await browserPer('admin')
        const assente = riempi(rotta.pattern, { ...p, id: '999999' })
        const s = await scostamento(rotta, 'admin', 404, await richiedi(b, csrf, assente))
        if (s) scostamenti.push(`commessa inesistente, ${s}`)
      }
      assert.deepEqual(scostamenti, [], `${rotta.metodo} ${rotta.pattern} (${nome})`)
    })
  }
})

test.group('Permessi · dati di altre commesse', (group) => {
  conTransazione(group)

  test('il PM di una commessa non tocca team e milestone di un’altra passando dalla propria', async ({
    assert,
  }) => {
    const scuola = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const uffici = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const milestone = await db.from('milestone').where('commessa_id', uffici.id).first()
    const membro = await db.from('membri_commessa').where('commessa_id', uffici.id).first()
    const { b, csrf } = await browserPer('pm')
    for (const url of [
      `/commesse/${scuola.id}/milestone/${milestone.id}`,
      `/commesse/${scuola.id}/milestone/${milestone.id}/elimina`,
      `/commesse/${scuola.id}/team/${membro.id}`,
      `/commesse/${scuola.id}/team/${membro.id}/rimuovi`,
    ]) {
      const r = await b.post(url, {}, { 'x-csrf-token': csrf })
      assert.equal(r.status, 404, url)
      await r.arrayBuffer()
    }
    assert.isNotNull(await db.from('milestone').where('id', milestone.id).first())
    assert.isNotNull(await db.from('membri_commessa').where('id', membro.id).first())
  })

  test('ogni rotta con un dato figlio risponde 404 se il dato è di un’altra commessa, anche all’admin', async ({
    assert,
  }) => {
    const uffici = await Commessa.findByOrFail('codice', 'CL-2026-018')
    const p = await parametri()
    // Si spostano nella commessa "uffici" i dati usati come parametro: passando
    // dalla commessa "scuola" non devono più essere raggiungibili.
    const tabelle: Record<string, string> = {
      elaboratoId: 'elaborati',
      milestoneId: 'milestone',
      attivitaId: 'attivita_lookahead',
      vincoloId: 'vincoli',
      pianoId: 'piani_settimanali',
      baselineId: 'baseline',
    }
    for (const [param, tabella] of Object.entries(tabelle)) {
      await db.from(tabella).where('id', p[param]).update({ commessa_id: uffici.id })
    }
    const impegno = await db.from('impegni').where('id', p.impegnoId).first()
    await db
      .from('piani_settimanali')
      .where('id', impegno.piano_id)
      .update({ commessa_id: uffici.id })

    const tabellePerParametro: Record<string, string> = { ...tabelle, impegnoId: 'impegni' }
    const fotografia = async () => {
      const righe: Record<string, unknown> = {}
      for (const [param, tabella] of Object.entries(tabellePerParametro)) {
        righe[param] = await db.from(tabella).where('id', p[param]).first()
      }
      return JSON.stringify(righe)
    }
    const prima = await fotografia()

    const { b, csrf } = await browserPer('admin')
    const scostamenti: string[] = []
    for (const rotta of rotteRegistrate()) {
      if (!rotta.pattern.startsWith('/commesse/:id')) continue
      const figlio = Object.keys(tabellePerParametro).findLast((f) =>
        rotta.pattern.includes(`:${f}`)
      )
      if (!figlio || FIGLI_NON_CONTROLLATI[rotta.nome]) continue
      const url = riempi(rotta.pattern, p)
      let r: Response
      if (rotta.metodo === 'GET') {
        r = await b.get(url)
      } else {
        // Corpo con la versione giusta: la richiesta arriva fino alla ricerca del dato
        const riga = await db.from(tabellePerParametro[figlio]).where('id', p[figlio]).first()
        r = await b.post(url, { version: String(riga?.version ?? 1) }, { 'x-csrf-token': csrf })
      }
      await r.arrayBuffer()
      // GET: 404. POST: 404 oppure un errore gestito (redirezione con messaggio,
      // 409, 422), purché il dato dell'altra commessa resti com'era.
      const ok =
        r.status === 404 ||
        (rotta.metodo === 'POST' && r.status >= 300 && r.status < 500 && r.status !== 403)
      const intatto = (await fotografia()) === prima
      if (!ok || !intatto) {
        scostamenti.push(
          `${rotta.metodo} ${rotta.pattern}: ${r.status}${intatto ? '' : ', dato modificato'}`
        )
      }
    }
    assert.deepEqual(scostamenti, [])
  })

  test('ore: nessuno registra per un altro, nemmeno l’admin', async ({ assert }) => {
    const mec1 = await Utente.findByOrFail('email', 'mec1@climosfera.example')
    for (const ruolo of ['admin', 'pm', 'direzione'] as const) {
      const { b, csrf } = await browserPer(ruolo)
      const r = await b.post('/ore/celle', { utente_id: String(mec1.id) }, { 'x-csrf-token': csrf })
      assert.equal(r.status, 403, ruolo)
      await r.arrayBuffer()
    }
  })
})

test.group('Permessi · rotte escluse dalla matrice', (group) => {
  conTransazione(group)

  test('logout: autenticati sì, anonimi al login', async ({ assert }) => {
    const anonimo = await browserPer('anonimo')
    const r = await anonimo.b.post('/auth/logout', {}, { 'x-csrf-token': anonimo.csrf })
    assert.equal(r.status, 302)
    assert.isTrue((r.headers.get('location') ?? '').startsWith('/accesso'))
    const pm = await browserPer('pm')
    const u = await pm.b.post('/auth/logout', {}, { 'x-csrf-token': pm.csrf })
    assert.equal(u.status, 302)
    assert.equal((await pm.b.get('/')).status, 302)
  })

  test('Transmit: anonimi respinti, canale della commessa solo a chi la vede', async ({
    assert,
  }) => {
    const scuola = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const anonimo = await browserPer('anonimo')
    const r = await anonimo.b.get('/__transmit/events?uid=anonimo-b3')
    assert.equal(r.status, 302)
    await r.arrayBuffer()

    await creaEsterno()
    for (const [ruolo, atteso] of [
      ['esterno', 400],
      ['osservatore', 204],
      ['direzione', 204],
    ] as const) {
      const { b, csrf } = await browserPer(ruolo)
      const uid = `b3-${ruolo}-${Date.now()}`
      const stop = new AbortController()
      const flusso = await fetch(b.url(`/__transmit/events?uid=${uid}`), {
        headers: { cookie: [...b.cookie].map(([k, v]) => `${k}=${v}`).join('; ') },
        signal: stop.signal,
      })
      assert.equal(flusso.status, 200, `stream ${ruolo}`)
      const s = await b.post(
        '/__transmit/subscribe',
        { uid, channel: `commesse/${scuola.id}` },
        { 'x-csrf-token': csrf }
      )
      assert.equal(s.status, atteso, `iscrizione ${ruolo}`)
      await s.arrayBuffer()
      stop.abort()
      await flusso.body?.cancel().catch(() => {})
    }
  })
})
