/**
 * Art. 4 Statuto dei lavoratori: nessuna classifica, nessun KPI e nessun
 * ordinamento per persona. Solo dati per commessa o per team.
 *
 * Due controlli:
 * 1. statico, sul codice dei moduli che mostrano dati aggregati (portafoglio,
 *    Obeya, ore, home): niente vocabolario da classifica, niente ordinamenti
 *    per persona nei template, e le query raggruppate per persona si ordinano
 *    solo per nome;
 * 2. dinamico, sulle pagine: ore per persona in ordine alfabetico e solo per chi
 *    può vederle (mai la direzione), nessuna classifica nell'HTML.
 */
import { test } from '@japa/runner'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import app from '@adonisjs/core/services/app'
import Commessa from '#models/commessa'
import { Browser } from '#tests/helpers/browser'
import { conTransazione } from '#tests/helpers/db'

/** Moduli con viste aggregate da controllare (codice e template) */
const MODULI = ['portafoglio', 'obeya', 'ore', 'home']

/** Parole da classifica o da valutazione individuale */
const VOCABOLARIO =
  /classific|ranking|graduatori|leaderboard|\btop[ -]?\d|migliori\b|peggiori\b|produttivit|performance (individual|per persona)|pi[uù] (bravo|veloce|lento)/i

/** Frasi che negano (es. "nessuna classifica per persona"): si tolgono prima del controllo */
const NEGAZIONI =
  /\b(nessuna|nessun|niente|senza|mai|non|vietat[aei])\s+(\S+\s+){0,2}?(classific|ranking|graduatori|produttivit)\w*/gi

/** Ordinamenti per persona richiesti dall'utente (parametri o intestazioni cliccabili) */
const ORDINA_PER_PERSONA =
  /(ordina|ordine|ordinamento|sort|order)[^\n]{0,40}?(utente|persona|responsabile|last_?planner|progettista|autore)/i

/** Colonne che identificano una persona in un GROUP BY */
const COLONNA_PERSONA = /\b(u\.id|utenti\.id|utente_id|responsabile_id|last_planner_id|autore_id)\b/

/** In una query raggruppata per persona si ordina solo per nome (alfabetico) */
const ORDINE_AMMESSO = /^['"`]([a-z_]+\.)?(nome|email)['"`](\s*,\s*['"`]asc['"`])?$/

function file(cartella: string, estensioni: string[]): string[] {
  let elenco: string[] = []
  let voci: string[]
  try {
    voci = readdirSync(cartella)
  } catch {
    return []
  }
  for (const voce of voci) {
    const percorso = join(cartella, voce)
    if (statSync(percorso).isDirectory()) elenco = elenco.concat(file(percorso, estensioni))
    else if (estensioni.some((e) => voce.endsWith(e))) elenco.push(percorso)
  }
  return elenco
}

