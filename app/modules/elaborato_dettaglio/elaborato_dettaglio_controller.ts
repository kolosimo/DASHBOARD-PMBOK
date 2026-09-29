import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import type Commessa from '#models/commessa'
import { modificaCommessa, spostaElaborati, vedeOrePerPersona } from '#abilities/main'
import { commessaCorrente } from '#shared/commessa_corrente'
import { leggiImpostazione } from '#shared/impostazioni'
import { oggiRoma } from '#shared/calendario'
import { classiServizio } from '#ui/glossario'
import CambioStatoService, {
  ElaboratoNonTrovato,
  PassaggioNonAmmesso,
  WipDaConfermare,
} from '#modules/flusso/cambio_stato_service'
import { orePerPersona, schedaElaborato } from './queries.js'

const validatoreStato = vine.create(
  vine.object({
    version: vine.number().withoutDecimals().min(1),
    a_stato_id: vine.number().withoutDecimals(),
    motivo: vine.string().trim().maxLength(1000).optional(),
    conferma_wip: vine.string().optional(),
  })
)

/** Messaggi mostrati sopra la scheda dopo un cambio di stato */
interface Extra {
  messaggio?: string
  errore?: string
  conflitto?: string
  confermaWip?: { messaggio: string; aStatoId: number; aStatoNome: string; motivo: string | null }
}

/**
 * Valore di HX-Trigger per un toast: i caratteri non ASCII vanno come \uXXXX
 * (nelle intestazioni HTTP non sono ammessi).
 */
function eventoToast(messaggio: string): string {
  return JSON.stringify({ toast: messaggio }).replace(
    /[\u007f-￿]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

/**
 * Scheda elaborato: dati, stato e storico, ore, EVM, vincoli e impegni.
 * Il cambio di stato passa dal servizio del modulo flusso (stesse regole del
 * Kanban: uno stato alla volta, motivo per tornare indietro, conferma WIP, 409).
 */
export default class ElaboratoDettaglioController {
  private async dati(ctx: HttpContext, commessa: Commessa, extra: Extra = {}) {
    const elaboratoId = Number(ctx.params.elaboratoId)
    const scheda = await schedaElaborato(commessa.id, elaboratoId, oggiRoma())
    if (!scheda) return ctx.response.abort('Elaborato non trovato', 404)
    // In sequenza: nei test tutte le query condividono una sola connessione
    const puoSpostare = await ctx.bouncer.allows(spostaElaborati, commessa)
    const puoModificare = await ctx.bouncer.allows(modificaCommessa, commessa)
    const vedePersone = await ctx.bouncer.allows(vedeOrePerPersona, commessa)
    const persone = vedePersone ? await orePerPersona(elaboratoId) : null
    const soglie = {
      spi: await leggiImpostazione('soglie.spi'),
      cpi: await leggiImpostazione('soglie.cpi'),
    }
    const giorniFermo = await leggiImpostazione('flusso.giorni_elaborato_fermo')
    return {
      commessa,
      scheda,
      puoSpostare,
      puoModificare,
      persone,
      soglie,
      giorniFermo,
      classe: classiServizio[scheda.classeServizio],
      ...extra,
    }
  }

  async show(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'kanban')
    const messaggio = ctx.session.flashMessages.get('messaggio') as string | undefined
    return ctx.view.render(
      'modules/elaborato_dettaglio/show',
      await this.dati(ctx, commessa, messaggio ? { messaggio } : {})
    )
  }

  /** Frammento aggiornato (tempo reale e polling) */
  async frammento(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'kanban')
    return ctx.view.render('modules/elaborato_dettaglio/_scheda', await this.dati(ctx, commessa))
  }

  /** Risposta: frammento per HTMX, pagina intera altrimenti */
  private async rispondi(ctx: HttpContext, commessa: Commessa, status: number, extra: Extra) {
    const dati = await this.dati(ctx, commessa, extra)
    const htmx = ctx.request.header('hx-request') === 'true'
    ctx.response.status(status)
    if (htmx && extra.errore) ctx.response.header('HX-Trigger', eventoToast(extra.errore))
    return ctx.view.render(
      htmx ? 'modules/elaborato_dettaglio/_scheda' : 'modules/elaborato_dettaglio/show',
      dati
    )
  }

  /** Cambio di stato dalla scheda, tramite il servizio del flusso */
  async cambiaStato(ctx: HttpContext) {
    const { request, response, auth, bouncer, params } = ctx
    const commessa = await commessaCorrente(ctx, 'kanban')
    // 403 esplicito: con authorize() una POST da form verrebbe rediretta indietro
    if (!(await bouncer.allows(spostaElaborati, commessa))) {
      return response.abort(
        'Non hai il permesso di cambiare lo stato degli elaborati di questa commessa.',
        403
      )
    }
    const utente = auth.getUserOrFail()
    const dati = await request.validateUsing(validatoreStato)
    const motivo = dati.motivo ?? null
    const elaboratoId = Number(params.elaboratoId)
    const url = `/commesse/${commessa.id}/elaborati/${elaboratoId}`

    try {
      const esito = await CambioStatoService.cambia({
        elaboratoId,
        commessaId: commessa.id,
        versioneAttesa: dati.version,
        aStatoId: dati.a_stato_id,
        motivo,
        confermaWip: dati.conferma_wip === '1' || dati.conferma_wip === 'on',
        utenteId: utente.id,
        ip: request.ip(),
        rendiFrammento: async (_attuale, messaggio) => {
          const d = await this.dati(ctx, commessa, { conflitto: messaggio })
          return ctx.view.render('modules/elaborato_dettaglio/_scheda', d)
        },
      })
      const testo =
        `${esito.elaborato.codice}: ${esito.aStato.nome.toLowerCase()}` +
        (esito.wipSforato ? ' (limite WIP superato)' : '')
      if (request.header('hx-request') !== 'true') {
        ctx.session.flash('messaggio', testo)
        return response.redirect(url)
      }
      response.header('HX-Trigger', eventoToast(testo))
      return this.rispondi(ctx, commessa, 200, { messaggio: testo })
    } catch (errore) {
      if (errore instanceof WipDaConfermare) {
        return this.rispondi(ctx, commessa, 422, {
          confermaWip: {
            messaggio: errore.message,
            aStatoId: errore.aStato.id,
            aStatoNome: errore.aStato.nome,
            motivo,
          },
        })
      }
      if (errore instanceof PassaggioNonAmmesso) {
        return this.rispondi(ctx, commessa, 422, { errore: errore.message })
      }
      if (errore instanceof ElaboratoNonTrovato) {
        return response.abort('Elaborato non trovato', 404)
      }
      throw errore
    }
  }
}
