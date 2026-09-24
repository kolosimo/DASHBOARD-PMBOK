import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { Lunedi } from '#domain/types'
import Commessa from '#models/commessa'
import AttivitaLookahead from '#models/attivita_lookahead'

/** Fotografia del lookahead scattata il lunedì di `settimana` */
export default class SnapshotLookahead extends BaseModel {
  static table = 'snapshot_lookahead'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commessaId: number

  @column()
  declare settimana: Lunedi

  @column()
  declare attivitaId: number | null

  @column()
  declare codiceAttivita: string

  @column()
  declare titoloAttivita: string

  @column()
  declare settimanaInizio: Lunedi

  @column()
  declare settimanaFine: Lunedi

  @column()
  declare vincoliAperti: number

  @column()
  declare pronta: boolean

  @column.dateTime({ autoCreate: true })
  declare creatoIl: DateTime

  @belongsTo(() => Commessa)
  declare commessa: BelongsTo<typeof Commessa>

  @belongsTo(() => AttivitaLookahead, { foreignKey: 'attivitaId' })
  declare attivita: BelongsTo<typeof AttivitaLookahead>
}
