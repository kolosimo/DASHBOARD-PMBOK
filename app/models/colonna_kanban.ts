import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import StatoElaborato from '#models/stato_elaborato'
import LimiteWipCommessa from '#models/limite_wip_commessa'

export default class ColonnaKanban extends BaseModel {
  static table = 'colonne_kanban'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare codice: string

  @column()
  declare nome: string

  @column()
  declare ordine: number

  /** null = nessun limite */
  @column()
  declare limiteWipDefault: number | null

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => StatoElaborato)
  declare stati: HasMany<typeof StatoElaborato>

  @hasMany(() => LimiteWipCommessa)
  declare limitiCommessa: HasMany<typeof LimiteWipCommessa>
}
