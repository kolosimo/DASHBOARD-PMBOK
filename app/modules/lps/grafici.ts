/**
 * Grafici SVG del Last Planner, generati lato server (funzioni pure).
 *
 * - PPC per settimana: barre verticali, una serie, scala 0–100%; la linea
 *   tratteggiata è la soglia "in linea" del semaforo (app/domain/soglie.ts).
 * - Pareto delle cause: barre orizzontali in ordine decrescente con il
 *   conteggio e la percentuale cumulata.
 *
 * Colori solo con le variabili CSS del tema (chiaro e scuro); testi con
 * gli inchiostri del tema, mai con il colore delle barre. Ogni barra ha un
 * <title> (suggerimento al passaggio del mouse e testo per i lettori di schermo).
 */
import type { Indice, Lunedi, Soglia, VoceParetoCausa } from '#domain/types'
import { etichettaSettimana } from '#shared/calendario'
import { percento } from '#ui/formato'

/** Escape per testo e attributi XML */
export function escapeXml(testo: string): string {
  return testo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function n(x: number): string {
  return (Math.round(x * 10) / 10).toString()
}

/** Rettangolo con angoli arrotondati solo all'estremità dei dati (in alto o a destra) */
function barra(
  x: number,
  y: number,
  w: number,
  h: number,
  verso: 'su' | 'destra',
  raggio = 3
): string {
  if (w <= 0 || h <= 0) return ''
  const r = Math.min(raggio, w / 2, h / 2)
  if (verso === 'su') {
    return `M${n(x)},${n(y + h)}V${n(y + r)}Q${n(x)},${n(y)} ${n(x + r)},${n(y)}H${n(x + w - r)}Q${n(x + w)},${n(y)} ${n(x + w)},${n(y + r)}V${n(y + h)}Z`
  }
  return `M${n(x)},${n(y)}H${n(x + w - r)}Q${n(x + w)},${n(y)} ${n(x + w)},${n(y + r)}V${n(y + h - r)}Q${n(x + w)},${n(y + h)} ${n(x + w - r)},${n(y + h)}H${n(x)}Z`
}

export interface PuntoPpc {
  settimana: Lunedi
  ppc: Indice
  daSnapshot: boolean
}

/**
 * Istogramma del PPC per settimana. L'ultima barra (settimana in esame) è
 * piena, le precedenti chiare. PPC null → nessuna barra ed etichetta "n.d.".
 */
export function graficoPpc(
  punti: readonly PuntoPpc[],
  opzioni: { soglia?: Soglia; altezza?: number; larghezza?: number } = {}
): string {
  const W = opzioni.larghezza ?? 520
  const H = opzioni.altezza ?? 220
  const L = 40
  const R = 10
  const T = 14
  const B = 26
  const y = (v: number) => T + (H - T - B) * (1 - v)
  const parti: string[] = []

  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    parti.push(
      `<line class="gl" x1="${L}" x2="${W - R}" y1="${n(y(v))}" y2="${n(y(v))}"/>`,
      `<text x="${L - 6}" y="${n(y(v) + 4)}" text-anchor="end">${v * 100}%</text>`
    )
  }

  if (punti.length === 0) {
    parti.push(
      `<text x="${n((L + W - R) / 2)}" y="${n(H / 2)}" text-anchor="middle">Nessuna settimana da mostrare</text>`
    )
  }

  const bw = punti.length > 0 ? (W - L - R) / punti.length : 0
  punti.forEach((p, i) => {
    const ultima = i === punti.length - 1
    const cx = L + i * bw + bw / 2
    const larghezza = Math.min(bw * 0.6, 36)
    const etichetta = etichettaSettimana(p.settimana)
    const valore = percento(p.ppc)
    const origine = p.daSnapshot ? 'settimana chiusa' : 'in corso, dal piano'
    if (p.ppc !== null) {
      const alto = y(Math.max(0, Math.min(1, p.ppc)))
      const d = barra(cx - larghezza / 2, alto, larghezza, y(0) - alto, 'su')
      parti.push(
        `<g><title>${escapeXml(`${etichetta}: PPC ${valore} (${origine})`)}</title>` +
          (d
            ? `<path d="${d}" fill="${ultima ? 'var(--accent)' : 'var(--accent-soft)'}"${ultima ? '' : ' stroke="var(--accent)" stroke-width="1"'}/>`
            : '') +
          `<rect x="${n(cx - bw / 2)}" y="${T}" width="${n(bw)}" height="${H - T - B}" fill="transparent"/></g>`
      )
    }
    parti.push(
      `<text x="${n(cx)}" y="${n((p.ppc === null ? y(0) : y(Math.max(0, Math.min(1, p.ppc)))) - 5)}" text-anchor="middle"${ultima ? ' style="fill:var(--ink)"' : ''}>${escapeXml(valore)}</text>`,
      `<text x="${n(cx)}" y="${H - 8}" text-anchor="middle">${escapeXml(etichetta)}</text>`
    )
  })

  if (opzioni.soglia && opzioni.soglia.verso === 'alto') {
    const ys = y(opzioni.soglia.verde)
    parti.push(
      `<line x1="${L}" x2="${W - R}" y1="${n(ys)}" y2="${n(ys)}" stroke="var(--ink-3)" stroke-dasharray="4 3"/>`,
      `<text x="${W - R}" y="${n(ys - 4)}" text-anchor="end">in linea da ${escapeXml(percento(opzioni.soglia.verde))}</text>`
    )
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="PPC per settimana, in percentuale" data-grafico="ppc">${parti.join('')}</svg>`
}

/**
 * Pareto delle cause di non completamento: barre orizzontali in ordine
 * decrescente, conteggio a destra della barra e percentuale cumulata.
 */
export function graficoPareto(
  voci: readonly VoceParetoCausa[],
  opzioni: { larghezza?: number } = {}
): string {
  const W = opzioni.larghezza ?? 520
  const riga = 26
  const T = 20
  const etichette = 200
  const destra = 70
  const H = T + Math.max(voci.length, 1) * riga + 6
  const totale = voci.reduce((s, v) => s + v.conteggio, 0)
  const massimo = voci.reduce((m, v) => Math.max(m, v.conteggio), 0)
  const larghezzaBarre = W - etichette - destra - 30
  const parti: string[] = [`<text x="${W - 4}" y="12" text-anchor="end">cumulata</text>`]

  if (voci.length === 0) {
    parti.push(
      `<text x="${n(W / 2)}" y="${T + 16}" text-anchor="middle">Nessun impegno non fatto nel periodo</text>`
    )
  }

  let cumulata = 0
  voci.forEach((v, i) => {
    cumulata += v.conteggio
    const yv = T + i * riga
    const w = massimo > 0 ? (v.conteggio / massimo) * larghezzaBarre : 0
    const quota = totale > 0 ? cumulata / totale : null
    const nome = v.nome.length > 32 ? `${v.nome.slice(0, 31)}…` : v.nome
    const d = barra(etichette, yv + 5, w, riga - 12, 'destra')
    parti.push(
      `<g><title>${escapeXml(`${v.nome}: ${v.conteggio} (cumulata ${percento(quota)})`)}</title>` +
        `<text x="${etichette - 8}" y="${yv + 17}" text-anchor="end" style="fill:var(--ink-2);font-family:inherit;font-size:12px">${escapeXml(nome)}</text>` +
        (d ? `<path d="${d}" fill="var(--accent)"/>` : '') +
        `<text x="${n(etichette + w + 6)}" y="${yv + 17}" style="fill:var(--ink)">${v.conteggio}</text>` +
        `<text x="${W - 4}" y="${yv + 17}" text-anchor="end">${escapeXml(percento(quota))}</text>` +
        `<rect x="0" y="${yv}" width="${W}" height="${riga}" fill="transparent"/></g>`
    )
  })

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Pareto delle cause di mancato completamento" data-grafico="pareto">${parti.join('')}</svg>`
}
