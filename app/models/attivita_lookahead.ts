import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { Lunedi, TipoAttivitaLookahead } from '#domain/types'
import Commessa from '#models/commessa'
import Elaborato from '#models/elaborato'
import Milestone from '#models/milestone'
import Utente from '#models/utente'
import Vincolo from '#models/vincolo'

export default class AttivitaLookahead extends BaseModel {
  static table = 'attivita_lookahead'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commessaId: number

  @column()
  declare codice: string

  @column()
  declare titolo: string

  @column()
  declare tipo: TipoAttivitaLookahead

  @column()
  declare elaboratoId: number | null

  @column()
  declare milestoneId: number | null

  @column()
  declare responsabileId: number | null

  @column()
  declare settimanaInizio: Lunedi

  @column()
  declare settimanaFine: Lunedi

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Commessa)
  declare commessa: BelongsTo<typeof Commessa>

  @belongsTo(() => Elaborato)
  declare elaborato: BelongsTo<typeof Elaborato>

  @belongsTo(() => Milestone)
  declare milestone: BelongsTo<typeof Milestone>

  @belongsTo(() => Utente, { foreignKey: 'responsabileId' })
  declare responsabile: BelongsTo<typeof Utente>

  @manyToMany(() => Vincolo, {
    pivotTable: 'vincoli_attivita',
    pivotForeignKey: 'attivita_id',
    pivotRelatedForeignKey: 'vincolo_id',
    pivotTimestamps: { createdAt: 'created_at', updatedAt: false },
  })
  declare vincoli: ManyToMany<typeof Vincolo>
}
