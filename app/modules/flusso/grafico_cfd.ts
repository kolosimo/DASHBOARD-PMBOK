/**
 * Geometria SVG del diagramma di flusso cumulativo (CFD). Funzione pura:
 * riceve la serie giornaliera e restituisce le aree impilate già in
 * coordinate SVG; la vista Edge disegna solo i tracciati.
 *
 * Impilamento: in basso l'ultima colonna del Kanban (emesso), in alto la
 * prima (da fare), come nei CFD classici.
 */
import type { DataIso, PuntoCfd } from '#domain/types'

export interface AreaCfd {
  codice: string
  nome: string
  /** 0 = in basso. Serve per l'intensità del colore */
  livello: number
  /** Tracciato SVG chiuso ("M … Z") */
  tracciato: string
  /** Valore dell'ultimo giorno (per la legenda) */
  ultimo: number
}

export interface GraficoCfd {
  larghezza: number
  altezza: number
  margine: { sinistra: number; destra: number; alto: number; basso: number }
  aree: AreaCfd[]
  tacche: { y: number; valore: number }[]
  etichette: { x: number; giorno: DataIso }[]
  massimo: number
  vuoto: boolean
}

const L = 720
const H = 240
const M = { sinistra: 36, destra: 24, alto: 10, basso: 26 }

function arrotonda(n: number): number {
  return Math.round(n * 10) / 10
}

/** Passo "comodo" per le tacche dell'asse Y (1, 2, 5, 10, 20, …) */
function passoTacche(massimo: number): number {
  const grezzo = massimo / 4
  if (grezzo <= 1) return 1
  const potenza = 10 ** Math.floor(Math.log10(grezzo))
  for (const m of [1, 2, 5, 10]) {
    if (m * potenza >= grezzo) return m * potenza
  }
  return 10 * potenza
}

export function graficoCfd(
  colonne: readonly { codice: string; nome: string }[],
  punti: readonly PuntoCfd[]
): GraficoCfd {
  const larghezzaUtile = L - M.sinistra - M.destra
  const altezzaUtile = H - M.alto - M.basso
  const dalBasso = [...colonne].reverse()

  const totali = punti.map((p) => dalBasso.reduce((s, c) => s + (p.perColonna[c.codice] ?? 0), 0))
  const massimoDati = Math.max(0, ...totali)
  const passo = passoTacche(Math.max(massimoDati, 1))
  const massimo = Math.max(passo, Math.ceil(massimoDati / passo) * passo)

  const n = punti.length
  const x = (i: number) => arrotonda(M.sinistra + (n <= 1 ? 0 : (i * larghezzaUtile) / (n - 1)))
  const y = (v: number) => arrotonda(M.alto + altezzaUtile - (v / massimo) * altezzaUtile)

  const cumulato = punti.map(() => 0)
  const aree: AreaCfd[] = dalBasso.map((c, livello) => {
    const sotto = [...cumulato]
    punti.forEach((p, i) => {
      cumulato[i] += p.perColonna[c.codice] ?? 0
    })
    const sopra = [...cumulato]
    let tracciato = ''
    if (n === 1) {
      // Un solo giorno: una striscia larga quanto il grafico
      const x0 = M.sinistra
      const x1 = M.sinistra + larghezzaUtile
      tracciato = `M${x0},${y(sopra[0])} L${x1},${y(sopra[0])} L${x1},${y(sotto[0])} L${x0},${y(sotto[0])} Z`
    } else if (n > 1) {
      const su = sopra.map((v, i) => `${x(i)},${y(v)}`)
      const giu = sotto.map((v, i) => `${x(i)},${y(v)}`).reverse()
      tracciato = `M${su.join(' L')} L${giu.join(' L')} Z`
    }
    return {
      codice: c.codice,
      nome: c.nome,
      livello,
      tracciato,
      ultimo: n > 0 ? (punti[n - 1].perColonna[c.codice] ?? 0) : 0,
    }
  })

  const tacche: { y: number; valore: number }[] = []
  for (let v = 0; v <= massimo; v += passo) tacche.push({ y: y(v), valore: v })

  // Un'etichetta a settimana (lunedì), più l'ultimo giorno se c'è spazio
  const etichette: { x: number; giorno: DataIso }[] = []
  punti.forEach((p, i) => {
    const lunedi = new Date(`${p.giorno}T12:00:00Z`).getUTCDay() === 1
    if (lunedi) etichette.push({ x: x(i), giorno: p.giorno })
  })

  return {
    larghezza: L,
    altezza: H,
    margine: M,
    aree: aree.reverse(),
    tacche,
    etichette,
    massimo,
    vuoto: massimoDati === 0,
  }
}
