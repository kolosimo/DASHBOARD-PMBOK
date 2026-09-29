/**
 * Account locali (email + password) per il pilota.
 *
 * - verifica delle credenziali con blocco dopo MAX_TENTATIVI errori per
 *   MINUTI_BLOCCO minuti; i messaggi non rivelano se l'email esiste;
 * - creazione di un utente con password temporanea (admin e comando ace);
 * - reset della password e sblocco (admin).
 *
 * I contatori dei tentativi e l'ultimo accesso sono campi di sistema: si
 * aggiornano senza incrementare `version`, come fa il login Microsoft 365,
 * così un modulo aperto dall'admin non va in conflitto per un login.
 */
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Utente from '#models/utente'
import type { RuoloGlobale } from '#domain/types'
import { registraAudit } from '#shared/audit'
import { aggiornaConVersione, type RendiFrammento } from '#shared/optimistic'
import { calcolaHash, generaPasswordTemporanea, verificaPassword } from './password.js'
import { limitePerEmailSconosciuta } from './limitatore.js'

export const MAX_TENTATIVI = 5
export const MINUTI_BLOCCO = 15

export const MESSAGGIO_CREDENZIALI = 'Email o password non corretti.'
export const MESSAGGIO_BLOCCO =
  `Troppi tentativi non riusciti: l'accesso è sospeso per ${MINUTI_BLOCCO} minuti. ` +
  "Riprova più tardi o chiedi all'amministratore di sbloccarlo."
export const MESSAGGIO_DISATTIVATO = "Il tuo accesso è disattivato: contatta l'amministratore."

export type EsitoLogin =
  | { esito: 'ok'; utente: Utente }
  | { esito: 'ko' }
  | { esito: 'bloccato' }
  | { esito: 'disattivato' }

export function normalizzaEmail(valore: unknown): string {
  return typeof valore === 'string' ? valore.trim().toLowerCase() : ''
}

