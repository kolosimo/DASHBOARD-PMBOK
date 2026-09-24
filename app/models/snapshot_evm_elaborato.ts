import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { Minuti } from '#domain/types'
import SnapshotEvm from '#models/snapshot_evm'
import Elaborato from '#models/elaborato'
import StatoElaborato from '#models/stato_elaborato'

export default class SnapshotEvmElaborato extends BaseModel {
  static table = 'snapshot_evm_elaborato'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare snapshotId: number

  @column()
  declare elaboratoId: number

  @column()
  declare statoId: number

  @column()
  declare budgetMinuti: Minuti

  @column()
  declare pvMinuti: Minuti

  @column()
  declare evMinuti: Minuti

  @column()
  declare acMinuti: Minuti

  @belongsTo(() => SnapshotEvm, { foreignKey: 'snapshotId' })
  declare snapshot: BelongsTo<typeof SnapshotEvm>

  @belongsTo(() => Elaborato)
  declare elaborato: BelongsTo<typeof Elaborato>

  @belongsTo(() => StatoElaborato, { foreignKey: 'statoId' })
  declare stato: BelongsTo<typeof StatoElaborato>
}
