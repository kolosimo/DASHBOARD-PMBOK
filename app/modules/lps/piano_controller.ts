import type { HttpContext } from '@adonisjs/core/http'
import type Commessa from '#models/commessa'
import PianoSettimanale from '#models/piano_settimanale'
import { commessaCorrente } from '#shared/commessa_corrente'
import { pubblica } from '#shared/eventi'
import { leggiImpostazione } from '#shared/impostazioni'
import { aggiungiSettimane, lunediDellaSettimana, oggiRoma } from '#shared/calendario'
import type { Lunedi } from '#domain/types'
import {
  attivitaLookahead,
  causeNonCompletamento,
  elaboratiDellaCommessa,
  paretoCause,
  personeDelTeam,
  pianoSettimana,
  riepilogoLps,
  SETTIMANE_STORICO_PPC,
} from './queries.js'
import {
  aggiungiImpegno,
  chiudiPiano,
  creaPiano,
  eliminaImpegno,
  ErroreLps,
  impegnoConPiano,
  promettiPiano,
  segnaEsito,
} from './servizi.js'
import { scattaSnapshotLps } from './snapshot.js'
import { graficoPareto, graficoPpc } from './grafici.js'
import {
  autore,
  eHtmx,
  intestazioneTrigger,
  flashMessaggio,
  messaggioFlash,
  puoGestire,
  richiediGestione,
  settimanaRichiesta,
  valida,
  type Messaggio,
} from './contesto.js'
import { validatoreEsito, validatoreImpegno, validatoreVersione } from './validatori.js'

const VISTA = 'modules/lps/settimana'
const FRAMMENTO = 'modules/lps/_piano'

/**
 * Piano settimanale (Weekly Work Plan): bozza → promesso → chiuso, impegni con
 * last planner, esito sì/no con causa, PPC, Pareto e storico.
 */
export default class PianoController {
  /** Dati della vista (pagina e frammento HTMX) */
  private async dati(ctx: HttpContext, commessa: Commessa, settimana: Lunedi) {
    const utente = ctx.auth.getUserOrFail()
    const daPareto = aggiungiSettimane(settimana, -SETTIMANE_STORICO_PPC)
    const [
      piano,
      riepilogo,
      pareto,
      cause,
      team,
      attivita,
      elaborati,
      gestione,
      sogliaPpc,
      sogliaPcr,
    ] = await Promise.all([
      pianoSettimana(commessa.id, settimana),
      riepilogoLps(commessa.id, settimana),
      paretoCause(commessa.id, daPareto, settimana),
      causeNonCompletamento(true),
      personeDelTeam(commessa.id),
      attivitaLookahead(commessa.id, settimana, settimana),
      elaboratiDellaCommessa(commessa.id),
      puoGestire(ctx, commessa),
      leggiImpostazione('soglie.ppc'),
      leggiImpostazione('soglie.pcr'),
    ])
    const lunediCorrente = lunediDellaSettimana(oggiRoma())
    return {
      commessa,
      settimana,
      precedente: aggiungiSettimane(settimana, -1),
      successiva: aggiungiSettimane(settimana, 1),
      corrente: lunediCorrente,
      piano,
      riepilogo,
      pareto,
      daPareto,
      graficoPpc: graficoPpc(riepilogo.storicoPpc, { soglia: sogliaPpc }),
      graficoPareto: graficoPareto(pareto),
      cause,
      team,
      attivita,
      elaborati,
      puoGestire: gestione,
      utenteId: utente.id,
      sogliaPpc,
      sogliaPcr,
      urlPagina: `/commesse/${commessa.id}/lps/settimana?settimana=${settimana}`,
      base: `/commesse/${commessa.id}/lps`,
    }
  }

  private async rendiFrammento(
    ctx: HttpContext,
    commessa: Commessa,
    settimana: Lunedi,
    extra: { messaggio?: Messaggio | null; conflitto?: string } = {}
  ) {
    return ctx.view.render(FRAMMENTO, { ...(await this.dati(ctx, commessa, settimana)), ...extra })
  }

