import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { RuoloGlobale } from '#domain/types'
import MembroCommessa from '#models/membro_commessa'
import RegistrazioneOre from '#models/registrazione_ore'

export default class Utente extends BaseModel {
  static table = 'utenti'

  @column({ isPrimary: true })
  declare id: number

  /** Sempre in minuscolo */
  @column()
  declare email: string

  @column()
  declare nome: string

  @column()
  declare ruolo: RuoloGlobale

  @column()
  declare attivo: boolean

  @column({ serializeAs: null })
  declare oidcIssuer: string | null

  @column({ serializeAs: null })
  declare oidcSub: string | null

  @column.dateTime()
  declare ultimoAccesso: DateTime | null

  /** Hash scrypt della password (account locali): mai serializzato né in audit */
  @column({ serializeAs: null })
  declare passwordHash: string | null

  /** Al prossimo accesso l'utente deve scegliere una nuova password */
  @column()
  declare deveCambiarePassword: boolean

  @column({ serializeAs: null })
  declare tentativiFalliti: number

  /** Accesso locale bloccato fino a questo istante (troppi tentativi falliti) */
  @column.dateTime()
  declare bloccatoFino: DateTime | null

  @column()
  declare version: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => MembroCommessa)
  declare appartenenze: HasMany<typeof MembroCommessa>

  @hasMany(() => RegistrazioneOre)
  declare registrazioniOre: HasMany<typeof RegistrazioneOre>

  /** true se l'accesso locale è bloccato in questo momento */
  get bloccato() {
    return this.bloccatoFino !== null && this.bloccatoFino > DateTime.now()
  }

  /** true se ha una password locale impostata */
  get haPassword() {
    return Boolean(this.passwordHash)
  }

  get isAdmin() {
    return this.ruolo === 'admin'
  }

  /** Iniziali per l'avatar in testata */
  get iniziali() {
    const parti = this.nome.split(/\s+/).filter(Boolean)
    const prima = parti[0]?.charAt(0) ?? ''
    const ultima = parti.length > 1 ? (parti[parti.length - 1]?.charAt(0) ?? '') : ''
    return `${prima}${ultima}`.toUpperCase()
  }
}
