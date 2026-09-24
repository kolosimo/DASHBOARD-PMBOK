import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { RuoloCommessa } from '#domain/types'
import Utente from '#models/utente'
import Commessa from '#models/commessa'

export default class MembroCommessa extends BaseModel {
  static table = 'membri_commessa'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commessaId: number

  @column()
  declare utenteId: number

  @column()
  declare ruoloCommessa: RuoloCommessa

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Commessa)
  declare commessa: BelongsTo<typeof Commessa>

  @belongsTo(() => Utente)
  declare utente: BelongsTo<typeof Utente>
}
