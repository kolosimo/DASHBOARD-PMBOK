import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Milestone from '#models/milestone'
import type Commessa from '#models/commessa'
import { aggiornaConVersione } from '#shared/optimistic'
import { istantaneaPerAudit, registraAudit } from '#shared/audit'
import { pubblica } from '#shared/eventi'
import { Campi } from './validazione.js'
import { commessaModificabile, frammentoConflitto, ip, rispondiPannello } from './pagina.js'

/** Legge e valida i campi di una milestone */
function leggiCampi(dati: Record<string, unknown>) {
  const campi = new Campi(dati)
  const titolo = campi.testo('titolo', 'Titolo', { obbligatorio: true, max: 300 })
  const dataPrevista = campi.data('data_prevista', 'Data target', { obbligatorio: true })
  const dataEffettiva = campi.data('data_effettiva', 'Data effettiva')
  const ordine = campi.intero('ordine', 'Ordine', { min: 0, max: 9999 })
  const contrattuale = campi.booleano('contrattuale')
  return {
    campi,
    valori: {
      titolo: titolo!,
      dataPrevista: dataPrevista!,
      dataEffettiva,
      ordine: ordine ?? 0,
      contrattuale,
    },
  }
}

/** Milestone della commessa */
export default class MilestoneController {
  async crea(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const { campi, valori } = leggiCampi(ctx.request.all())
    if (!campi.valido) {
      return rispondiPannello(
        ctx,
        'milestone',
        commessa,
        { errori: campi.errori, rigaId: null, valori: ctx.request.all() },
        422
      )
    }
    await db.transaction(async (trx) => {
      const ms = await Milestone.create({ ...valori, commessaId: commessa.id }, { client: trx })
      await registraAudit(
        {
          utenteId: utente.id,
          azione: 'milestone.creata',
          entita: 'milestone',
          entitaId: ms.id,
          commessaId: commessa.id,
          dopo: istantaneaPerAudit(ms),
          ip: ip(ctx),
        },
        trx
      )
    })
    pubblica(commessa.id, 'commessa.aggiornata')
    return rispondiPannello(ctx, 'milestone', commessa, { messaggio: 'Milestone aggiunta' })
  }

  async aggiorna(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const ms = await this.milestone(ctx, commessa)
    const { campi, valori } = leggiCampi(ctx.request.all())
    const versione = campi.versione()
    if (!campi.valido) {
      return rispondiPannello(
        ctx,
        'milestone',
        commessa,
        { errori: campi.errori, rigaId: ms.id, valori: ctx.request.all() },
        422
      )
    }
    await aggiornaConVersione(Milestone, ms.id, versione, valori, {
      audit: {
        utenteId: utente.id,
        azione: 'milestone.aggiornata',
        commessaId: commessa.id,
        ip: ip(ctx),
      },
      rendiFrammento: frammentoConflitto(ctx, 'milestone', commessa),
    })
    pubblica(commessa.id, 'commessa.aggiornata')
    return rispondiPannello(ctx, 'milestone', commessa, { messaggio: 'Milestone salvata' })
  }

  /** Elimina una milestone: gli elaborati e le attività collegate restano senza milestone */
  async elimina(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const ms = await this.milestone(ctx, commessa)
    const campi = new Campi(ctx.request.all())
    const versione = campi.versione()
    await db.transaction(async (trx) => {
      const riga = await aggiornaConVersione(
        Milestone,
        ms.id,
        versione,
        {},
        { client: trx, rendiFrammento: frammentoConflitto(ctx, 'milestone', commessa) }
      )
      await riga.useTransaction(trx).delete()
      await registraAudit(
        {
          utenteId: utente.id,
          azione: 'milestone.eliminata',
          entita: 'milestone',
          entitaId: ms.id,
          commessaId: commessa.id,
          prima: istantaneaPerAudit(ms),
          ip: ip(ctx),
        },
        trx
      )
    })
    pubblica(commessa.id, 'commessa.aggiornata')
    return rispondiPannello(ctx, 'milestone', commessa, { messaggio: 'Milestone eliminata' })
  }

  private async milestone(ctx: HttpContext, commessa: Commessa) {
    const ms = await Milestone.query()
      .where('id', Number(ctx.params.milestoneId))
      .where('commessa_id', commessa.id)
      .first()
    if (!ms) return ctx.response.abort('Milestone non trovata', 404)
    return ms
  }
}
