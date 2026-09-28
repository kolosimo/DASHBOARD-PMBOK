/**
 * Last Planner System: PPC, PCR, TMR/TA, Pareto delle cause.
 *
 * CONTRATTO fissato in Fase 0: firme e formule sono vincolanti; corpi
 * dell'agente A2 (Fase 1), verificati dai test di T1 in tests/unit/domain/lps.spec.ts.
 * Formule e casi di prova: docs/formule/formule.md.
 */
import type {
  AttivitaSnapshotLps,
  ImpegnoLps,
  Lunedi,
  RisultatoPcr,
  RisultatoPpc,
  RisultatoTmrTa,
  VincoloLps,
  VoceParetoCausa,
} from '#domain/types'

/** Somma n giorni a una data 'YYYY-MM-DD' (aritmetica di calendario, senza fusi) */
function aggiungiGiorni(data: string, n: number): string {
  const [a, m, g] = data.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, g + n))
  return d.toISOString().slice(0, 10)
}

/** Rapporto oppure null se il divisore è 0 */
function rapporto(numeratore: number, denominatore: number): number | null {
  return denominatore === 0 ? null : numeratore / denominatore
}

/**
 * PPC (Percent Plan Complete) = fatti / promessi.
 *
 * - Si contano solo gli impegni con `aggiuntoDopoPromessa = false`
 *   (quelli aggiunti dopo la promessa sono **esclusi** da numeratore e denominatore).
 * - Un impegno con `fatto = null` conta come promesso e non fatto.
 * - **null se non ci sono impegni promessi.**
 */
export function calcolaPpc(impegni: readonly ImpegnoLps[]): RisultatoPpc {
  const promessi = impegni.filter((i) => !i.aggiuntoDopoPromessa)
  const fatti = promessi.filter((i) => i.fatto === true).length
  return { promessi: promessi.length, fatti, ppc: rapporto(fatti, promessi.length) }
}

/**
 * PCR(w) (Percent Constraints Removed) — confermata al Gate 0 (28/09/2026).
 *
 *   PCR(w) = vincoli rimossi entro la fine di w
 *            / vincoli aperti al lunedì di w con scadenza (data_necessaria) entro w
 *
 * - "aperti al lunedì di w": identificati entro il lunedì, non rimossi né
 *   annullati prima del lunedì (stato da_analizzare o aperto a quella data);
 * - "entro w": data ≤ domenica di w;
 * - il numeratore conta solo i vincoli del denominatore;
 * - i vincoli annullati durante w escono dal denominatore;
 * - **null se il denominatore è 0.**
 */
export function calcolaPcr(vincoli: readonly VincoloLps[], settimana: Lunedi): RisultatoPcr {
  const domenica = aggiungiGiorni(settimana, 6)
  let daRimuovere = 0
  let rimossi = 0
  for (const v of vincoli) {
    if (v.dataNecessaria === null || v.dataNecessaria > domenica) continue
    if (v.identificatoIl > settimana) continue
    if (v.rimossoIl !== null && v.rimossoIl < settimana) continue
    // Annullati prima di w o durante w: fuori dal conteggio
    if (v.annullatoIl !== null && v.annullatoIl <= domenica) continue
    if (v.stato === 'annullato' && v.annullatoIl === null) continue
    daRimuovere++
    if (v.rimossoIl !== null && v.rimossoIl <= domenica) rimossi++
  }
  return { daRimuovere, rimossi, pcr: rapporto(rimossi, daRimuovere) }
}

/**
 * TMR (Tasks Made Ready) e TA (Tasks Anticipated) per la settimana w,
 * calcolati dallo snapshot del lookahead scattato a **w − 2**.
 *
 * - Anticipate(w) = attività dello snapshot w−2 che cadono in w
 *   (settimanaInizio ≤ w ≤ settimanaFine);
 * - TA(w)  = impegni del piano di w collegati ad attività anticipate
 *            / impegni del piano di w;
 * - TMR(w) = attività anticipate che sono entrate nel piano di w
 *            / attività anticipate.
 * - null quando il denominatore è 0 o manca lo snapshot di w−2.
 *
 * `codiciAttivitaNelPiano` può contenere un codice per impegno (anche ripetuto):
 * il TA conta le voci (impegni), il TMR le attività distinte.
 *
 * @param snapshotW2 righe di snapshot_lookahead con settimana = w − 2 (null se assente)
 * @param codiciAttivitaNelPiano codici delle attività collegate agli impegni del piano di w
 * @param impegniNelPiano numero di impegni del piano di w (esclusi quelli aggiunti dopo la promessa)
 */
export function calcolaTmrTa(
  settimana: Lunedi,
  snapshotW2: readonly AttivitaSnapshotLps[] | null,
  codiciAttivitaNelPiano: readonly string[],
  impegniNelPiano: number
): RisultatoTmrTa {
  if (snapshotW2 === null) return { tmr: null, ta: null }
  const anticipate = new Set(
    snapshotW2
      .filter((a) => a.settimanaInizio <= settimana && settimana <= a.settimanaFine)
      .map((a) => a.codiceAttivita)
  )
  const impegniAnticipati = codiciAttivitaNelPiano.filter((c) => anticipate.has(c)).length
  const entrate = new Set(codiciAttivitaNelPiano.filter((c) => anticipate.has(c))).size
  return {
    tmr: rapporto(entrate, anticipate.size),
    ta: rapporto(impegniAnticipati, impegniNelPiano),
  }
}

/**
 * Pareto delle cause di non completamento: conteggio per causa degli impegni
 * con `fatto = false`, in ordine decrescente di conteggio e, a parità, per
 * ordine della causa. Le cause con conteggio 0 non compaiono.
 *
 * Come nel PPC, gli impegni aggiunti dopo la promessa non contano: così il
 * totale del Pareto corrisponde agli impegni promessi e non fatti.
 */
export function paretoCause(
  impegni: readonly ImpegnoLps[],
  cause: readonly { id: number; codice: string; nome: string; ordine: number }[]
): VoceParetoCausa[] {
  const conteggi = new Map<number, number>()
  for (const i of impegni) {
    if (i.fatto !== false || i.causaId === null || i.aggiuntoDopoPromessa) continue
    conteggi.set(i.causaId, (conteggi.get(i.causaId) ?? 0) + 1)
  }
  return cause
    .filter((c) => (conteggi.get(c.id) ?? 0) > 0)
    .sort((a, b) => conteggi.get(b.id)! - conteggi.get(a.id)! || a.ordine - b.ordine)
    .map((c) => ({ causaId: c.id, codice: c.codice, nome: c.nome, conteggio: conteggi.get(c.id)! }))
}