  /** Risposta a un'azione: frammento per HTMX, redirect con messaggio altrimenti */
  private async rispondi(
    ctx: HttpContext,
    commessa: Commessa,
    settimana: Lunedi,
    messaggio: Messaggio
  ) {
    if (eHtmx(ctx)) {
      if (messaggio.tipo === 'errore') ctx.response.status(422)
      else ctx.response.header('HX-Trigger', intestazioneTrigger({ toast: messaggio.testo }))
      return this.rendiFrammento(ctx, commessa, settimana, { messaggio })
    }
    flashMessaggio(ctx, messaggio)
    return ctx.response.redirect(`/commesse/${commessa.id}/lps/settimana?settimana=${settimana}`)
  }

  private async settimanaDelPiano(commessaId: number, pianoId: number): Promise<Lunedi | null> {
    const p = await PianoSettimanale.query()
      .where('id', pianoId)
      .where('commessa_id', commessaId)
      .first()
    return p?.settimana ?? null
  }

  async mostra(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'settimana')
    const settimana = settimanaRichiesta(ctx)
    return ctx.view.render(VISTA, {
      ...(await this.dati(ctx, commessa, settimana)),
      messaggio: messaggioFlash(ctx),
    })
  }

  async frammento(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'settimana')
    return this.rendiFrammento(ctx, commessa, settimanaRichiesta(ctx))
  }

  async crea(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'settimana')
    await richiediGestione(ctx, commessa)
    const settimana = String(ctx.request.input('settimana', ''))
    try {
      await creaPiano(commessa.id, settimana, autore(ctx))
    } catch (errore) {
      if (errore instanceof ErroreLps) {
        return this.rispondi(ctx, commessa, settimanaRichiesta(ctx), {
          tipo: 'errore',
          testo: errore.message,
        })
      }
      throw errore
    }
    pubblica(commessa.id, 'piano.aggiornato', { settimana })
    return this.rispondi(ctx, commessa, settimana, {
      tipo: 'ok',
      testo: 'Piano in bozza creato: aggiungi gli impegni e poi promettilo.',
    })
  }

  async aggiungiImpegno(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'settimana')
    await richiediGestione(ctx, commessa)
    const pianoId = Number(ctx.params.pianoId)
    const settimana = await this.settimanaDelPiano(commessa.id, pianoId)
    if (!settimana) return ctx.response.notFound('Piano non trovato')
    try {
      const dati = await valida(ctx, validatoreImpegno)
      const { impegno, vincoliAperti } = await aggiungiImpegno(
        commessa.id,
        pianoId,
        {
          descrizione: dati.descrizione ?? null,
          attivitaId: dati.attivita_id ?? null,
          elaboratoId: dati.elaborato_id ?? null,
          lastPlannerId: dati.last_planner_id ?? null,
        },
        autore(ctx)
      )
      pubblica(commessa.id, 'piano.aggiornato', { settimana })
      const note: string[] = []
      if (impegno.aggiuntoDopoPromessa) {
        note.push('Aggiunto dopo la promessa: non entra nel PPC.')
      }
      if (vincoliAperti.length > 0) {
        return this.rispondi(ctx, commessa, settimana, {
          tipo: 'avviso',
          testo:
            `Attenzione: l’attività è vincolata (vincoli aperti ${vincoliAperti.join(', ')}). Si promettono solo attività pronte. ${note.join(' ')}`.trim(),
        })
      }
      return this.rispondi(ctx, commessa, settimana, {
        tipo: 'ok',
        testo: `Impegno aggiunto. ${note.join(' ')}`.trim(),
      })
    } catch (errore) {
      if (errore instanceof ErroreLps) {
        return this.rispondi(ctx, commessa, settimana, { tipo: 'errore', testo: errore.message })
      }
      throw errore
    }
  }

  async eliminaImpegno(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'settimana')
    await richiediGestione(ctx, commessa)
    const trovato = await impegnoConPiano(commessa.id, Number(ctx.params.impegnoId))
    if (!trovato) return ctx.response.notFound('Impegno non trovato')
    const settimana = trovato.piano.settimana
    try {
      const { version } = await valida(ctx, validatoreVersione)
      await eliminaImpegno(commessa.id, trovato.impegno.id, version, autore(ctx))
    } catch (errore) {
      if (errore instanceof ErroreLps) {
        return this.rispondi(ctx, commessa, settimana, { tipo: 'errore', testo: errore.message })
      }
      throw errore
    }
    pubblica(commessa.id, 'piano.aggiornato', { settimana })
    return this.rispondi(ctx, commessa, settimana, { tipo: 'ok', testo: 'Impegno eliminato.' })
  }

  /**
   * Esito di un impegno: lo segna il PM (o l'admin) su tutte le righe, il
   * last planner sulle proprie.
   */
  async esito(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'settimana')
    const trovato = await impegnoConPiano(commessa.id, Number(ctx.params.impegnoId))
    if (!trovato) return ctx.response.notFound('Impegno non trovato')
    const utente = ctx.auth.getUserOrFail()
    const gestione = await puoGestire(ctx, commessa)
    if (!gestione && trovato.impegno.lastPlannerId !== utente.id) {
      return ctx.response.forbidden('Puoi segnare solo i tuoi impegni.')
    }
    const settimana = trovato.piano.settimana
    try {
      const dati = await valida(ctx, validatoreEsito)
      const scelta = dati.fatto ?? dati.fatto_attuale ?? null
      const fatto = scelta === 'si' ? true : scelta === 'no' ? false : null
      await segnaEsito(
        commessa.id,
        trovato.impegno.id,
        dati.version,
        {
          fatto,
          causaId: dati.causa_id ?? null,
          cinquePerche: (dati.perche ?? []).map((p) => p ?? ''),
        },
        autore(ctx),
        async (_attuale, messaggio) =>
          this.rendiFrammento(ctx, commessa, settimana, { conflitto: messaggio })
      )
    } catch (errore) {
      if (errore instanceof ErroreLps) {
        return this.rispondi(ctx, commessa, settimana, { tipo: 'errore', testo: errore.message })
      }
      throw errore
    }
    pubblica(commessa.id, 'piano.aggiornato', { settimana })
    return this.rispondi(ctx, commessa, settimana, { tipo: 'ok', testo: 'Esito salvato.' })
  }

  async prometti(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'settimana')
    await richiediGestione(ctx, commessa)
    const pianoId = Number(ctx.params.pianoId)
    const settimana = await this.settimanaDelPiano(commessa.id, pianoId)
    if (!settimana) return ctx.response.notFound('Piano non trovato')
    try {
      const { version } = await valida(ctx, validatoreVersione)
      const { attivitaVincolate } = await promettiPiano(commessa.id, pianoId, version, autore(ctx))
      pubblica(commessa.id, 'piano.aggiornato', { settimana })
      if (attivitaVincolate.length > 0) {
        return this.rispondi(ctx, commessa, settimana, {
          tipo: 'avviso',
          testo: `Piano promesso, ma con attività ancora vincolate: ${attivitaVincolate.join(', ')}. Rimuovi i vincoli in tempo o aspettati un “no”.`,
        })
      }
      return this.rispondi(ctx, commessa, settimana, {
        tipo: 'ok',
        testo: 'Piano promesso. A fine settimana segnate sì o no su ogni impegno.',
      })
    } catch (errore) {
      if (errore instanceof ErroreLps) {
        return this.rispondi(ctx, commessa, settimana, { tipo: 'errore', testo: errore.message })
      }
      throw errore
    }
  }

  async chiudi(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'settimana')
    await richiediGestione(ctx, commessa)
    const pianoId = Number(ctx.params.pianoId)
    const settimana = await this.settimanaDelPiano(commessa.id, pianoId)
    if (!settimana) return ctx.response.notFound('Piano non trovato')
    try {
      const { version } = await valida(ctx, validatoreVersione)
      await chiudiPiano(commessa.id, pianoId, version, autore(ctx))
    } catch (errore) {
      if (errore instanceof ErroreLps) {
        return this.rispondi(ctx, commessa, settimana, { tipo: 'errore', testo: errore.message })
      }
      throw errore
    }
    // Settimana già finita: lo snapshot si scatta subito (idempotente)
    if (settimana < lunediDellaSettimana(oggiRoma())) {
      await scattaSnapshotLps(commessa.id, settimana)
    }
    pubblica(commessa.id, 'piano.aggiornato', { settimana })
    return this.rispondi(ctx, commessa, settimana, {
      tipo: 'ok',
      testo: 'Piano chiuso. Il PPC della settimana è definitivo.',
    })
  }
}
