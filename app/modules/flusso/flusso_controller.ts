import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import type Commessa from '#models/commessa'
import Elaborato from '#models/elaborato'
import { commessaCorrente } from '#shared/commessa_corrente'
import { leggiImpostazione } from '#shared/impostazioni'
import { aggiungiSettimane, lunediDellaSettimana, oggiRoma } from '#shared/calendario'
import CambioStatoService, {
  ElaboratoNonTrovato,
  PassaggioNonAmmesso,
  WipDaConfermare,
} from './cambio_stato_service.js'
import { configurazioneFlusso, type StatoFlusso } from './stati.js'
import { riepilogoFlusso, serieCfd, SETTIMANE_STORICO } from './queries.js'
import { graficoCfd } from './grafico_cfd.js'
import { spostaElaborati } from './permessi.js'
import { ETICHETTE_CLASSE } from './etichette.js'

const validatoreSpostamento = vine.create(
  vine.object({
    version: vine.number().withoutDecimals().min(1),
    verso: vine.enum(['avanti', 'indietro']).optional(),
    colonna: vine.number().withoutDecimals().optional(),
    a_stato_id: vine.number().withoutDecimals().optional(),
    motivo: vine.string().trim().maxLength(1000).optional(),
    conferma_wip: vine.string().optional(),
  })
)

/** Dati aggiuntivi per il frammento del Kanban (messaggi e conferme) */
interface Extra {
  errore?: string
  conflitto?: string
  confermaWip?: {
    messaggio: string
    elaboratoId: number
    codice: string
    version: number
    aStatoId: number
    aStatoNome: string
    motivo: string | null
  }
}

/** Kanban degli elaborati: board, WIP, età, throughput, cycle time e CFD */
export default class FlussoController {
  /** Dati completi della vista (una lettura per blocco, niente N+1) */
  private async dati(ctx: HttpContext, commessa: Commessa, extra: Extra = {}) {
    const oggi = oggiRoma()
    // In sequenza: nei test tutte le query condividono una sola connessione
    const riepilogo = await riepilogoFlusso(commessa.id, oggi)
    const giorniFermo = await leggiImpostazione('flusso.giorni_elaborato_fermo')
    const puoSpostare = await ctx.bouncer.allows(spostaElaborati, commessa)
    const conf = await configurazioneFlusso(commessa.id)
    const dal = aggiungiSettimane(lunediDellaSettimana(oggi), -(SETTIMANE_STORICO - 1))
    const serie = await serieCfd(commessa.id, dal, oggi)
    const grafico = graficoCfd(serie.colonne, serie.punti)
    const massimoThroughput = Math.max(1, ...riepilogo.throughput.map((t) => t.conteggio))
    const emessiPeriodo = riepilogo.throughput.reduce((s, t) => s + t.conteggio, 0)
    const inLavorazione = riepilogo.colonne.slice(1, -1).reduce((s, c) => s + c.schede.length, 0)
    const fermi = riepilogo.colonne
      .flatMap((c) => c.schede)
      .filter((s) => s.etaGiorni !== null && s.etaGiorni >= giorniFermo).length
    return {
      commessa,
      riepilogo,
      giorniFermo,
      puoSpostare,
      grafico,
      massimoThroughput,
      emessiPeriodo,
      inLavorazione,
      fermi,
      oggi,
      primoStatoId: conf.stati[0]?.id ?? null,
      ultimoStatoId: conf.stati[conf.stati.length - 1]?.id ?? null,
      etichetteClasse: ETICHETTE_CLASSE,
      ...extra,
    }
  }

