import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { DataIso, StatoCommessa } from '#domain/types'
import Utente from '#models/utente'
import MembroCommessa from '#models/membro_commessa'
import Milestone from '#models/milestone'
import Elaborato from '#models/elaborato'
import LimiteWipCommessa from '#models/limite_wip_commessa'
import AttivitaLookahead from '#models/attivita_lookahead'
import Vincolo from '#models/vincolo'
import PianoSettimanale from '#models/piano_settimanale'
import Baseline from '#models/baseline'
import SnapshotEvm from '#models/snapshot_evm'
import SnapshotLps from '#models/snapshot_lps'

export default class Commessa extends BaseModel {
  static table = 'commesse'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare codice: string

  @column()
  declare nome: string

  @column()
  declare cliente: string | null

  @column()
  declare stato: StatoCommessa

  @column()
  declare pmId: number | null

  @column()
  declare dataInizio: DataIso | null

  @column()
  declare dataFinePrevista: DataIso | null

  @column()
  declare note: string | null

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Utente, { foreignKey: 'pmId' })
  declare pm: BelongsTo<typeof Utente>

  @hasMany(() => MembroCommessa)
  declare membri: HasMany<typeof MembroCommessa>

  @hasMany(() => Milestone)
  declare milestone: HasMany<typeof Milestone>

  @hasMany(() => Elaborato)
  declare elaborati: HasMany<typeof Elaborato>

  @hasMany(() => LimiteWipCommessa)
  declare limitiWip: HasMany<typeof LimiteWipCommessa>

  @hasMany(() => AttivitaLookahead)
  declare attivitaLookahead: HasMany<typeof AttivitaLookahead>

  @hasMany(() => Vincolo)
  declare vincoli: HasMany<typeof Vincolo>

  @hasMany(() => PianoSettimanale)
  declare pianiSettimanali: HasMany<typeof PianoSettimanale>

  @hasMany(() => Baseline)
  declare baseline: HasMany<typeof Baseline>

  @hasMany(() => SnapshotEvm)
  declare snapshotEvm: HasMany<typeof SnapshotEvm>

  @hasMany(() => SnapshotLps)
  declare snapshotLps: HasMany<typeof SnapshotLps>
}
