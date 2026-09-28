import type { HttpContext } from '@adonisjs/core/http'
import type Commessa from '#models/commessa'
import { commessaCorrente } from '#shared/commessa_corrente'
import { pubblica } from '#shared/eventi'
import { leggiImpostazione } from '#shared/impostazioni'
import {
  aggiungiSettimane,
  eLunedi,
  lunediDellaSettimana,
  oggiRoma,
  settimaneDa,
} from '#shared/calendario'
import { CATEGORIE_VINCOLO, type Lunedi } from '#domain/types'
import {
  attivitaDellaCommessa,
  attivitaLookahead,
  disciplineAttive,
  elaboratiDellaCommessa,
  indicatoriSettimana,
  personeDelTeam,
  registroVincoli,
  tutteLeAttivita,
} from './queries.js'
import {
  cambiaStatoVincolo,
  creaAttivita,
  creaVincolo,
  eliminaAttivita,
  ErroreLps,
  modificaAttivita,
  modificaVincolo,
  type AzioneVincolo,
  type DatiAttivita,
  type DatiVincolo,
} from './servizi.js'
import {
  autore,
  eHtmx,
  flashMessaggio,
  messaggioFlash,
  puoGestire,
  richiediGestione,
  settimanaRichiesta,
  valida,
  type Messaggio,
} from './contesto.js'
import { validatoreAttivita, validatoreVersione, validatoreVincolo } from './validatori.js'

const VISTA = 'modules/lps/lookahead'
const FRAMMENTO = 'modules/lps/_lookahead'

export const ETICHETTE_CATEGORIA: Record<string, string> = {
  input_da_altri: 'Input da altri',
  approvazione: 'Approvazione',
  risorsa: 'Risorsa',
  criteri: 'Criteri',
  informazioni: 'Informazioni',
  altro: 'Altro',
}

export const ETICHETTE_STATO_VINCOLO: Record<string, string> = {
  da_analizzare: 'da analizzare',
  aperto: 'aperto',
  rimosso: 'rimosso',
  annullato: 'annullato',
}

/** Settimane proposte nei moduli: 4 prima e 20 dopo la settimana corrente */
function settimaneScelta(): Lunedi[] {
  const corrente = lunediDellaSettimana(oggiRoma())
  return settimaneDa(aggiungiSettimane(corrente, -4), 25)
}

/**
 * Lookahead a N settimane (impostazione lps.settimane_lookahead, 6 di
 * esempio) e registro vincoli, con PCR della prima settimana.
 */
export default class LookaheadController {
  private async dati(ctx: HttpContext, commessa: Commessa, da: Lunedi, filtro: string) {
    const n = Math.max(1, await leggiImpostazione('lps.settimane_lookahead'))
    const settimane = settimaneDa(da, n)
    const a = settimane[settimane.length - 1]
    const filtroVincoli = filtro === 'aperti' ? 'aperti' : 'tutti'
    const [attivita, vincoli, indicatori, gestione, sogliaPcr] = await Promise.all([
      attivitaLookahead(commessa.id, da, a),
      registroVincoli(commessa.id, filtroVincoli),
      indicatoriSettimana(commessa.id, da),
      puoGestire(ctx, commessa),
      leggiImpostazione('soglie.pcr'),
    ])
    const tutti = filtroVincoli === 'tutti' ? vincoli : await registroVincoli(commessa.id, 'tutti')
    return {
      commessa,
      da,
      settimane,
      precedente: aggiungiSettimane(da, -1),
      successiva: aggiungiSettimane(da, 1),
      corrente: lunediDellaSettimana(oggiRoma()),
      attivita,
      vincoli,
      filtro: filtroVincoli,
      vincoliAperti: tutti.filter((v) => v.aperto).length,
      attivitaVincolate: attivita.filter((x) => x.tipo === 'attivita' && !x.pronta).length,
      pcr: indicatori.pcr,
      sogliaPcr,
      puoGestire: gestione,
      etichetteCategoria: ETICHETTE_CATEGORIA,
      etichetteStato: ETICHETTE_STATO_VINCOLO,
      base: `/commesse/${commessa.id}/lps`,
      query: `da=${da}&filtro=${filtroVincoli}`,
    }
  }