  async kanban(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'kanban')
    return ctx.view.render('modules/flusso/kanban', await this.dati(ctx, commessa))
  }

  /** Frammento aggiornato (tempo reale, polling, annulla conferma) */
  async frammento(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'kanban')
    return ctx.view.render('modules/flusso/_flusso', await this.dati(ctx, commessa))
  }

  /** Risposta: frammento per HTMX, pagina intera altrimenti */
  private async rispondi(ctx: HttpContext, commessa: Commessa, status: number, extra: Extra) {
    const dati = await this.dati(ctx, commessa, extra)
    const htmx = ctx.request.header('hx-request') === 'true'
    ctx.response.status(status)
    return ctx.view.render(htmx ? 'modules/flusso/_flusso' : 'modules/flusso/kanban', dati)
  }

  /**
   * Sposta un elaborato: `verso` avanti/indietro (frecce), `colonna` (drag&drop)
   * oppure `a_stato_id` (conferma dello sforamento WIP).
   */
  async sposta(ctx: HttpContext) {
    const { request, response, auth, bouncer, params } = ctx
    const commessa = await commessaCorrente(ctx, 'kanban')
    // 403 esplicito: con authorize() una POST da form verrebbe rediretta indietro
    if (!(await bouncer.allows(spostaElaborati, commessa))) {
      return response.abort(
        'Non hai il permesso di spostare gli elaborati di questa commessa.',
        403
      )
    }
    const utente = auth.getUserOrFail()
    const dati = await request.validateUsing(validatoreSpostamento)
    const motivo = dati.motivo ?? null

    const elaborato = await Elaborato.query()
      .where('id', Number(params.elaboratoId))
      .where('commessa_id', commessa.id)
      .first()
    if (!elaborato) throw new ElaboratoNonTrovato()

    const conf = await configurazioneFlusso(commessa.id)
    const attuale = conf.statoPerId.get(elaborato.statoId)
    if (!attuale) {
      return this.rispondi(ctx, commessa, 422, { errore: 'Lo stato attuale non è configurato.' })
    }

    let destinazione: StatoFlusso | undefined
    if (dati.a_stato_id !== undefined) {
      destinazione = conf.statoPerId.get(dati.a_stato_id)
    } else if (dati.verso !== undefined) {
      const posizione = attuale.posizione + (dati.verso === 'avanti' ? 1 : -1)
      destinazione = conf.stati[posizione]
      if (!destinazione) {
        return this.rispondi(ctx, commessa, 422, {
          errore:
            dati.verso === 'avanti'
              ? `${elaborato.codice} è già nell'ultimo stato.`
              : `${elaborato.codice} è già nel primo stato.`,
        })
      }
    } else if (dati.colonna !== undefined) {
      if (dati.colonna === attuale.colonnaId) {
        return this.rispondi(ctx, commessa, 200, {})
      }
      const dopo = conf.stati[attuale.posizione + 1]
      const prima = conf.stati[attuale.posizione - 1]
      if (dopo && dopo.colonnaId === dati.colonna) destinazione = dopo
      else if (prima && prima.colonnaId === dati.colonna) destinazione = prima
      else {
        const suggerimento =
          dopo && dopo.colonnaId === attuale.colonnaId
            ? ` Prima completa lo stato "${dopo.nome}" con la freccia →.`
            : ''
        return this.rispondi(ctx, commessa, 422, {
          errore: `${elaborato.codice}: si sposta uno stato alla volta.${suggerimento}`,
        })
      }
    }
    if (!destinazione) {
      return this.rispondi(ctx, commessa, 422, { errore: 'Stato di destinazione non valido.' })
    }

    try {
      const esito = await CambioStatoService.cambia({
        elaboratoId: elaborato.id,
        commessaId: commessa.id,
        versioneAttesa: dati.version,
        aStatoId: destinazione.id,
        motivo,
        confermaWip: dati.conferma_wip === '1' || dati.conferma_wip === 'on',
        utenteId: utente.id,
        ip: request.ip(),
        rendiFrammento: async (_attuale, messaggio) => {
          const d = await this.dati(ctx, commessa, { conflitto: messaggio })
          return ctx.view.render('modules/flusso/_flusso', d)
        },
      })
      const testo =
        `${esito.elaborato.codice}: ${esito.aStato.nome.toLowerCase()}` +
        (esito.wipSforato ? ' (limite WIP superato)' : '')
      response.header('HX-Trigger', JSON.stringify({ toast: testo }))
      if (request.header('hx-request') !== 'true') {
        return response.redirect(`/commesse/${commessa.id}/flusso`)
      }
      return this.rispondi(ctx, commessa, 200, {})
    } catch (errore) {
      if (errore instanceof WipDaConfermare) {
        return this.rispondi(ctx, commessa, 422, {
          confermaWip: {
            messaggio: errore.message,
            elaboratoId: elaborato.id,
            codice: elaborato.codice,
            version: dati.version,
            aStatoId: errore.aStato.id,
            aStatoNome: errore.aStato.nome,
            motivo,
          },
        })
      }
      if (errore instanceof PassaggioNonAmmesso) {
        return this.rispondi(ctx, commessa, 422, {
          errore: `${elaborato.codice}: ${errore.message}`,
        })
      }
      throw errore
    }
  }
}
