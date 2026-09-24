import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { ClasseServizio, DataIso, Minuti } from '#domain/types'
import Commessa from '#models/commessa'
import Disciplina from '#models/disciplina'
import StatoElaborato from '#models/stato_elaborato'
import Utente from '#models/utente'
import TransizioneElaborato from '#models/transizione_elaborato'
import RegistrazioneOre from '#models/registrazione_ore'

export default class Elaborato extends BaseModel {
  static table = 'elaborati'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare commessaId: number

  @column()
  declare codice: string

  @column()
  declare titolo: string

  @column()
  declare disciplinaId: number

  @column()
  declare budgetMinuti: Minuti

  @column()
  declare classeServizio: ClasseServizio

  @column()
  declare dataFissa: DataIso | null

  @column()
  declare responsabileId: number | null

  /** Lo scrive solo il servizio di cambio stato del modulo flusso */
  @column()
  declare statoId: number

  /** Da quando l'elaborato è nello stato attuale (Work Item Age) */
  @column.dateTime()
  declare statoDal: DateTime

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Commessa)
  declare commessa: BelongsTo<typeof Commessa>

  @belongsTo(() => Disciplina)
  declare disciplina: BelongsTo<typeof Disciplina>

  @belongsTo(() => StatoElaborato, { foreignKey: 'statoId' })
  declare stato: BelongsTo<typeof StatoElaborato>

  @belongsTo(() => Utente, { foreignKey: 'responsabileId' })
  declare responsabile: BelongsTo<typeof Utente>

  @hasMany(() => TransizioneElaborato)
  declare transizioni: HasMany<typeof TransizioneElaborato>

  @hasMany(() => RegistrazioneOre)
  declare registrazioniOre: HasMany<typeof RegistrazioneOre>
}
