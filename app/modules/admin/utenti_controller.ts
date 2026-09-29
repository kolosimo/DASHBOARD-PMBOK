import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Utente from '#models/utente'
import { aggiornaConVersione } from '#shared/optimistic'
import { RUOLI_GLOBALI } from '#domain/types'
import { Campi, eViolazioneUnicita } from '#modules/anagrafiche/validazione'
import type { Errori } from '#modules/anagrafiche/validazione'
import {
  EmailGiaUsata,
  creaUtenteLocale,
  emailValida,
  normalizzaEmail,
  reimpostaPassword,
  sbloccaUtente,
} from '#modules/accesso/account_locali'
import { accessoLocaleAttivo } from '#modules/accesso/modalita'
import { elencoUtenti } from './queries.js'
import { datiPagina, rispondiRiga, soloAdmin } from './comune.js'

const PARZIALE = 'modules/admin/_utente'

interface StatoRiga {
  id: number
  errori?: Errori
  passwordTemporanea?: string
  messaggio?: string
}

interface NuovoUtente {
  valori: Record<string, string>
  errori: Errori
  creato?: { nome: string; email: string; password: string }
}

/**
 * Utenti e ruoli globali. Con Microsoft 365 gli utenti si creano da soli al
 * primo accesso; con gli account locali (pilota) li crea l'amministratore con
 * una password temporanea mostrata una sola volta. Qui si cambiano ruolo e
 * stato attivo, si reimposta la password e si sblocca un account.
 */
export default class UtentiController {
  async index(ctx: HttpContext) {
    const io = await soloAdmin(ctx)
    return this.pagina(ctx, io.id)
  }

  /** Nuovo utente con password temporanea (cambio obbligatorio al primo accesso) */
  async crea(ctx: HttpContext) {
    const io = await soloAdmin(ctx)
    const campi = new Campi(ctx.request.all())
    const email = normalizzaEmail(campi.grezzo('email'))
    const nome = campi.testo('nome', 'Nome', { obbligatorio: true, max: 200 })
    const ruolo = campi.scelta('ruolo', 'Ruolo', RUOLI_GLOBALI, { obbligatorio: true })
    if (!email) campi.errore('email', 'Email: campo obbligatorio.')
    else if (!emailValida(email)) campi.errore('email', 'Email: indirizzo non valido.')

    const valori = { email, nome: campi.grezzo('nome'), ruolo: campi.grezzo('ruolo') }
    if (campi.valido) {
      try {
        const { utente, password } = await creaUtenteLocale({
          email,
          nome: nome!,
          ruolo: ruolo!,
          creatoDa: io.id,
          ip: ctx.request.ip(),
        })
        return this.pagina(ctx, io.id, undefined, {
          valori: {},
          errori: {},
          creato: { nome: utente.nome, email: utente.email, password },
        })
      } catch (errore) {
        if (errore instanceof EmailGiaUsata || eViolazioneUnicita(errore)) {
          campi.errore('email', new EmailGiaUsata().message)
        } else {
          throw errore
        }
      }
    }
    ctx.response.status(422)
    return this.pagina(ctx, io.id, undefined, { valori, errori: campi.errori })
  }

  /** Nuova password temporanea, mostrata una sola volta all'admin */
  async reimpostaPassword(ctx: HttpContext) {
    const io = await soloAdmin(ctx)
    const u = await Utente.find(Number(ctx.params.utenteId))
    if (!u) return ctx.response.abort('Utente non trovato', 404)
    const versione = new Campi(ctx.request.all()).versione()
    const { utente, password } = await reimpostaPassword({
      utenteId: u.id,
      versione,
      adminId: io.id,
      ip: ctx.request.ip(),
      rendiFrammento: (attuale, messaggio) =>
        this.frammento(ctx, attuale, io.id, { conflitto: messaggio }),
    })
    return this.rispostaRiga(ctx, io.id, utente, {
      id: utente.id,
      passwordTemporanea: password,
      messaggio: 'Password reimpostata',
    })
  }

  /** Sblocca un account bloccato per troppi tentativi */
  async sblocca(ctx: HttpContext) {
    const io = await soloAdmin(ctx)
    const u = await Utente.find(Number(ctx.params.utenteId))
    if (!u) return ctx.response.abort('Utente non trovato', 404)
    const versione = new Campi(ctx.request.all()).versione()
    const utente = await sbloccaUtente({
      utenteId: u.id,
      versione,
      adminId: io.id,
      ip: ctx.request.ip(),
      rendiFrammento: (attuale, messaggio) =>
        this.frammento(ctx, attuale, io.id, { conflitto: messaggio }),
    })
    return this.rispostaRiga(ctx, io.id, utente, { id: utente.id, messaggio: 'Utente sbloccato' })
  }