  private filtro(ctx: HttpContext) {
    return String(ctx.request.qs().filtro ?? ctx.request.input('filtro', 'tutti'))
  }

  /** Prima settimana del lookahead: da query string o dal corpo (HTMX), lunedì valido */
  private da(ctx: HttpContext): Lunedi {
    const valore = ctx.request.input('da')
    if (typeof valore === 'string' && eLunedi(valore)) return valore
    return settimanaRichiesta(ctx, 'da')
  }

  private async rendiFrammento(
    ctx: HttpContext,
    commessa: Commessa,
    extra: { messaggio?: Messaggio | null; conflitto?: string } = {}
  ) {
    return ctx.view.render(FRAMMENTO, {
      ...(await this.dati(ctx, commessa, this.da(ctx), this.filtro(ctx))),
      ...extra,
    })
  }

  async mostra(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    return ctx.view.render(VISTA, {
      ...(await this.dati(ctx, commessa, this.da(ctx), this.filtro(ctx))),
      messaggio: messaggioFlash(ctx),
    })
  }

  async frammento(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    return this.rendiFrammento(ctx, commessa)
  }

  // -------------------------------------------------------------------------
  // Vincoli: rimuovi / riapri / annulla (HTMX, frammento del lookahead)
  // -------------------------------------------------------------------------

  async statoVincolo(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    await richiediGestione(ctx, commessa)
    const azione = String(ctx.params.azione) as AzioneVincolo
    if (!['rimuovi', 'riapri', 'annulla'].includes(azione)) {
      return ctx.response.notFound('Azione sconosciuta')
    }
    let messaggio: Messaggio
    try {
      const { version } = await valida(ctx, validatoreVersione)
      const v = await cambiaStatoVincolo(
        commessa.id,
        Number(ctx.params.vincoloId),
        version,
        azione,
        autore(ctx),
        async (_attuale, testo) => this.rendiFrammento(ctx, commessa, { conflitto: testo })
      )
      pubblica(commessa.id, 'vincolo.aggiornato', { vincoloId: v.id })
      const verbo = { rimuovi: 'rimosso', riapri: 'riaperto', annulla: 'annullato' }[azione]
      messaggio = { tipo: 'ok', testo: `Vincolo ${v.codice} ${verbo}.` }
    } catch (errore) {
      if (!(errore instanceof ErroreLps)) throw errore
      messaggio = { tipo: 'errore', testo: errore.message }
    }
    if (eHtmx(ctx)) {
      if (messaggio.tipo === 'errore') ctx.response.status(422)
      else ctx.response.header('HX-Trigger', JSON.stringify({ toast: messaggio.testo }))
      return this.rendiFrammento(ctx, commessa, { messaggio })
    }
    flashMessaggio(ctx, messaggio)
    return ctx.response.redirect(`/commesse/${commessa.id}/lps/lookahead?da=${this.da(ctx)}`)
  }

  // -------------------------------------------------------------------------
  // Moduli di inserimento e modifica (pagine intere, POST + redirect)
  // -------------------------------------------------------------------------

  private async opzioni(commessa: Commessa) {
    const [team, elaborati, discipline, attivita] = await Promise.all([
      personeDelTeam(commessa.id),
      elaboratiDellaCommessa(commessa.id),
      disciplineAttive(),
      tutteLeAttivita(commessa.id),
    ])
    return {
      team,
      elaborati,
      discipline,
      attivita,
      settimaneScelta: settimaneScelta(),
      categorie: CATEGORIE_VINCOLO,
      etichetteCategoria: ETICHETTE_CATEGORIA,
      base: `/commesse/${commessa.id}/lps`,
      oggi: oggiRoma(),
    }
  }

  private valoriFlash(ctx: HttpContext) {
    return (ctx.session.flashMessages.get('valori') as Record<string, unknown> | undefined) ?? null
  }

  private erroreForm(ctx: HttpContext, errore: ErroreLps, dove: string) {
    flashMessaggio(ctx, { tipo: 'errore', testo: errore.message })
    ctx.session.flash('valori', ctx.request.all())
    return ctx.response.redirect(dove)
  }

