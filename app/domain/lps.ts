/**
 * Last Planner System: PPC, PCR, TMR/TA, Pareto delle cause.
 *
 * CONTRATTO fissato in Fase 0: firme e formule sono vincolanti, i corpi li
 * scrive l'agente A2 dopo i test del verificatore T1.
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

/**
 * PPC (Percent Plan Complete) = fatti / promessi.
 *
 * - Si contano solo gli impegni con `aggiuntoDopoPromessa = false`
 *   (quelli aggiunti dopo la promessa sono **esclusi** da numeratore e denominatore).
 * - Un impegno con `fatto = null` conta come promesso e non fatto.
 * - **null se non ci sono impegni promessi.**
 */
export function calcolaPpc(impegni: readonly ImpegnoLps[]): RisultatoPpc {
  void impegni
  throw new Error('non implementato')
}

/**
 * PCR(w) (Percent Constraints Removed) — DA CONFERMARE AL GATE 0.
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
  void vincoli
  void settimana
  throw new Error('non implementato')
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
  void settimana
  void snapshotW2
  void codiciAttivitaNelPiano
  void impegniNelPiano
  throw new Error('non implementato')
}

/**
 * Pareto delle cause di non completamento: conteggio per causa degli impegni
 * con `fatto = false`, in ordine decrescente di conteggio e, a parità, per
 * ordine della causa. Le cause con conteggio 0 non compaiono.
 */
export function paretoCause(
  impegni: readonly ImpegnoLps[],
  cause: readonly { id: number; codice: string; nome: string; ordine: number }[]
): VoceParetoCausa[] {
  void impegni
  void cause
  throw new Error('non implementato')
}