  async aggiorna(ctx: HttpContext) {
    const io = await soloAdmin(ctx)
    const u = await Utente.find(Number(ctx.params.utenteId))
    if (!u) return ctx.response.abort('Utente non trovato', 404)
    const campi = new Campi(ctx.request.all())
    const versione = campi.versione()
    const ruolo = campi.scelta('ruolo', 'Ruolo', RUOLI_GLOBALI, { obbligatorio: true })
    const attivo = campi.booleano('attivo')

    if (u.id === io.id && ruolo !== null && ruolo !== 'admin') {
      campi.errore('ruolo', 'Ruolo: non puoi togliere a te stesso il ruolo di amministratore.')
    }
    if (u.id === io.id && !attivo) {
      campi.errore('attivo', 'Non puoi disattivare il tuo stesso utente.')
    }
    if (u.ruolo === 'admin' && u.attivo && (ruolo !== 'admin' || !attivo)) {
      const [r] = await db
        .from('utenti')
        .where('ruolo', 'admin')
        .where('attivo', true)
        .whereNot('id', u.id)
        .count('* as n')
      if (Number(r.n) === 0) {
        campi.errore('ruolo', 'Ruolo: deve restare almeno un amministratore attivo.')
      }
    }
    if (!campi.valido) {
      return rispondiRiga(ctx, {
        parziale: PARZIALE,
        dati: this.datiRiga(u, io.id, { errori: campi.errori }),
        sezione: 'utenti',
        status: 422,
        pagina: () => this.pagina(ctx, io.id, { id: u.id, errori: campi.errori }),
      })
    }

    const aggiornato = await aggiornaConVersione(
      Utente,
      u.id,
      versione,
      { ruolo: ruolo!, attivo },
      {
        audit: {
          utenteId: io.id,
          azione: ruolo !== u.ruolo ? 'utente.ruolo_cambiato' : 'utente.aggiornato',
          ip: ctx.request.ip(),
        },
        rendiFrammento: (attuale, messaggio) =>
          this.frammento(ctx, attuale, io.id, { conflitto: messaggio }),
      }
    )
    return rispondiRiga(ctx, {
      parziale: PARZIALE,
      dati: this.datiRiga(aggiornato, io.id, { salvata: true }),
      sezione: 'utenti',
      messaggio: 'Utente salvato',
    })
  }

  private datiRiga(u: Utente, io: number, extra: Record<string, unknown> = {}) {
    return {
      u,
      ruoli: RUOLI_GLOBALI,
      io,
      errori: {},
      accessoLocale: accessoLocaleAttivo(),
      ...extra,
    }
  }

  private frammento(ctx: HttpContext, u: Utente, io: number, extra: Record<string, unknown>) {
    return ctx.view.render(PARZIALE, this.datiRiga(u, io, extra))
  }

  /**
   * Dopo reset o sblocco: frammento per HTMX (con toast); senza JavaScript la
   * pagina intera, così la password temporanea si vede una volta sola e non
   * finisce in un messaggio flash.
   */
  private async rispostaRiga(ctx: HttpContext, io: number, u: Utente, stato: StatoRiga) {
    if (ctx.request.header('hx-request') === 'true') {
      if (stato.messaggio) {
        ctx.response.header('HX-Trigger', JSON.stringify({ toast: stato.messaggio }))
      }
      return this.frammento(ctx, u, io, {
        salvata: !stato.passwordTemporanea,
        passwordTemporanea: stato.passwordTemporanea ?? null,
      })
    }
    return this.pagina(ctx, io, stato)
  }

  private async pagina(ctx: HttpContext, io: number, riga?: StatoRiga, nuovo?: NuovoUtente) {
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.view.render('modules/admin/utenti', {
      ...datiPagina('utenti'),
      utenti: await elencoUtenti(),
      ruoli: RUOLI_GLOBALI,
      io,
      riga: riga ?? null,
      nuovo: nuovo ?? { valori: {}, errori: {} },
      accessoLocale: accessoLocaleAttivo(),
      messaggio: riga?.messaggio ?? ctx.session.flashMessages.get('messaggio') ?? null,
    })
  }
}
