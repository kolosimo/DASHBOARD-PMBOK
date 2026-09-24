import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DataIso, Minuti } from '#domain/types'
import Baseline from '#models/baseline'
import Elaborato from '#models/elaborato'
import StatoElaborato from '#models/stato_elaborato'

/** Data in cui, secondo la baseline, l'elaborato raggiunge lo stato */
export default class BaselineDataStato extends BaseModel {
  static table = 'baseline_date_stato'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare baselineId: number

  @column()
  declare elaboratoId: number

  @column()
  declare statoId: number

  /** Budget dell'elaborato congelato nella baseline */
  @column()
  declare budgetMinuti: Minuti

  @column()
  declare dataPrevista: DataIso

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Baseline)
  declare baseline: BelongsTo<typeof Baseline>

  @belongsTo(() => Elaborato)
  declare elaborato: BelongsTo<typeof Elaborato>

  @belongsTo(() => StatoElaborato, { foreignKey: 'statoId' })
  declare stato: BelongsTo<typeof StatoElaborato>
}
