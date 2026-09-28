import type { HttpContext } from '@adonisjs/core/http'
import type Commessa from '#models/commessa'
import { modificaCommessa } from '#abilities/main'
import { commessaCorrente } from '#shared/commessa_corrente'
import { leggiImpostazione } from '#shared/impostazioni'
import { lunediDellaSettimana, oggiRoma } from '#shared/calendario'
import {
  baselineAttiva,
  baselineInBozza,
  elencoBaseline,
  riepilogoEvm,
  righeEditor,
  serieCurvaS,
  snapshotCommessa,
  statiElaborato,
  type RigaEditor,
} from './queries.js'
import { svgCurvaS } from './curva_s.js'
import {
  aggiungiElaboratiMancanti,
  approvaBaseline,
  creaBozza,
  ErroreBaseline,
  salvaDateElaborato,
  scartaBozza,
  type CellaData,
} from './baseline_service.js'

function numeroIntero(valore: unknown): number | null {
  const n = Number(valore)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Avanzamento EVM: indicatori live, curva S dagli snapshot, baseline */
export default class EvmController {
  /** Dati della pagina (e del frammento aggiornato in tempo reale) */
  private async datiAvanzamento(commessa: Commessa) {
    const oggi = oggiRoma()
    const [riepilogo, serie, snapshot, attiva, bozza, sogliaSpi, sogliaCpi] = await Promise.all([
      riepilogoEvm(commessa.id, oggi),
      serieCurvaS(commessa.id, oggi),
      snapshotCommessa(commessa.id),
      baselineAttiva(commessa.id),
      baselineInBozza(commessa.id),
      leggiImpostazione('soglie.spi'),
      leggiImpostazione('soglie.cpi'),
    ])
    const curvaS = svgCurvaS(serie, {
      bacMinuti: riepilogo.bacMinuti,
      eacMinuti: riepilogo.eacMinuti,
      settimanaCorrente: lunediDellaSettimana(oggi),
    })
    return {
      oggi,
      riepilogo,
      serie,
      curvaS,
      snapshot: [...snapshot].reverse(),
      attiva,
      bozza,
      soglie: { spi: sogliaSpi, cpi: sogliaCpi },
    }
  }

  async show(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'evm')
    const puoModificare = await ctx.bouncer.allows(modificaCommessa, commessa)
    return ctx.view.render('modules/evm/show', {
      ...(await this.datiAvanzamento(commessa)),
      puoModificare,
    })
  }

  /** Frammento con indicatori, curva S e registri (HTMX, tempo reale) */
  async contenuto(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'evm')
    const puoModificare = await ctx.bouncer.allows(modificaCommessa, commessa)
    return ctx.view.render('modules/evm/_contenuto', {
      ...(await this.datiAvanzamento(commessa)),
      puoModificare,
    })
  }

  // -------------------------------------------------------------------------
  // Editor della baseline
  // -------------------------------------------------------------------------

  private async renderEditor(
    ctx: HttpContext,
    commessa: Commessa,
    extra: Record<string, unknown> = {}
  ) {
    const [attiva, bozza, elenco, stati] = await Promise.all([
      baselineAttiva(commessa.id),
      baselineInBozza(commessa.id),
      elencoBaseline(commessa.id),
      statiElaborato(),
    ])
    const righe: RigaEditor[] = bozza ? await righeEditor(commessa.id, bozza.id) : []
    return ctx.view.render('modules/evm/baseline', {
      attiva,
      bozza,
      baselineId: bozza?.id ?? null,
      elenco,
      stati: stati.filter((s) => s.ordine > 0),
      righe,
      mancanti: righe.filter((r) => r.mancante).length,
      ...extra,
    })
  }

  async baseline(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'evm')
    await ctx.bouncer.authorize(modificaCommessa, commessa)
    return this.renderEditor(ctx, commessa)
  }

  async creaBozza(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'evm')
    await ctx.bouncer.authorize(modificaCommessa, commessa)
    const utente = ctx.auth.getUserOrFail()
    const motivo = ctx.request.input('motivo', null) as string | null
    try {
      await creaBozza(commessa, utente.id, motivo)
    } catch (errore) {
      if (errore instanceof ErroreBaseline) {
        ctx.response.status(422)
        return this.renderEditor(ctx, commessa, { errore: errore.message, motivo })
      }
      throw errore
    }
    return ctx.response.redirect().toPath(`/commesse/${commessa.id}/evm/baseline`)
  }

  private async renderRiga(
    ctx: HttpContext,
    commessa: Commessa,
    baselineId: number,
    elaboratoId: number,
    extra: Record<string, unknown> = {}
  ) {
    const [righe, stati] = await Promise.all([
      righeEditor(commessa.id, baselineId),
      statiElaborato(),
    ])
    const riga = righe.find((r) => r.elaboratoId === elaboratoId)
    if (!riga) return ctx.response.abort('Elaborato non trovato', 404)
    return ctx.view.render('modules/evm/_riga_baseline', {
      commessa,
      baselineId,
      riga,
      stati: stati.filter((s) => s.ordine > 0),
      ...extra,
    })
  }

  async salvaRiga(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'evm')
    await ctx.bouncer.authorize(modificaCommessa, commessa)
    const utente = ctx.auth.getUserOrFail()
    const baselineId = numeroIntero(ctx.params.baselineId)
    const elaboratoId = numeroIntero(ctx.params.elaboratoId)
    if (!baselineId || !elaboratoId) return ctx.response.abort('Richiesta non valida', 404)

    const tuttiGliStati = await statiElaborato()
    const stati = tuttiGliStati.filter((s) => s.ordine > 0)
    const celle: CellaData[] = []
    for (const s of stati) {
      const data = ctx.request.input(`data_${s.id}`)
      const versione = numeroIntero(ctx.request.input(`versione_${s.id}`))
      if (data === undefined || data === null) continue
      celle.push({ statoId: s.id, data: String(data), version: versione ?? 0 })
    }

    try {
      await salvaDateElaborato(
        commessa.id,
        baselineId,
        elaboratoId,
        celle,
        utente.id,
        (_, messaggio) =>
          this.renderRiga(ctx, commessa, baselineId, elaboratoId, {
            conflitto: messaggio,
          }) as Promise<string>
      )
    } catch (errore) {
      if (errore instanceof ErroreBaseline) {
        ctx.response.status(422)
        return this.renderRiga(ctx, commessa, baselineId, elaboratoId, { errore: errore.message })
      }
      throw errore
    }
    ctx.response.header('HX-Trigger', JSON.stringify({ toast: 'Date salvate' }))
    return this.renderRiga(ctx, commessa, baselineId, elaboratoId, { salvata: true })
  }

  async aggiungiMancanti(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'evm')
    await ctx.bouncer.authorize(modificaCommessa, commessa)
    const utente = ctx.auth.getUserOrFail()
    const baselineId = numeroIntero(ctx.params.baselineId)
    if (!baselineId) return ctx.response.abort('Richiesta non valida', 404)
    try {
      await aggiungiElaboratiMancanti(commessa, baselineId, utente.id)
    } catch (errore) {
      if (errore instanceof ErroreBaseline) {
        ctx.response.status(422)
        return this.renderEditor(ctx, commessa, { errore: errore.message })
      }
      throw errore
    }
    return ctx.response.redirect().toPath(`/commesse/${commessa.id}/evm/baseline`)
  }

  async approva(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'evm')
    await ctx.bouncer.authorize(modificaCommessa, commessa)
    const utente = ctx.auth.getUserOrFail()
    const baselineId = numeroIntero(ctx.params.baselineId)
    const versione = numeroIntero(ctx.request.input('version'))
    if (!baselineId || !versione) return ctx.response.abort('Richiesta non valida', 404)
    try {
      await approvaBaseline(commessa, baselineId, versione, utente.id)
    } catch (errore) {
      if (errore instanceof ErroreBaseline) {
        ctx.response.status(422)
        return this.renderEditor(ctx, commessa, { errore: errore.message })
      }
      throw errore
    }
    return ctx.response.redirect().toPath(`/commesse/${commessa.id}/evm`)
  }

  async scarta(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'evm')
    await ctx.bouncer.authorize(modificaCommessa, commessa)
    const utente = ctx.auth.getUserOrFail()
    const baselineId = numeroIntero(ctx.params.baselineId)
    const versione = numeroIntero(ctx.request.input('version'))
    if (!baselineId || !versione) return ctx.response.abort('Richiesta non valida', 404)
    try {
      await scartaBozza(commessa.id, baselineId, versione, utente.id)
    } catch (errore) {
      if (errore instanceof ErroreBaseline) {
        ctx.response.status(422)
        return this.renderEditor(ctx, commessa, { errore: errore.message })
      }
      throw errore
    }
    return ctx.response.redirect().toPath(`/commesse/${commessa.id}/evm/baseline`)
  }
}
