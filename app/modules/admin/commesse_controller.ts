import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import MembroCommessa from '#models/membro_commessa'
import { istantaneaPerAudit, registraAudit } from '#shared/audit'
import { pubblica } from '#shared/eventi'
import { Campi, eViolazioneUnicita } from '#modules/anagrafiche/validazione'
import type { Errori } from '#modules/anagrafiche/validazione'
import { commesseVisibili, utentiAttivi } from '#modules/anagrafiche/queries'
import { datiPagina, soloAdmin } from './comune.js'

/**
 * Elenco di tutte le commesse e creazione di una commessa nuova (solo admin).
 * Dati, team e milestone si gestiscono poi nella scheda Anagrafica della commessa.
 */
export default class CommesseController {
  async index(ctx: HttpContext) {
    await soloAdmin(ctx)
    return this.pagina(ctx, {}, {})
  }

  async crea(ctx: HttpContext) {
    const io = await soloAdmin(ctx)
    const campi = new Campi(ctx.request.all())
    const codice = campi.testo('codice', 'Codice', { obbligatorio: true, max: 30 })
    const nome = campi.testo('nome', 'Nome', { obbligatorio: true, max: 300 })
    const cliente = campi.testo('cliente', 'Cliente', { max: 300 })
    const pmId = campi.id('pm_id', 'PM')
    const dataInizio = campi.data('data_inizio', 'Data di inizio')
    const dataFine = campi.data('data_fine_prevista', 'Fine prevista')
    if (dataInizio && dataFine && dataFine < dataInizio) {
      campi.errore('data_fine_prevista', 'Fine prevista: non può precedere la data di inizio.')
    }
    if (pmId !== null) {
      const pm = await db.from('utenti').where('id', pmId).where('attivo', true).first()
      if (!pm) campi.errore('pm_id', 'PM: utente inesistente o disattivato.')
    }
    if (codice && (await db.from('commesse').where('codice', codice).first())) {
      campi.errore('codice', `Codice: esiste già una commessa ${codice}.`)
    }
    if (!campi.valido) {
      ctx.response.status(422)
      return this.pagina(ctx, campi.errori, ctx.request.all())
    }

    let commessa: Commessa
    try {
      commessa = await db.transaction(async (trx) => {
        const c = await Commessa.create(
          {
            codice: codice!,
            nome: nome!,
            cliente,
            pmId,
            stato: 'attiva',
            dataInizio,
            dataFinePrevista: dataFine,
          },
          { client: trx }
        )
        await registraAudit(
          {
            utenteId: io.id,
            azione: 'commessa.creata',
            entita: 'commesse',
            entitaId: c.id,
            commessaId: c.id,
            dopo: istantaneaPerAudit(c),
            ip: ctx.request.ip(),
          },
          trx
        )
        if (pmId !== null) {
          const m = await MembroCommessa.create(
            { commessaId: c.id, utenteId: pmId, ruoloCommessa: 'pm' },
            { client: trx }
          )
          await registraAudit(
            {
              utenteId: io.id,
              azione: 'membro.aggiunto',
              entita: 'membri_commessa',
              entitaId: m.id,
              commessaId: c.id,
              dopo: istantaneaPerAudit(m),
              ip: ctx.request.ip(),
            },
            trx
          )
        }
        return c
      })
    } catch (errore) {
      if (!eViolazioneUnicita(errore)) throw errore
      ctx.response.status(422)
      return this.pagina(
        ctx,
        { codice: `Codice: esiste già una commessa ${codice}.` },
        ctx.request.all()
      )
    }
    pubblica(commessa.id, 'commessa.aggiornata')
    ctx.session.flash('messaggio', `Commessa ${commessa.codice} creata: completa team e milestone.`)
    return ctx.response.redirect(`/commesse/${commessa.id}/anagrafica`)
  }

  private async pagina(ctx: HttpContext, errori: Errori, valori: Record<string, unknown>) {
    const io = ctx.auth.getUserOrFail()
    return ctx.view.render('modules/admin/commesse', {
      ...datiPagina('commesse'),
      commesse: await commesseVisibili(io),
      utenti: await utentiAttivi(),
      errori,
      valori,
      messaggio: ctx.session.flashMessages.get('messaggio') ?? null,
    })
  }
}