function senzaCommenti(testo: string, edge: boolean) {
  if (edge) return testo.replace(/\{\{--[\s\S]*?--\}\}/g, '')
  return testo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function sorgenti() {
  const radice = app.makePath()
  const elenco: { nome: string; testo: string; edge: boolean }[] = []
  for (const m of MODULI) {
    for (const f of file(app.makePath('app/modules', m), ['.ts'])) {
      elenco.push({ nome: relative(radice, f), testo: readFileSync(f, 'utf8'), edge: false })
    }
    for (const f of file(app.makePath('resources/views/modules', m), ['.edge'])) {
      elenco.push({ nome: relative(radice, f), testo: readFileSync(f, 'utf8'), edge: true })
    }
  }
  return elenco
}

/** Testo visibile (grezzo) di una pagina HTML */
function testoVisibile(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

test.group('Art. 4 · codice dei moduli aggregati', () => {
  test('i moduli controllati esistono (il test non gira a vuoto)', ({ assert }) => {
    const nomi = sorgenti().map((s) => s.nome)
    for (const m of MODULI) {
      assert.isTrue(
        nomi.some((n) => n.includes(`/${m}/`)),
        `nessun file trovato per il modulo ${m}`
      )
    }
  })

  test('nessun vocabolario da classifica nel codice e nei template', ({ assert }) => {
    const trovati: string[] = []
    for (const s of sorgenti()) {
      const testo = senzaCommenti(s.testo, s.edge).replace(NEGAZIONI, '')
      const m = testo.match(VOCABOLARIO)
      if (m) trovati.push(`${s.nome}: "${m[0]}"`)
    }
    assert.deepEqual(trovati, [])
  })

  test('nessun ordinamento per persona nei template', ({ assert }) => {
    const trovati: string[] = []
    for (const s of sorgenti().filter((x) => x.edge)) {
      const m = senzaCommenti(s.testo, true).match(ORDINA_PER_PERSONA)
      if (m) trovati.push(`${s.nome}: "${m[0]}"`)
    }
    assert.deepEqual(trovati, [])
  })

  test('le query raggruppate per persona si ordinano solo per nome', ({ assert }) => {
    const trovati: string[] = []
    for (const s of sorgenti().filter((x) => !x.edge)) {
      const testo = senzaCommenti(s.testo, false)
      // Ogni catena di query finisce al primo "await", "return" o riga vuota
      const blocchi = testo.split(/\n\s*\n|(?=\bawait\b)|(?=\breturn\b)/)
      for (const b of blocchi) {
        const gruppo = b.match(/\.groupBy(Raw)?\(([^)]*)\)/)
        if (!gruppo || !COLONNA_PERSONA.test(gruppo[2])) continue
        if (/\.orderByRaw\(/.test(b)) {
          trovati.push(`${s.nome}: orderByRaw in una query raggruppata per persona`)
        }
        for (const o of b.matchAll(/\.orderBy\(([^)]*)\)/g)) {
          if (!ORDINE_AMMESSO.test(o[1].trim())) {
            trovati.push(`${s.nome}: orderBy(${o[1].trim()}) in una query raggruppata per persona`)
          }
        }
      }
    }
    assert.deepEqual(trovati, [])
  })
})

test.group('Art. 4 · pagine', (group) => {
  conTransazione(group)

  test('portafoglio, Obeya e ore: nessuna classifica, per nessun ruolo', async ({ assert }) => {
    const scuola = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const trovati: string[] = []
    for (const come of ['admin', 'direzione', 'pm1', 'mec1']) {
      const b = new Browser()
      await b.loginSviluppo(come)
      for (const pagina of [
        '/',
        '/portafoglio',
        '/ore',
        `/commesse/${scuola.id}`,
        `/commesse/${scuola.id}/ore`,
      ]) {
        const r = await b.get(pagina)
        if (r.status !== 200) {
          await r.arrayBuffer()
          continue
        }
        const testo = testoVisibile(await r.text()).replace(NEGAZIONI, '')
        const m = testo.match(VOCABOLARIO)
        if (m) trovati.push(`${pagina} come ${come}: "${m[0]}"`)
      }
    }
    assert.deepEqual(trovati, [])
  })

  test('parametri di ordinamento per persona ignorati: le pagine non cambiano', async ({
    assert,
  }) => {
    const scuola = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const b = new Browser()
    await b.loginSviluppo('pm1')
    for (const pagina of ['/portafoglio', `/commesse/${scuola.id}/ore`]) {
      const base = await (await b.get(pagina)).text()
      const sep = pagina.includes('?') ? '&' : '?'
      const ordinata = await (
        await b.get(`${pagina}${sep}ordina=ore&ordine=desc&sort=persona`)
      ).text()
      const tabella = (html: string) => (html.match(/<table[\s\S]*?<\/table>/g) ?? []).join('\n')
      assert.equal(tabella(ordinata), tabella(base), pagina)
    }
  })

  test('ore per persona della commessa: in ordine alfabetico, mai per la direzione', async ({
    assert,
  }) => {
    const scuola = await Commessa.findByOrFail('codice', 'CL-2026-031')
    const pm = new Browser()
    await pm.loginSviluppo('pm1')
    const html = await (await pm.get(`/commesse/${scuola.id}/ore`)).text()
    const tabella = html.match(/<table data-testid="ore-per-persona">([\s\S]*?)<\/table>/)
    assert.isNotNull(tabella, 'il PM vede le ore per persona')
    const corpo = tabella![1].split('<tbody>')[1] ?? ''
    const nomi = [...corpo.matchAll(/<tr>\s*<td>([^<]+)<\/td>/g)].map((m) => m[1].trim())
    const alfabetico = [...nomi].sort((a, b) => a.localeCompare(b, 'it'))
    assert.deepEqual(nomi, alfabetico)

    const direzione = new Browser()
    await direzione.loginSviluppo('direzione')
    const r = await direzione.get(`/commesse/${scuola.id}/ore`)
    assert.equal(r.status, 200)
    assert.notInclude(await r.text(), 'data-testid="ore-per-persona"')
  })
})
