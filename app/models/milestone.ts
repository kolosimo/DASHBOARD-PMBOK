import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DataIso } from '#domain/types'
import Commessa from '#models/commessa'

export default class Milestone extends BaseModel {
  static table = 'milestone'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commessaId: number

  @column()
  declare titolo: string

  @column()
  declare dataPrevista: DataIso

  @column()
  declare dataEffettiva: DataIso | null

  @column()
  declare contrattuale: boolean

  @column()
  declare ordine: number

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Commessa)
  declare commessa: BelongsTo<typeof Commessa>
}