  private datiAttivita(
    dati: Awaited<ReturnType<typeof validatoreAttivita.validate>>
  ): DatiAttivita {
    return {
      codice: dati.codice,
      titolo: dati.titolo,
      tipo: dati.tipo,
      elaboratoId: dati.elaborato_id ?? null,
      disciplinaId: dati.disciplina_id ?? null,
      responsabileId: dati.responsabile_id ?? null,
      settimanaInizio: dati.settimana_inizio,
      settimanaFine: dati.settimana_fine,
    }
  }

  private datiVincolo(dati: Awaited<ReturnType<typeof validatoreVincolo.validate>>): DatiVincolo {
    return {
      descrizione: dati.descrizione,
      categoria: dati.categoria,
      stato: dati.stato,
      responsabileId: dati.responsabile_id ?? null,
      responsabileEsterno: dati.responsabile_esterno ?? null,
      dataNecessaria: dati.data_necessaria ?? null,
      identificatoIl: dati.identificato_il ?? null,
      note: dati.note ?? null,
      attivita: dati.attivita ?? [],
    }
  }

  async nuovaAttivita(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    await richiediGestione(ctx, commessa)
    const corrente = lunediDellaSettimana(oggiRoma())
    return ctx.view.render('modules/lps/attivita_form', {
      ...(await this.opzioni(commessa)),
      attivita: null,
      valori: this.valoriFlash(ctx) ?? {
        tipo: 'attivita',
        settimana_inizio: corrente,
        settimana_fine: corrente,
      },
      messaggio: messaggioFlash(ctx),
    })
  }

  async creaAttivita(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    await richiediGestione(ctx, commessa)
    try {
      const dati = await valida(ctx, validatoreAttivita)
      const a = await creaAttivita(commessa.id, this.datiAttivita(dati), autore(ctx))
      pubblica(commessa.id, 'lookahead.aggiornato', { attivitaId: a.id })
      flashMessaggio(ctx, { tipo: 'ok', testo: `Attività ${a.codice} aggiunta al lookahead.` })
      return ctx.response.redirect(`/commesse/${commessa.id}/lps/lookahead`)
    } catch (errore) {
      if (errore instanceof ErroreLps) {
        return this.erroreForm(ctx, errore, `/commesse/${commessa.id}/lps/attivita/nuova`)
      }
      throw errore
    }
  }

  async modificaAttivitaForm(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    await richiediGestione(ctx, commessa)
    const a = await attivitaDellaCommessa(commessa.id, Number(ctx.params.attivitaId))
    if (!a) return ctx.response.notFound('Attività non trovata')
    return ctx.view.render('modules/lps/attivita_form', {
      ...(await this.opzioni(commessa)),
      attivita: a,
      valori: this.valoriFlash(ctx) ?? {
        version: a.version,
        codice: a.codice,
        titolo: a.titolo,
        tipo: a.tipo,
        elaborato_id: a.elaboratoId,
        disciplina_id: a.disciplinaId,
        responsabile_id: a.responsabileId,
        settimana_inizio: a.settimanaInizio,
        settimana_fine: a.settimanaFine,
      },
      messaggio: messaggioFlash(ctx),
    })
  }

  async aggiornaAttivita(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    await richiediGestione(ctx, commessa)
    const id = Number(ctx.params.attivitaId)
    try {
      const dati = await valida(ctx, validatoreAttivita)
      if (!dati.version) throw new ErroreLps('Versione mancante: ricarica la pagina.')
      const a = await modificaAttivita(
        commessa.id,
        id,
        dati.version,
        this.datiAttivita(dati),
        autore(ctx)
      )
      pubblica(commessa.id, 'lookahead.aggiornato', { attivitaId: a.id })
      flashMessaggio(ctx, { tipo: 'ok', testo: `Attività ${a.codice} aggiornata.` })
      return ctx.response.redirect(`/commesse/${commessa.id}/lps/lookahead`)
    } catch (errore) {
      if (errore instanceof ErroreLps) {
        return this.erroreForm(ctx, errore, `/commesse/${commessa.id}/lps/attivita/${id}/modifica`)
      }
      throw errore
    }
  }