/** Controllo di forma dell'email (volutamente semplice) */
export function emailValida(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Verifica email e password. In caso di successo azzera i tentativi; in caso
 * di errore li incrementa e, al quinto, blocca l'account per 15 minuti.
 */
export async function verificaCredenziali(
  emailGrezza: unknown,
  password: string,
  ip: string | null
): Promise<EsitoLogin> {
  const email = normalizzaEmail(emailGrezza)

  const esito = await db.transaction(async (trx): Promise<EsitoLogin> => {
    const utente = email
      ? await Utente.query({ client: trx }).where('email', email).forUpdate().first()
      : null

    // Email sconosciuta o account senza password: stessi tempi e stessi messaggi
    if (!utente || !utente.passwordHash) {
      if (limitePerEmailSconosciuta.superato(email)) return { esito: 'bloccato' }
      await verificaPassword(null, password)
      const n = limitePerEmailSconosciuta.registra(email)
      return n >= MAX_TENTATIVI ? { esito: 'bloccato' } : { esito: 'ko' }
    }

    if (utente.bloccato) return { esito: 'bloccato' }

    const corretta = await verificaPassword(utente.passwordHash, password)
    utente.useTransaction(trx)

    if (!corretta) {
      const tentativi = utente.tentativiFalliti + 1
      if (tentativi >= MAX_TENTATIVI) {
        utente.tentativiFalliti = 0
        utente.bloccatoFino = DateTime.now().plus({ minutes: MINUTI_BLOCCO })
        await utente.save()
        await registraAudit(
          {
            utenteId: utente.id,
            azione: 'accesso.bloccato',
            entita: 'utenti',
            entitaId: utente.id,
            dopo: { bloccatoFino: utente.bloccatoFino.toISO(), tentativi },
            ip,
          },
          trx
        )
        return { esito: 'bloccato' }
      }
      utente.tentativiFalliti = tentativi
      await utente.save()
      await registraAudit(
        {
          utenteId: utente.id,
          azione: 'accesso.locale_fallito',
          entita: 'utenti',
          entitaId: utente.id,
          dopo: { tentativi },
          ip,
        },
        trx
      )
      return { esito: 'ko' }
    }

    utente.tentativiFalliti = 0
    utente.bloccatoFino = null
    if (!utente.attivo) {
      await utente.save()
      return { esito: 'disattivato' }
    }
    if (hash.needsReHash(utente.passwordHash)) {
      utente.passwordHash = await calcolaHash(password)
    }
    if (!utente.deveCambiarePassword) utente.ultimoAccesso = DateTime.now()
    await utente.save()
    await registraAudit(
      {
        utenteId: utente.id,
        azione: 'accesso.locale',
        entita: 'utenti',
        entitaId: utente.id,
        ip,
      },
      trx
    )
    return { esito: 'ok', utente }
  })

  return esito
}

export class EmailGiaUsata extends Error {
  constructor() {
    super('Email: esiste già un utente con questa email.')
  }
}

/**
 * Crea un utente con password temporanea (da cambiare al primo accesso).
 * Restituisce la password in chiaro: va mostrata una sola volta.
 */
export async function creaUtenteLocale(dati: {
  email: string
  nome: string
  ruolo: RuoloGlobale
  creatoDa: number | null
  ip?: string | null
  client?: TransactionClientContract
}): Promise<{ utente: Utente; password: string }> {
  const password = generaPasswordTemporanea()
  const passwordHash = await calcolaHash(password)
  const esegui = async (trx: TransactionClientContract) => {
    const esistente = await Utente.query({ client: trx }).where('email', dati.email).first()
    if (esistente) throw new EmailGiaUsata()
    const utente = await Utente.create(
      {
        email: dati.email,
        nome: dati.nome,
        ruolo: dati.ruolo,
        attivo: true,
        passwordHash,
        deveCambiarePassword: true,
        tentativiFalliti: 0,
        bloccatoFino: null,
        version: 1,
      },
      { client: trx }
    )
    await registraAudit(
      {
        utenteId: dati.creatoDa,
        azione: 'utente.creato_locale',
        entita: 'utenti',
        entitaId: utente.id,
        dopo: { email: utente.email, nome: utente.nome, ruolo: utente.ruolo },
        ip: dati.ip ?? null,
      },
      trx
    )
    return utente
  }
  const utente = dati.client ? await esegui(dati.client) : await db.transaction(esegui)
  return { utente, password }
}

/**
 * Reset della password da parte dell'admin: nuova password temporanea,
 * cambio obbligatorio al prossimo accesso, account sbloccato.
 */
export async function reimpostaPassword(opz: {
  utenteId: number
  versione: number
  adminId: number
  ip: string | null
  rendiFrammento?: RendiFrammento<Utente>
}): Promise<{ utente: Utente; password: string }> {
  const password = generaPasswordTemporanea()
  const passwordHash = await calcolaHash(password)
  const utente = await aggiornaConVersione(
    Utente,
    opz.utenteId,
    opz.versione,
    {
      passwordHash,
      deveCambiarePassword: true,
      tentativiFalliti: 0,
      bloccatoFino: null,
    },
    {
      audit: { utenteId: opz.adminId, azione: 'utente.password_reimpostata', ip: opz.ip },
      rendiFrammento: opz.rendiFrammento,
    }
  )
  return { utente, password }
}

/** Sblocco da parte dell'admin (azzera anche i tentativi) */
export async function sbloccaUtente(opz: {
  utenteId: number
  versione: number
  adminId: number
  ip: string | null
  rendiFrammento?: RendiFrammento<Utente>
}): Promise<Utente> {
  return aggiornaConVersione(
    Utente,
    opz.utenteId,
    opz.versione,
    { tentativiFalliti: 0, bloccatoFino: null },
    {
      audit: { utenteId: opz.adminId, azione: 'utente.sbloccato', ip: opz.ip },
      rendiFrammento: opz.rendiFrammento,
    }
  )
}

/** Nuova password scelta dall'utente (primo accesso o cambio volontario) */
export async function cambiaPassword(utente: Utente, nuova: string, ip: string | null) {
  const passwordHash = await calcolaHash(nuova)
  return aggiornaConVersione(
    Utente,
    utente.id,
    utente.version,
    {
      passwordHash,
      deveCambiarePassword: false,
      tentativiFalliti: 0,
      bloccatoFino: null,
      ultimoAccesso: DateTime.now(),
    },
    { audit: { utenteId: utente.id, azione: 'utente.password_cambiata', ip } }
  )
}
