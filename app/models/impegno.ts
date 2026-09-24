import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import PianoSettimanale from '#models/piano_settimanale'
import AttivitaLookahead from '#models/attivita_lookahead'
import Elaborato from '#models/elaborato'
import Utente from '#models/utente'
import CausaNonCompletamento from '#models/causa_non_completamento'

export default class Impegno extends BaseModel {
  static table = 'impegni'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare pianoId: number

  @column()
  declare attivitaId: number | null

  @column()
  declare elaboratoId: number | null

  @column()
  declare descrizione: string

  @column()
  declare lastPlannerId: number | null

  /** null = non ancora segnato */
  @column()
  declare fatto: boolean | null

  @column()
  declare causaId: number | null

  /** Risposte dell'analisi "5 perché" */
  @column({
    prepare: (valore: string[] | null) => (valore === null ? null : JSON.stringify(valore)),
  })
  declare cinquePerche: string[] | null

  /** Escluso dal PPC */
  @column()
  declare aggiuntoDopoPromessa: boolean

  @column()
  declare ordine: number

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => PianoSettimanale, { foreignKey: 'pianoId' })
  declare piano: BelongsTo<typeof PianoSettimanale>

  @belongsTo(() => AttivitaLookahead, { foreignKey: 'attivitaId' })
  declare attivita: BelongsTo<typeof AttivitaLookahead>

  @belongsTo(() => Elaborato)
  declare elaborato: BelongsTo<typeof Elaborato>

  @belongsTo(() => Utente, { foreignKey: 'lastPlannerId' })
  declare lastPlanner: BelongsTo<typeof Utente>

  @belongsTo(() => CausaNonCompletamento, { foreignKey: 'causaId' })
  declare causa: BelongsTo<typeof CausaNonCompletamento>
}
