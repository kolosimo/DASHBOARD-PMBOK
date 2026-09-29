/**
 * Amministratore iniziale per l'installazione sul server (comando
 * `node ace utenti:crea-admin`). Crea l'utente con password temporanea;
 * con `reimposta` un utente già esistente torna admin attivo, sbloccato e
 * con una nuova password temporanea (recupero se l'admin l'ha persa).
 */
import db from '@adonisjs/lucid/services/db'
import Utente from '#models/utente'
import { registraAudit, istantaneaPerAudit } from '#shared/audit'
import { EmailGiaUsata, creaUtenteLocale, emailValida, normalizzaEmail } from './account_locali.js'
import { calcolaHash, generaPasswordTemporanea } from './password.js'

export class DatiAdminNonValidi extends Error {}

export async function creaAdminIniziale(opz: {
  email: string
  nome?: string
  reimposta?: boolean
}): Promise<{ utente: Utente; password: string; creato: boolean }> {
  const email = normalizzaEmail(opz.email)
  if (!emailValida(email)) throw new DatiAdminNonValidi(`Email non valida: "${opz.email}".`)
  const nome = (opz.nome ?? '').trim()

  return db.transaction(async (trx) => {
    const esistente = await Utente.query({ client: trx }).where('email', email).forUpdate().first()
    if (!esistente) {
      if (!nome) throw new DatiAdminNonValidi('Indica il nome con --nome "Nome Cognome".')
      const { utente, password } = await creaUtenteLocale({
        email,
        nome,
        ruolo: 'admin',
        creatoDa: null,
        client: trx,
      })
      return { utente, password, creato: true }
    }
    if (!opz.reimposta) throw new EmailGiaUsata()

    const prima = istantaneaPerAudit(esistente)
    const password = generaPasswordTemporanea()
    esistente.useTransaction(trx)
    esistente.merge({
      ruolo: 'admin',
      attivo: true,
      passwordHash: await calcolaHash(password),
      deveCambiarePassword: true,
      tentativiFalliti: 0,
      bloccatoFino: null,
      version: esistente.version + 1,
    })
    if (nome) esistente.nome = nome
    await esistente.save()
    await registraAudit(
      {
        utenteId: null,
        azione: 'utente.admin_reimpostato_da_console',
        entita: 'utenti',
        entitaId: esistente.id,
        prima,
        dopo: istantaneaPerAudit(esistente),
      },
      trx
    )
    return { utente: esistente, password, creato: false }
  })
}
