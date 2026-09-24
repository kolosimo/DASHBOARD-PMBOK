import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Elaborato from '#models/elaborato'

export default class Disciplina extends BaseModel {
  static table = 'discipline'

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

  @hasMany(() => Elaborato)
  declare elaborati: HasMany<typeof Elaborato>
}
