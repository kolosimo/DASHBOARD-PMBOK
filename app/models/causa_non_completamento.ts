import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class CausaNonCompletamento extends BaseModel {
  static table = 'cause_non_completamento'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare codice: string

  @column()
  declare nome: string

  @column()
  declare ordine: number

  @column()
  declare attiva: boolean

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
