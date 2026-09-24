import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Commessa from '#models/commessa'
import ColonnaKanban from '#models/colonna_kanban'

export default class LimiteWipCommessa extends BaseModel {
  static table = 'limiti_wip_commessa'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commessaId: number

  @column()
  declare colonnaKanbanId: number

  @column()
  declare limite: number

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Commessa)
  declare commessa: BelongsTo<typeof Commessa>

  @belongsTo(() => ColonnaKanban)
  declare colonnaKanban: BelongsTo<typeof ColonnaKanban>
}
