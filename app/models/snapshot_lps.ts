import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { Lunedi } from '#domain/types'
import Commessa from '#models/commessa'

/** Indicatori Last Planner congelati a fine settimana (rapporti 0–1) */
export default class SnapshotLps extends BaseModel {
  static table = 'snapshot_lps'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commessaId: number

  @column()
  declare settimana: Lunedi

  @column()
  declare impegniPromessi: number

  @column()
  declare impegniFatti: number

  @column()
  declare ppc: number | null

  @column()
  declare vincoliDaRimuovere: number

  @column()
  declare vincoliRimossi: number

  @column()
  declare pcr: number | null

  @column()
  declare tmr: number | null

  @column()
  declare ta: number | null

  @column.dateTime({ autoCreate: true })
  declare creatoIl: DateTime

  @belongsTo(() => Commessa)
  declare commessa: BelongsTo<typeof Commessa>
}
