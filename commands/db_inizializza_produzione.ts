/**
 * node ace db:inizializza-produzione
 *
 * Prepara il database del server: esegue le migrazioni mancanti e inserisce
 * la configurazione iniziale (seeder "produzione": discipline, stati e pesi,
 * colonne e WIP, cause, impostazioni). Nessuna commessa, nessun utente.
 *
 * Si può rilanciare quante volte si vuole (installazione e ogni
 * aggiornamento): non cancella e non modifica dati esistenti, aggiunge solo
 * quello che manca. Non esiste un'opzione per svuotare il database: per
 * ripartire da zero si usa ripristino.ps1 o si ricrea il DB a mano.
 *
 * Rifiuta di proseguire se nel database ci sono i dati di esempio dello
 * sviluppo (utenti @climosfera.example), per non mescolarli ai dati reali.
 */
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/** Dominio email dei dati di esempio (database/dati_esempio.ts) */
const DOMINIO_ESEMPIO = '@climosfera.example'

export default class DbInizializzaProduzione extends BaseCommand {
  static commandName = 'db:inizializza-produzione'
  static description =
    'Migrazioni + configurazione iniziale del server (idempotente, non cancella dati)'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Esegue solo le migrazioni, senza configurazione iniziale' })
  declare soloMigrazioni?: boolean

  async run() {
    const db = await this.app.container.make('lucid.db')
    const conn = db.manager.get(db.primaryConnectionName)?.config.connection as
      { host?: string; port?: number; database?: string; user?: string } | undefined
    this.logger.info(
      `Database: ${conn?.database ?? '?'} su ${conn?.host ?? '?'}:${conn?.port ?? '?'} ` +
        `(utente ${conn?.user ?? '?'}), NODE_ENV=${this.app.nodeEnvironment}`
    )

    // 1. Migrazioni (solo quelle mancanti; nessun rollback, nessun "fresh")
    const migrazioni = await this.kernel.exec('migration:run', ['--force', '--no-schema-generate'])
    if (migrazioni.exitCode) {
      this.logger.error('Migrazioni non riuscite: nessuna configurazione inserita.')
      this.exitCode = 1
      return
    }

    // 2. Rifiuto se ci sono i dati di esempio dello sviluppo
    const esempio = await db
      .from('utenti')
      .whereILike('email', `%${DOMINIO_ESEMPIO}`)
      .count('* as totale')
      .first()
    if (Number(esempio?.totale ?? 0) > 0) {
      this.logger.error(
        `Nel database ci sono ${esempio!.totale} utenti di esempio (${DOMINIO_ESEMPIO}): ` +
          'questo non è un database di produzione. Il comando non cancella dati: ' +
          'usa un database nuovo (vedi docs/installazione/guida-it-windows-server-2019.md).'
      )
      this.exitCode = 1
      return
    }

    if (this.soloMigrazioni) {
      this.logger.success('Migrazioni aggiornate.')
      return
    }

    // 3. Configurazione iniziale, tutta in una transazione
    const { seminaConfigurazioneProduzione } =
      await import('#database/seeders/produzione/configurazione_seeder')
    const esito = await db.transaction((trx) => seminaConfigurazioneProduzione(trx))

    for (const t of esito.tabelle) {
      this.logger.log(
        `  ${t.tabella.padEnd(26)} aggiunte ${String(t.aggiunte).padStart(2)}, già presenti ${String(t.presenti).padStart(2)}`
      )
    }
    for (const d of esito.differenze) this.logger.warning(d)

    const [utenti, commesse, admin] = await Promise.all([
      db.from('utenti').count('* as n').first(),
      db.from('commesse').count('* as n').first(),
      db.from('utenti').where('ruolo', 'admin').where('attivo', true).count('* as n').first(),
    ])
    this.logger.log(
      `  Nel database: ${utenti?.n ?? 0} utenti (${admin?.n ?? 0} admin attivi), ${commesse?.n ?? 0} commesse.`
    )
    if (Number(admin?.n ?? 0) === 0) {
      this.logger.info(
        'Nessun amministratore: crealo con node ace utenti:crea-admin --email ... --nome "..."'
      )
    }
    this.logger.success('Database pronto.')
  }
}
