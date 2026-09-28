/**
 * Curva S in SVG: funzione pura (nessun accesso al DB), usata dalla vista EVM.
 * Le serie arrivano da serieCurvaS: storia dagli snapshot, settimana corrente
 * dal calcolo live. I punti con EV/AC null (settimane senza snapshot o future)
 * non si disegnano e non si ricostruiscono.
 */
import type { Lunedi, Minuti } from '#domain/types'
import { etichettaSettimana } from '#shared/calendario'
import { numero } from '#ui/formato'

export interface PuntoGrafico {
  settimana: Lunedi
  pvMinuti: Minuti
  evMinuti: Minuti | null
  acMinuti: Minuti | null
  daSnapshot: boolean
  rettificato?: boolean
}

export interface OpzioniCurvaS {
  bacMinuti: Minuti
  eacMinuti: Minuti | null
  settimanaCorrente: Lunedi
  larghezza?: number
  altezza?: number
}

/** Passo "tondo" per la griglia (in ore) */
function passoGriglia(massimo: number): number {
  const grezzo = massimo / 5
  if (grezzo <= 0) return 10
  const esponente = Math.pow(10, Math.floor(Math.log10(grezzo)))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (grezzo <= m * esponente) return m * esponente
  }
  return 10 * esponente
}

function f1(x: number) {
  return x.toFixed(1)
}

/**
 * SVG della curva S (valori in ore). Restituisce markup pronto da inserire;
 * i testi sono solo etichette generate qui (nessun dato dell'utente).
 */
export function svgCurvaS(punti: readonly PuntoGrafico[], opzioni: OpzioniCurvaS): string {
  const W = opzioni.larghezza ?? 1100
  const H = opzioni.altezza ?? 280
  const L = 52
  const R = 16
  const T = 14
  const B = 28
  const n = punti.length
  if (n === 0) {
    return `<svg viewBox="0 0 ${W} 60" width="100%" role="img" aria-label="Curva S non disponibile"><text x="${W / 2}" y="34" text-anchor="middle">Nessun dato: approva una baseline per vedere la curva S.</text></svg>`
  }

  const ore = (m: number) => m / 60
  const bac = ore(opzioni.bacMinuti)
  const eac = opzioni.eacMinuti === null ? null : ore(opzioni.eacMinuti)
  let massimo = bac
  for (const p of punti) {
    massimo = Math.max(massimo, ore(p.pvMinuti), ore(p.evMinuti ?? 0), ore(p.acMinuti ?? 0))
  }
  // L'EAC allarga la scala solo se non schiaccia la curva
  if (eac !== null && eac <= Math.max(bac, 1) * 1.5) massimo = Math.max(massimo, eac)
  if (massimo <= 0) massimo = 10
  const passo = passoGriglia(massimo)
  const ymax = Math.ceil(massimo / passo) * passo

  const x = (i: number) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1))
  const y = (v: number) => T + (H - T - B) * (1 - Math.min(v, ymax) / ymax)

  const percorso = (valori: (number | null)[]) => {
    let d = ''
    let primo = true
    valori.forEach((v, i) => {
      if (v === null) return
      d += `${primo ? 'M' : 'L'}${f1(x(i))},${f1(y(v))}`
      primo = false
    })
    return d
  }

  let griglia = ''
  for (let v = 0; v <= ymax + 1e-9; v += passo) {
    griglia += `<line class="gl" x1="${L}" x2="${W - R}" y1="${f1(y(v))}" y2="${f1(y(v))}"/>`
    griglia += `<text x="${L - 6}" y="${f1(y(v) + 4)}" text-anchor="end">${numero(v)}</text>`
  }

  const ogniQuante = Math.max(1, Math.ceil(n / 14))
  let etichette = ''
  punti.forEach((p, i) => {
    if (i % ogniQuante === 0 || i === n - 1) {
      etichette += `<text x="${f1(x(i))}" y="${H - 8}" text-anchor="middle">${etichettaSettimana(p.settimana)}</text>`
    }
  })

  const iOggi = punti.findIndex((p) => p.settimana === opzioni.settimanaCorrente)
  let oggi = ''
  if (iOggi >= 0) {
    oggi = `<line x1="${f1(x(iOggi))}" x2="${f1(x(iOggi))}" y1="${T}" y2="${H - B}" stroke="var(--ink-3)" stroke-dasharray="3 3"/><text x="${f1(x(iOggi) + 4)}" y="${T + 10}" style="fill:var(--ink-2)">oggi</text>`
  }

  let lineaEac = ''
  if (eac !== null && eac <= ymax) {
    const ye = f1(y(eac))
    const xf = x(n - 1)
    lineaEac = `<line x1="${f1(xf - 40)}" x2="${f1(xf)}" y1="${ye}" y2="${ye}" stroke="var(--ac)" stroke-dasharray="4 3"/><text x="${f1(xf - 44)}" y="${f1(y(eac) - 5)}" text-anchor="end" style="fill:var(--ac)">EAC ${numero(eac)} h</text>`
  }

  const pv = punti.map((p) => ore(p.pvMinuti))
  const ev = punti.map((p) => (p.evMinuti === null ? null : ore(p.evMinuti)))
  const ac = punti.map((p) => (p.acMinuti === null ? null : ore(p.acMinuti)))

  let marcatori = ''
  punti.forEach((p, i) => {
    if (p.rettificato && p.acMinuti !== null) {
      marcatori += `<circle cx="${f1(x(i))}" cy="${f1(y(ore(p.acMinuti)))}" r="5" fill="none" stroke="var(--ac)" stroke-width="1.5"><title>${etichettaSettimana(p.settimana)}: ore rettificate dopo lo snapshot</title></circle>`
    }
  })
  if (iOggi >= 0) {
    const p = punti[iOggi]
    if (p.evMinuti !== null) {
      marcatori += `<circle cx="${f1(x(iOggi))}" cy="${f1(y(ore(p.evMinuti)))}" r="4" fill="var(--ev)"/>`
    }
    if (p.acMinuti !== null) {
      marcatori += `<circle cx="${f1(x(iOggi))}" cy="${f1(y(ore(p.acMinuti)))}" r="4" fill="var(--ac)"/>`
    }
    marcatori += `<circle cx="${f1(x(iOggi))}" cy="${f1(y(ore(p.pvMinuti)))}" r="3.5" fill="var(--pv)"/>`
  }

  return (
    `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Curva S: valore pianificato, guadagnato e ore registrate, in ore" data-testid="curva-s">` +
    griglia +
    etichette +
    oggi +
    lineaEac +
    `<path d="${percorso(pv)}" fill="none" stroke="var(--pv)" stroke-width="2" stroke-dasharray="5 4"/>` +
    `<path d="${percorso(ac)}" fill="none" stroke="var(--ac)" stroke-width="2.25"/>` +
    `<path d="${percorso(ev)}" fill="none" stroke="var(--ev)" stroke-width="2.5"/>` +
    marcatori +
    `</svg>`
  )
}
