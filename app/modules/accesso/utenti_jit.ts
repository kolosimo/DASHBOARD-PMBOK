/**
 * Creazione degli utenti al primo accesso (just-in-time).
 *
 * - si cerca l'utente per (issuer, sub), poi per email;
 * - se non esiste lo si crea con ruolo "progettista";
 * - chi è in ADMIN_EMAILS diventa admin (solo promozione, mai retrocessione);
 * - un utente disattivato non entra.
 */
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Utente from '#models/utente'
import env from '#start/env'
import { elencoEmailAdmin } from '#shared/avvio'
import { registraAudit } from '#shared/audit'
import type { ClaimsUtente } from './oidc.js'

export class AccessoNegato extends Error {}

export async function utenteDaClaims(claims: ClaimsUtente): Promise<Utente> {
  const admin = elencoEmailAdmin(env.get('ADMIN_EMAILS'))

  return db.transaction(async (trx) => {
    let utente = await Utente.query({ client: trx })
      .where('oidc_issuer', claims.issuer)
      .where('oidc_sub', claims.sub)
      .forUpdate()
      .first()

    if (!utente && claims.email) {
      utente = await Utente.query({ client: trx }).where('email', claims.email).forUpdate().first()
    }

    if (!utente) {
      if (!claims.email) {
        throw new AccessoNegato(
          "Il tuo account Microsoft non comunica un'email: contatta l'amministratore."
        )
      }
      utente = await Utente.create(
        {
          email: claims.email,
          nome: claims.nome ?? claims.email,
          ruolo: admin.includes(claims.email) ? 'admin' : 'progettista',
          attivo: true,
          oidcIssuer: claims.issuer,
          oidcSub: claims.sub,
          ultimoAccesso: DateTime.now(),
          version: 1,
        },
        { client: trx }
      )
      await registraAudit(
        {
          utenteId: utente.id,
          azione: 'utente.creato_al_primo_accesso',
          entita: 'utenti',
          entitaId: utente.id,
          dopo: { email: utente.email, ruolo: utente.ruolo },
        },
        trx
      )
      return utente
    }

    if (!utente.attivo) {
      throw new AccessoNegato("Il tuo accesso è disattivato: contatta l'amministratore.")
    }

    utente.useTransaction(trx)
    utente.oidcIssuer = claims.issuer
    utente.oidcSub = claims.sub
    utente.ultimoAccesso = DateTime.now()
    if (claims.nome && utente.nome === utente.email) utente.nome = claims.nome
    if (utente.email && admin.includes(utente.email) && utente.ruolo !== 'admin') {
      await registraAudit(
        {
          utenteId: utente.id,
          azione: 'utente.promosso_admin_da_env',
          entita: 'utenti',
          entitaId: utente.id,
          prima: { ruolo: utente.ruolo },
          dopo: { ruolo: 'admin' },
        },
        trx
      )
      utente.ruolo = 'admin'
      utente.version = utente.version + 1
    }
    await utente.save()
    return utente
  })
}
