/**
 * Registro di audit (solo inserimenti; il DB rifiuta UPDATE e DELETE).
 *
 * Si registrano: modifiche a dati di commessa, cambi di stato, sforamenti WIP,
 * modifiche alla configurazione, accessi admin. Non si registrano letture.
 */
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AuditLog from '#models/audit_log'

export interface VoceAudit {
  utenteId: number | null
  azione: string
  entita: string
  entitaId?: string | number | null
  commessaId?: number | null
  prima?: unknown
  dopo?: unknown
  ip?: string | null
}

/** Inserisce una voce nel registro di audit, nella transazione se indicata */
export async function registraAudit(voce: VoceAudit, client?: TransactionClientContract) {
  return AuditLog.create(
    {
      utenteId: voce.utenteId,
      azione: voce.azione,
      entita: voce.entita,
      entitaId: voce.entitaId === undefined || voce.entitaId === null ? null : String(voce.entitaId),
      commessaId: voce.commessaId ?? null,
      datiPrima: voce.prima ?? null,
      datiDopo: voce.dopo ?? null,
      ip: voce.ip ?? null,
    },
    client ? { client } : undefined
  )
}

/** Copia degli attributi di un modello, adatta al campo JSON dell'audit */
export function istantaneaPerAudit(modello: { serialize(): Record<string, unknown> }) {
  return JSON.parse(JSON.stringify(modello.serialize())) as Record<string, unknown>
}
