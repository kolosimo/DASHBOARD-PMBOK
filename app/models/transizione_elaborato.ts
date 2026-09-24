import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Elaborato from '#models/elaborato'
import StatoElaborato from '#models/stato_elaborato'
import Utente from '#models/utente'

/** Storico del flusso: solo inserimenti */
export default class TransizioneElaborato extends BaseModel {
  static table = 'transizioni_elaborato'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare elaboratoId: number

  @column()
  declare daStatoId: number | null

  @column()
  declare aStatoId: number

  @column()
  declare utenteId: number | null

  /** Obbligatorio quando si torna indietro o si sfora il WIP */
  @column()
  declare motivo: string | null

  @column()
  declare wipSforato: boolean

  @column.dateTime({ autoCreate: true })
  declare avvenutaIl: DateTime

  @belongsTo(() => Elaborato)
  declare elaborato: BelongsTo<typeof Elaborato>

  @belongsTo(() => StatoElaborato, { foreignKey: 'daStatoId' })
  declare daStato: BelongsTo<typeof StatoElaborato>

  @belongsTo(() => StatoElaborato, { foreignKey: 'aStatoId' })
  declare aStato: BelongsTo<typeof StatoElaborato>

  @belongsTo(() => Utente)
  declare utente: BelongsTo<typeof Utente>
}
