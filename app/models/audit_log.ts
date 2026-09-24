import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Utente from '#models/utente'
import Commessa from '#models/commessa'

/** Registro di audit: solo inserimenti (usare app/shared/audit.ts) */
export default class AuditLog extends BaseModel {
  static table = 'audit_log'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare utenteId: number | null

  @column()
  declare commessaId: number | null

  @column()
  declare azione: string

  @column()
  declare entita: string

  @column()
  declare entitaId: string | null

  @column({ prepare: (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v)) })
  declare datiPrima: unknown

  @column({ prepare: (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v)) })
  declare datiDopo: unknown

  @column()
  declare ip: string | null

  @column.dateTime({ autoCreate: true })
  declare creatoIl: DateTime

  @belongsTo(() => Utente)
  declare utente: BelongsTo<typeof Utente>

  @belongsTo(() => Commessa)
  declare commessa: BelongsTo<typeof Commessa>
}