  async eliminaAttivita(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    await richiediGestione(ctx, commessa)
    const id = Number(ctx.params.attivitaId)
    try {
      const { version } = await valida(ctx, validatoreVersione)
      await eliminaAttivita(commessa.id, id, version, autore(ctx))
    } catch (errore) {
      if (errore instanceof ErroreLps) {
        return this.erroreForm(ctx, errore, `/commesse/${commessa.id}/lps/attivita/${id}/modifica`)
      }
      throw errore
    }
    pubblica(commessa.id, 'lookahead.aggiornato', { attivitaId: id })
    flashMessaggio(ctx, { tipo: 'ok', testo: 'Attività eliminata dal lookahead.' })
    return ctx.response.redirect(`/commesse/${commessa.id}/lps/lookahead`)
  }

  async nuovoVincolo(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    await richiediGestione(ctx, commessa)
    const attivitaId = Number(ctx.request.qs().attivita)
    return ctx.view.render('modules/lps/vincolo_form', {
      ...(await this.opzioni(commessa)),
      vincolo: null,
      valori: this.valoriFlash(ctx) ?? {
        stato: 'aperto',
        categoria: 'input_da_altri',
        identificato_il: oggiRoma(),
        attivita: Number.isInteger(attivitaId) && attivitaId > 0 ? [attivitaId] : [],
      },
      messaggio: messaggioFlash(ctx),
    })
  }

  async creaVincolo(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    await richiediGestione(ctx, commessa)
    try {
      const dati = await valida(ctx, validatoreVincolo)
      const v = await creaVincolo(commessa.id, this.datiVincolo(dati), autore(ctx))
      pubblica(commessa.id, 'vincolo.aggiornato', { vincoloId: v.id })
      flashMessaggio(ctx, { tipo: 'ok', testo: `Vincolo ${v.codice} registrato.` })
      return ctx.response.redirect(`/commesse/${commessa.id}/lps/lookahead`)
    } catch (errore) {
      if (errore instanceof ErroreLps) {
        return this.erroreForm(ctx, errore, `/commesse/${commessa.id}/lps/vincoli/nuovo`)
      }
      throw errore
    }
  }

  async modificaVincoloForm(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    await richiediGestione(ctx, commessa)
    const [v] = await registroVincoli(commessa.id, 'tutti', Number(ctx.params.vincoloId))
    if (!v) return ctx.response.notFound('Vincolo non trovato')
    return ctx.view.render('modules/lps/vincolo_form', {
      ...(await this.opzioni(commessa)),
      vincolo: v,
      valori: this.valoriFlash(ctx) ?? {
        version: v.version,
        descrizione: v.descrizione,
        categoria: v.categoria,
        stato: v.stato,
        responsabile_id: v.responsabileId,
        responsabile_esterno: v.responsabileEsterno,
        data_necessaria: v.dataNecessaria,
        identificato_il: v.identificatoIl,
        note: v.note,
        attivita: v.attivita.map((a) => a.id),
      },
      messaggio: messaggioFlash(ctx),
    })
  }

  async aggiornaVincolo(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'lookahead')
    await richiediGestione(ctx, commessa)
    const id = Number(ctx.params.vincoloId)
    try {
      const dati = await valida(ctx, validatoreVincolo)
      if (!dati.version) throw new ErroreLps('Versione mancante: ricarica la pagina.')
      const v = await modificaVincolo(
        commessa.id,
        id,
        dati.version,
        this.datiVincolo(dati),
        autore(ctx)
      )
      pubblica(commessa.id, 'vincolo.aggiornato', { vincoloId: v.id })
      flashMessaggio(ctx, { tipo: 'ok', testo: `Vincolo ${v.codice} aggiornato.` })
      return ctx.response.redirect(`/commesse/${commessa.id}/lps/lookahead`)
    } catch (errore) {
      if (errore instanceof ErroreLps) {
        return this.erroreForm(ctx, errore, `/commesse/${commessa.id}/lps/vincoli/${id}/modifica`)
      }
      throw errore
    }
  }
}
