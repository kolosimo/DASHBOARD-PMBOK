import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { Lunedi, Minuti } from '#domain/types'
import Commessa from '#models/commessa'
import Baseline from '#models/baseline'
import SnapshotEvmElaborato from '#models/snapshot_evm_elaborato'

/** Valori EVM congelati a fine settimana: la curva S storica si legge da qui */
export default class SnapshotEvm extends BaseModel {
  static table = 'snapshot_evm'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commessaId: number

  @column()
  declare baselineId: number

  @column()
  declare settimana: Lunedi

  @column()
  declare bacMinuti: Minuti

  @column()
  declare pvMinuti: Minuti

  @column()
  declare evMinuti: Minuti

  @column()
  declare acMinuti: Minuti

  @column()
  declare spi: number | null

  @column()
  declare cpi: number | null

  @column()
  declare eacMinuti: Minuti | null

  @column()
  declare etcMinuti: Minuti | null

  @column()
  declare vacMinuti: Minuti | null

  @column.dateTime({ autoCreate: true })
  declare creatoIl: DateTime

  @belongsTo(() => Commessa)
  declare commessa: BelongsTo<typeof Commessa>

  @belongsTo(() => Baseline)
  declare baseline: BelongsTo<typeof Baseline>

  @hasMany(() => SnapshotEvmElaborato, { foreignKey: 'snapshotId' })
  declare elaborati: HasMany<typeof SnapshotEvmElaborato>
}
