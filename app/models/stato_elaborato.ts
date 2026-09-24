import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ColonnaKanban from '#models/colonna_kanban'

export default class StatoElaborato extends BaseModel {
  static table = 'stati_elaborato'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare codice: string

  @column()
  declare nome: string

  /** Ordine di avanzamento: si avanza di uno alla volta */
  @column()
  declare ordine: number

  /** Peso EV cumulativo, 0–100 */
  @column()
  declare pesoEvPercento: number

  @column()
  declare colonnaKanbanId: number

  @column()
  declare finale: boolean

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ColonnaKanban)
  declare colonnaKanban: BelongsTo<typeof ColonnaKanban>
}
