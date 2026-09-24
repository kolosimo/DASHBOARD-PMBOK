import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DataIso, Minuti } from '#domain/types'
import Utente from '#models/utente'
import Elaborato from '#models/elaborato'

export default class RegistrazioneOre extends BaseModel {
  static table = 'registrazioni_ore'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare utenteId: number

  @column()
  declare elaboratoId: number

  @column()
  declare data: DataIso

  @column()
  declare minuti: Minuti

  @column()
  declare nota: string | null

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Utente)
  declare utente: BelongsTo<typeof Utente>

  @belongsTo(() => Elaborato)
  declare elaborato: BelongsTo<typeof Elaborato>
}
