import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { Lunedi, StatoPiano } from '#domain/types'
import Commessa from '#models/commessa'
import Impegno from '#models/impegno'

export default class PianoSettimanale extends BaseModel {
  static table = 'piani_settimanali'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commessaId: number

  @column()
  declare settimana: Lunedi

  @column()
  declare stato: StatoPiano

  @column.dateTime()
  declare promessoIl: DateTime | null

  @column.dateTime()
  declare chiusoIl: DateTime | null

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Commessa)
  declare commessa: BelongsTo<typeof Commessa>

  @hasMany(() => Impegno, { foreignKey: 'pianoId' })
  declare impegni: HasMany<typeof Impegno>
}
