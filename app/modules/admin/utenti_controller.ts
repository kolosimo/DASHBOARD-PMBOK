import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Utente from '#models/utente'
import { aggiornaConVersione } from '#shared/optimistic'
import { RUOLI_GLOBALI } from '#domain/types'
import { Campi } from '#modules/anagrafiche/validazione'
import type { Errori } from '#modules/anagrafiche/validazione'
import { elencoUtenti } from './queries.js'
import { datiPagina, rispondiRiga, soloAdmin } from './comune.js'

const PARZIALE = 'modules/admin/_utente'

/**
 * Utenti e ruoli globali. Gli utenti si creano al primo accesso con Microsoft
 * 365 (modulo accesso); qui l'amministratore cambia ruolo e stato attivo.
 */
export default class UtentiController {
  async index(ctx: HttpContext) {
    const io = await soloAdmin(ctx)
    return this.pagina(ctx, io.id)
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
        dati: { u, ruoli: RUOLI_GLOBALI, io: io.id, errori: campi.errori },
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
          ctx.view.render(PARZIALE, {
            u: attuale,
            ruoli: RUOLI_GLOBALI,
            io: io.id,
            errori: {},
            conflitto: messaggio,
          }),
      }
    )
    return rispondiRiga(ctx, {
      parziale: PARZIALE,
      dati: { u: aggiornato, ruoli: RUOLI_GLOBALI, io: io.id, errori: {}, salvata: true },
      sezione: 'utenti',
      messaggio: 'Utente salvato',
    })
  }

  private async pagina(ctx: HttpContext, io: number, riga?: { id: number; errori: Errori }) {
    return ctx.view.render('modules/admin/utenti', {
      ...datiPagina('utenti'),
      utenti: await elencoUtenti(),
      ruoli: RUOLI_GLOBALI,
      io,
      riga: riga ?? null,
      messaggio: ctx.session.flashMessages.get('messaggio') ?? null,
    })
  }
}
