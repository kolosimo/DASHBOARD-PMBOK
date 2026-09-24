import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { CategoriaVincolo, DataIso, StatoVincolo } from '#domain/types'
import Commessa from '#models/commessa'
import Utente from '#models/utente'
import AttivitaLookahead from '#models/attivita_lookahead'

export default class Vincolo extends BaseModel {
  static table = 'vincoli'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commessaId: number

  @column()
  declare codice: string

  @column()
  declare descrizione: string

  @column()
  declare categoria: CategoriaVincolo

  @column()
  declare stato: StatoVincolo

  @column()
  declare responsabileId: number | null

  /** Per chi non è utente dell'app (per esempio l'architetto) */
  @column()
  declare responsabileEsterno: string | null

  @column()
  declare dataNecessaria: DataIso | null

  @column()
  declare identificatoIl: DataIso

  @column.dateTime()
  declare rimossoIl: DateTime | null

  @column.dateTime()
  declare annullatoIl: DateTime | null

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

  @belongsTo(() => Utente, { foreignKey: 'responsabileId' })
  declare responsabile: BelongsTo<typeof Utente>

  @manyToMany(() => AttivitaLookahead, {
    pivotTable: 'vincoli_attivita',
    pivotForeignKey: 'vincolo_id',
    pivotRelatedForeignKey: 'attivita_id',
    pivotTimestamps: { createdAt: 'created_at', updatedAt: false },
  })
  declare attivita: ManyToMany<typeof AttivitaLookahead>
}
