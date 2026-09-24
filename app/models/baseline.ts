import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { Minuti, StatoBaseline } from '#domain/types'
import Commessa from '#models/commessa'
import Utente from '#models/utente'
import BaselineDataStato from '#models/baseline_data_stato'
import BaselinePvSettimana from '#models/baseline_pv_settimana'

export default class Baseline extends BaseModel {
  static table = 'baseline'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commessaId: number

  @column()
  declare numero: number

  @column()
  declare stato: StatoBaseline

  /** Pesi EV congelati all'approvazione: { codice stato: peso % } */
  @column({ prepare: (valore: Record<string, number>) => JSON.stringify(valore) })
  declare pesiStati: Record<string, number>

  @column()
  declare bacMinuti: Minuti

  @column()
  declare approvataDaId: number | null

  @column.dateTime()
  declare approvataIl: DateTime | null

  @column()
  declare note: string | null

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Commessa)
  declare commessa: BelongsTo<typeof Commessa>

  @belongsTo(() => Utente, { foreignKey: 'approvataDaId' })
  declare approvataDa: BelongsTo<typeof Utente>

  @hasMany(() => BaselineDataStato)
  declare dateStato: HasMany<typeof BaselineDataStato>

  @hasMany(() => BaselinePvSettimana)
  declare pvSettimane: HasMany<typeof BaselinePvSettimana>
}
