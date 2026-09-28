/**
 * Import degli elaborati incollati da Excel o da un file CSV.
 *
 * Formato di ogni riga: codice ; titolo ; disciplina ; budget ore
 * - separatore: tabulazione (copia da Excel) oppure punto e virgola (CSV italiano);
 * - disciplina: codice (MEC) o nome (Impianti meccanici), maiuscole indifferenti;
 * - budget in ore, anche con la virgola ("12,5"); si salva in minuti.
 * Una prima riga d'intestazione ("codice; titolo; …") viene ignorata.
 *
 * Funzione pura (niente DB): riceve discipline e codici già presenti.
 */
import type { Minuti } from '#domain/types'
import { numeroItaliano, ORE_MASSIME_BUDGET } from './validazione.js'

export interface DisciplinaImport {
  id: number
  codice: string
  nome: string
  attiva: boolean
}

export interface RigaImport {
  /** Numero di riga nel testo incollato (da 1) */
  numero: number
  testo: string
  codice: string
  titolo: string
  disciplinaId: number | null
  disciplina: string
  budgetMinuti: Minuti | null
  errori: string[]
}

export interface EsitoImport {
  righe: RigaImport[]
  valide: RigaImport[]
  errate: RigaImport[]
}

export const RIGHE_MASSIME_IMPORT = 500
const MAX_CODICE = 40
const MAX_TITOLO = 300

function dividi(riga: string): string[] {
  const separatore = riga.includes('\t') ? '\t' : ';'
  return riga.split(separatore).map((c) =>
    c
      .trim()
      .replace(/^"(.*)"$/s, '$1')
      .trim()
  )
}

function eIntestazione(celle: string[]) {
  const prima = (celle[0] ?? '').toLowerCase()
  const ultima = (celle[3] ?? '').toLowerCase()
  return prima === 'codice' || (prima.startsWith('cod') && ultima.includes('ore'))
}

/**
 * Analizza il testo incollato. Non scrive nulla: restituisce le righe con gli
 * eventuali errori in italiano, da mostrare nell'anteprima.
 */
export function analizzaImport(
  testo: string,
  discipline: readonly DisciplinaImport[],
  codiciEsistenti: ReadonlySet<string>
): EsitoImport {
  const perChiave = new Map<string, DisciplinaImport>()
  for (const d of discipline) {
    perChiave.set(d.codice.toLowerCase(), d)
    perChiave.set(d.nome.toLowerCase(), d)
  }
  const esistenti = new Set([...codiciEsistenti].map((c) => c.toUpperCase()))
  const visti = new Map<string, number>()

  const righe: RigaImport[] = []
  const linee = testo.replace(/\r\n?/g, '\n').split('\n')
  linee.forEach((linea, i) => {
    if (linea.trim() === '') return
    const celle = dividi(linea)
    if (righe.length === 0 && eIntestazione(celle)) return

    const [codice = '', titolo = '', disciplina = '', budget = ''] = celle
    const errori: string[] = []
    if (celle.length < 4) {
      errori.push('servono 4 colonne: codice; titolo; disciplina; budget ore')
    }
    if (celle.length > 4 && celle.slice(4).some((c) => c !== '')) {
      errori.push('troppe colonne: servono solo codice; titolo; disciplina; budget ore')
    }

    if (codice === '') errori.push('manca il codice')
    else if (codice.length > MAX_CODICE) errori.push(`codice oltre ${MAX_CODICE} caratteri`)
    else {
      const chiave = codice.toUpperCase()
      if (esistenti.has(chiave)) errori.push(`il codice ${codice} esiste già nella commessa`)
      const precedente = visti.get(chiave)
      if (precedente !== undefined) {
        errori.push(`codice ${codice} ripetuto (già alla riga ${precedente})`)
      } else {
        visti.set(chiave, i + 1)
      }
    }

    if (titolo === '') errori.push('manca il titolo')
    else if (titolo.length > MAX_TITOLO) errori.push(`titolo oltre ${MAX_TITOLO} caratteri`)

    let disciplinaId: number | null = null
    if (disciplina === '') errori.push('manca la disciplina')
    else {
      const d = perChiave.get(disciplina.toLowerCase())
      if (!d) errori.push(`disciplina "${disciplina}" sconosciuta`)
      else if (!d.attiva) errori.push(`disciplina "${disciplina}" non più attiva`)
      else disciplinaId = d.id
    }

    let budgetMinuti: Minuti | null = null
    if (budget === '') errori.push('manca il budget in ore')
    else {
      const ore = numeroItaliano(budget)
      if (ore === null) errori.push(`budget "${budget}" non è un numero di ore`)
      else if (ore < 0) errori.push('il budget non può essere negativo')
      else if (ore > ORE_MASSIME_BUDGET) errori.push('budget troppo alto')
      else budgetMinuti = Math.round(ore * 60)
    }

    righe.push({
      numero: i + 1,
      testo: linea,
      codice,
      titolo,
      disciplinaId,
      disciplina,
      budgetMinuti,
      errori,
    })
  })

  if (righe.length > RIGHE_MASSIME_IMPORT) {
    for (const r of righe.slice(RIGHE_MASSIME_IMPORT)) {
      r.errori.push(`al massimo ${RIGHE_MASSIME_IMPORT} righe per import`)
    }
  }

  return {
    righe,
    valide: righe.filter((r) => r.errori.length === 0),
    errate: righe.filter((r) => r.errori.length > 0),
  }
}
