import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import MembroCommessa from '#models/membro_commessa'
import type Commessa from '#models/commessa'
import { aggiornaConVersione } from '#shared/optimistic'
import { istantaneaPerAudit, registraAudit } from '#shared/audit'
import { pubblica } from '#shared/eventi'
import { RUOLI_COMMESSA } from '#domain/types'
import { Campi, eViolazioneUnicita } from './validazione.js'
import {
  commessaModificabile,
  frammentoConflitto,
  ip,
  MEMBRI_CONSIGLIATI,
  rispondiPannello,
} from './pagina.js'

/** Team della commessa (membri_commessa) */
export default class TeamController {
  /** Aggiunge un membro con il suo ruolo di commessa */
  async aggiungi(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const campi = new Campi(ctx.request.all())
    const utenteId = campi.id('utente_id', 'Persona', { obbligatorio: true })
    const ruolo = campi.scelta('ruolo_commessa', 'Ruolo', RUOLI_COMMESSA, { obbligatorio: true })
    if (utenteId !== null) {
      const u = await db.from('utenti').where('id', utenteId).where('attivo', true).first()
      if (!u) campi.errore('utente_id', 'Persona: utente inesistente o disattivato.')
      const gia = await db
        .from('membri_commessa')
        .where('commessa_id', commessa.id)
        .where('utente_id', utenteId)
        .first()
      if (gia) campi.errore('utente_id', 'Persona: fa già parte del team.')
    }
    if (!campi.valido) {
      return rispondiPannello(
        ctx,
        'team',
        commessa,
        { errori: campi.errori, rigaId: null, valori: ctx.request.all() },
        422
      )
    }

    try {
      await db.transaction(async (trx) => {
        const membro = await MembroCommessa.create(
          { commessaId: commessa.id, utenteId: utenteId!, ruoloCommessa: ruolo! },
          { client: trx }
        )
        await registraAudit(
          {
            utenteId: utente.id,
            azione: 'membro.aggiunto',
            entita: 'membri_commessa',
            entitaId: membro.id,
            commessaId: commessa.id,
            dopo: istantaneaPerAudit(membro),
            ip: ip(ctx),
          },
          trx
        )
      })
    } catch (errore) {
      if (!eViolazioneUnicita(errore)) throw errore
      return rispondiPannello(
        ctx,
        'team',
        commessa,
        { errori: { utente_id: 'Persona: fa già parte del team.' }, rigaId: null },
        422
      )
    }
    pubblica(commessa.id, 'commessa.aggiornata')
    const numero = await this.numeroMembri(commessa)
    const messaggio =
      numero > MEMBRI_CONSIGLIATI
        ? `Membro aggiunto. Attenzione: il team ha ${numero} persone (consigliato al massimo ${MEMBRI_CONSIGLIATI}).`
        : 'Membro aggiunto al team'
    return rispondiPannello(ctx, 'team', commessa, { messaggio })
  }

  /** Cambia il ruolo di commessa di un membro */
  async aggiorna(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const membro = await this.membro(ctx, commessa)
    const campi = new Campi(ctx.request.all())
    const versione = campi.versione()
    const ruolo = campi.scelta('ruolo_commessa', 'Ruolo', RUOLI_COMMESSA, { obbligatorio: true })
    if (!campi.valido) {
      return rispondiPannello(
        ctx,
        'team',
        commessa,
        { errori: campi.errori, rigaId: membro.id, valori: ctx.request.all() },
        422
      )
    }
    await aggiornaConVersione(
      MembroCommessa,
      membro.id,
      versione,
      { ruoloCommessa: ruolo! },
      {
        audit: {
          utenteId: utente.id,
          azione: 'membro.ruolo_cambiato',
          commessaId: commessa.id,
          ip: ip(ctx),
        },
        rendiFrammento: frammentoConflitto(ctx, 'team', commessa),
      }
    )
    pubblica(commessa.id, 'commessa.aggiornata')
    return rispondiPannello(ctx, 'team', commessa, { messaggio: 'Ruolo aggiornato' })
  }

  /** Toglie un membro dal team (controllo di versione) */
  async rimuovi(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const membro = await this.membro(ctx, commessa)
    const campi = new Campi(ctx.request.all())
    const versione = campi.versione()
    await db.transaction(async (trx) => {
      const riga = await aggiornaConVersione(
        MembroCommessa,
        membro.id,
        versione,
        {},
        { client: trx, rendiFrammento: frammentoConflitto(ctx, 'team', commessa) }
      )
      await riga.useTransaction(trx).delete()
      await registraAudit(
        {
          utenteId: utente.id,
          azione: 'membro.rimosso',
          entita: 'membri_commessa',
          entitaId: membro.id,
          commessaId: commessa.id,
          prima: istantaneaPerAudit(membro),
          ip: ip(ctx),
        },
        trx
      )
    })
    pubblica(commessa.id, 'commessa.aggiornata')
    return rispondiPannello(ctx, 'team', commessa, { messaggio: 'Membro tolto dal team' })
  }

  private async membro(ctx: HttpContext, commessa: Commessa) {
    const membro = await MembroCommessa.query()
      .where('id', Number(ctx.params.membroId))
      .where('commessa_id', commessa.id)
      .first()
    if (!membro) return ctx.response.abort('Membro non trovato', 404)
    return membro
  }

  private async numeroMembri(commessa: Commessa) {
    const [r] = await db.from('membri_commessa').where('commessa_id', commessa.id).count('* as n')
    return Number(r.n)
  }
}
