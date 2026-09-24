/**
 * Query di lettura dell'EVM. Proprietario: agente A5.
 * Formule in #domain/evm. La curva S storica si legge da snapshot_evm e non
 * si ricalcola; solo la settimana corrente è calcolata al momento.
 */
import type { DataIso, IndicatoriEvm, PuntoCurvaS } from '#domain/types'

export interface RiepilogoEvm extends IndicatoriEvm {
  commessaId: number
  baselineId: number | null
  dataStato: DataIso
  perElaborato: {
    elaboratoId: number
    codice: string
    titolo: string
    statoNome: string
    budgetMinuti: number
    evMinuti: number
    acMinuti: number
    cpi: number | null
  }[]
}

/** Indicatori EVM della commessa alla data di stato (default: oggi a Roma) */
export async function riepilogoEvm(commessaId: number, dataStato: DataIso): Promise<RiepilogoEvm> {
  void commessaId
  void dataStato
  throw new Error('non implementato')
}

/**
 * Serie della curva S: PV dalla baseline (tutte le settimane), EV e AC dagli
 * snapshot per le settimane passate e dal calcolo live per quella corrente.
 */
export async function serieCurvaS(commessaId: number): Promise<PuntoCurvaS[]> {
  void commessaId
  throw new Error('non implementato')
}
