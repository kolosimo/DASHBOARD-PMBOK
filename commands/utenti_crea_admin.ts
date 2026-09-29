/**
 * node ace utenti:crea-admin --email mario.rossi@climosfera.it --nome "Mario Rossi"
 *
 * Crea l'amministratore iniziale con una password temporanea stampata a
 * console (una sola volta). Con --reimposta, se l'utente esiste già, gli
 * restituisce il ruolo admin e genera una nuova password temporanea.
 * Logica in app/modules/accesso/admin_iniziale.ts.
 */
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class UtentiCreaAdmin extends BaseCommand {
  static commandName = 'utenti:crea-admin'
  static description =
    "Crea l'amministratore iniziale con password temporanea (installazione sul server)"
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: "Email dell'amministratore", required: true })
  declare email: string

  @flags.string({ description: 'Nome e cognome (obbligatorio se l’utente non esiste)' })
  declare nome?: string

  @flags.boolean({
    description: 'Se l’utente esiste: lo rende admin attivo e genera una nuova password',
  })
  declare reimposta?: boolean

  async run() {
    const { creaAdminIniziale, DatiAdminNonValidi } =
      await import('#modules/accesso/admin_iniziale')
    const { EmailGiaUsata } = await import('#modules/accesso/account_locali')
    try {
      const { utente, password, creato } = await creaAdminIniziale({
        email: this.email,
        nome: this.nome,
        reimposta: this.reimposta,
      })
      this.logger.success(
        creato
          ? `Amministratore creato: ${utente.nome} <${utente.email}>`
          : `Amministratore reimpostato: ${utente.nome} <${utente.email}>`
      )
      this.logger.log('')
      this.logger.log(`  Password temporanea: ${password}`)
      this.logger.log('')
      this.logger.log(
        'Annotala ora: non verrà più mostrata. Al primo accesso su /accesso ' +
          'andrà sostituita con una password di almeno 12 caratteri.'
      )
    } catch (errore) {
      if (errore instanceof EmailGiaUsata) {
        this.logger.error(
          `Esiste già un utente con email ${this.email}. ` +
            'Usa --reimposta per renderlo admin con una nuova password temporanea.'
        )
      } else if (errore instanceof DatiAdminNonValidi) {
        this.logger.error(errore.message)
      } else {
        throw errore
      }
      this.exitCode = 1
    }
  }
}
