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
  ESCLUSE,
  GET_CON_REDIREZIONE_AMMESSA,
  MATRICE,
  RUOLI,
  UTENTE_PER_RUOLO,
  type Esito,
  type Ruolo,
} from './matrice_attesa.js'

// Rotte del modulo audit: finché start/routes.ts non le importa, le registra il
// test prima che il server di test chiuda il router (import idempotente).
import '#modules/audit/routes'

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
