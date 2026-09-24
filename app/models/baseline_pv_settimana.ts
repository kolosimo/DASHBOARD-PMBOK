import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { Lunedi, Minuti } from '#domain/types'
import Baseline from '#models/baseline'

/** PV cumulato alla fine della settimana, congelato nella baseline */
export default class BaselinePvSettimana extends BaseModel {
  static table = 'baseline_pv_settimana'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare baselineId: number

  @column()
  declare settimana: Lunedi

  @column()
  declare pvMinuti: Minuti

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Baseline)
  declare baseline: BelongsTo<typeof Baseline>
}
