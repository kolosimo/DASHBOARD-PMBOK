import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Utente from '#models/utente'

export default class Impostazione extends BaseModel {
  static table = 'impostazioni'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare chiave: string

  /** JSONB: il driver pg restituisce già l'oggetto; in scrittura si serializza */
  @column({ prepare: (valore: unknown) => JSON.stringify(valore) })
  declare valore: unknown

  @column()
  declare descrizione: string

  @column()
  declare diEsempio: boolean

  @column()
  declare aggiornatoDaId: number | null

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Utente, { foreignKey: 'aggiornatoDaId' })
  declare aggiornatoDa: BelongsTo<typeof Utente>
}
