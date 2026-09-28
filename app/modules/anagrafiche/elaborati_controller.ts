import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import type Commessa from '#models/commessa'
import { aggiornaConVersione } from '#shared/optimistic'
import { istantaneaPerAudit, registraAudit } from '#shared/audit'
import { pubblica } from '#shared/eventi'
import { CLASSI_SERVIZIO } from '#domain/types'
import type { ClasseServizio } from '#domain/types'
import { disciplinePerScelta, statoIniziale } from '#modules/admin/queries'
import ElaboratoAnagrafica from './modelli.js'
import { codiciElaborati, elencoMembri, elencoMilestone, utentiAttivi } from './queries.js'
import { Campi, eViolazioneChiaveEsterna, eViolazioneUnicita } from './validazione.js'
import type { Errori } from './validazione.js'
import { analizzaImport } from './import_elaborati.js'
import { commessaModificabile, ip } from './pagina.js'

interface ValoriElaborato {
  codice: string
  titolo: string
  disciplinaId: number
  budgetMinuti: number
  classeServizio: ClasseServizio
  dataFissa: string | null
  responsabileId: number | null
  milestoneId: number | null
}

const ETICHETTE_CLASSI: Record<ClasseServizio, string> = {
  standard: 'Standard',
  data_fissa: 'Data fissa',
  urgente: 'Urgente',
  intangibile: 'Intangibile (miglioramento)',
}

/** Elaborati della commessa: creazione, modifica, eliminazione, import */
export default class ElaboratiController {
  // -------------------------------------------------------------------------
  // Creazione e modifica
  // -------------------------------------------------------------------------

  async nuovo(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    return this.rendiForm(ctx, commessa, null, {}, {})
  }

  async crea(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const { campi, valori } = await this.leggi(ctx, commessa, null)
    if (!campi.valido) {
      ctx.response.status(422)
      return this.rendiForm(ctx, commessa, null, campi.errori, ctx.request.all())
    }
    const statoId = await statoIniziale()
    if (statoId === null) {
      ctx.response.status(422)
      return this.rendiForm(
        ctx,
        commessa,
        null,
        { generale: 'Nessuno stato dell’elaborato configurato: chiedi all’amministratore.' },
        ctx.request.all()
      )
    }
    try {
      await db.transaction(async (trx) => {
        const el = await ElaboratoAnagrafica.create(
          { ...valori, commessaId: commessa.id, statoId },
          { client: trx }
        )
        await registraAudit(
          {
            utenteId: utente.id,
            azione: 'elaborato.creato',
            entita: 'elaborati',
            entitaId: el.id,
            commessaId: commessa.id,
            dopo: istantaneaPerAudit(el),
            ip: ip(ctx),
          },
          trx
        )
      })
    } catch (errore) {
      if (!eViolazioneUnicita(errore)) throw errore
      ctx.response.status(422)
      return this.rendiForm(
        ctx,
        commessa,
        null,
        { codice: `Codice: esiste già un elaborato ${valori.codice} in questa commessa.` },
        ctx.request.all()
      )
    }
    pubblica(commessa.id, 'elaborato.aggiornato')
    ctx.session.flash('messaggio', `Elaborato ${valori.codice} creato`)
    return ctx.response.redirect(`/commesse/${commessa.id}/anagrafica#pannello-elaborati`)
  }

  async modifica(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const el = await this.elaborato(ctx, commessa)
    return this.rendiForm(ctx, commessa, el, {}, {})
  }

  async aggiorna(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const el = await this.elaborato(ctx, commessa)
    const { campi, valori } = await this.leggi(ctx, commessa, el)
    const versione = campi.versione()
    if (!campi.valido) {
      ctx.response.status(422)
      return this.rendiForm(ctx, commessa, el, campi.errori, ctx.request.all())
    }
    try {
      await aggiornaConVersione(ElaboratoAnagrafica, el.id, versione, valori, {
        audit: {
          utenteId: utente.id,
          azione: 'elaborato.aggiornato',
          commessaId: commessa.id,
          ip: ip(ctx),
        },
        rendiFrammento: (attuale) =>
          ctx.view.render('modules/anagrafiche/_elaborato_form', {
            ...this.opzioniVuote(),
            elaborato: attuale,
            solaLettura: true,
          }),
      })
    } catch (errore) {
      if (!eViolazioneUnicita(errore)) throw errore
      ctx.response.status(422)
      return this.rendiForm(
        ctx,
        commessa,
        el,
        { codice: `Codice: esiste già un elaborato ${valori.codice} in questa commessa.` },
        ctx.request.all()
      )
    }
    pubblica(commessa.id, 'elaborato.aggiornato')
    ctx.session.flash('messaggio', `Elaborato ${valori.codice} salvato`)
    return ctx.response.redirect(`/commesse/${commessa.id}/anagrafica#pannello-elaborati`)
  }

  /**
   * Elimina un elaborato. Non si può se ha ore registrate o se fa parte di una
   * baseline approvata (cambierebbe il BAC congelato).
   */
  async elimina(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const el = await this.elaborato(ctx, commessa)
    const campi = new Campi(ctx.request.all())
    const versione = campi.versione()
    if (!campi.booleano('conferma')) {
      ctx.response.status(422)
      return this.rendiForm(
        ctx,
        commessa,
        el,
        { generale: 'Per eliminare l’elaborato spunta la casella di conferma.' },
        {}
      )
    }

    const inBaseline = await db
      .from('baseline_date_stato as bd')
      .join('baseline as b', 'b.id', 'bd.baseline_id')
      .where('bd.elaborato_id', el.id)
      .where('b.stato', 'approvata')
      .first()
    if (inBaseline) {
      ctx.response.status(422)
      return this.rendiForm(
        ctx,
        commessa,
        el,
        {
          generale:
            'Non si può eliminare: l’elaborato fa parte della baseline approvata. Serve una nuova baseline.',
        },
        {}
      )
    }

    try {
      await db.transaction(async (trx) => {
        const riga = await aggiornaConVersione(
          ElaboratoAnagrafica,
          el.id,
          versione,
          {},
          {
            client: trx,
          }
        )
        await riga.useTransaction(trx).delete()
        await registraAudit(
          {
            utenteId: utente.id,
            azione: 'elaborato.eliminato',
            entita: 'elaborati',
            entitaId: el.id,
            commessaId: commessa.id,
            prima: istantaneaPerAudit(el),
            ip: ip(ctx),
          },
          trx
        )
      })
    } catch (errore) {
      if (!eViolazioneChiaveEsterna(errore)) throw errore
      ctx.response.status(422)
      return this.rendiForm(
        ctx,
        commessa,
        el,
        { generale: 'Non si può eliminare: sull’elaborato ci sono ore registrate.' },
        {}
      )
    }
    pubblica(commessa.id, 'elaborato.aggiornato')
    ctx.session.flash('messaggio', `Elaborato ${el.codice} eliminato`)
    return ctx.response.redirect(`/commesse/${commessa.id}/anagrafica#pannello-elaborati`)
  }

  // -------------------------------------------------------------------------
  // Import da Excel / CSV
  // -------------------------------------------------------------------------

  async formImport(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    return ctx.view.render('modules/anagrafiche/import', {
      commessa,
      testo: '',
      esito: null,
      discipline: await disciplinePerScelta(),
    })
  }

  /** Anteprima: nessuna scrittura, righe errate segnalate */
  async anteprimaImport(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const testo = String(ctx.request.input('testo', '') ?? '')
    const esito = await this.analizza(commessa, testo)
    if (esito.righe.length === 0) ctx.response.status(422)
    return ctx.view.render('modules/anagrafiche/import', {
      commessa,
      testo,
      esito,
      discipline: await disciplinePerScelta(),
    })
  }

  /**
   * Conferma: si importa solo se tutte le righe sono valide (tutto o niente),
   * così nessuno si ritrova con metà elenco caricato.
   */
  async confermaImport(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const testo = String(ctx.request.input('testo', '') ?? '')
    const esito = await this.analizza(commessa, testo)
    const statoId = await statoIniziale()
    if (esito.righe.length === 0 || esito.errate.length > 0 || statoId === null) {
      ctx.response.status(422)
      return ctx.view.render('modules/anagrafiche/import', {
        commessa,
        testo,
        esito,
        discipline: await disciplinePerScelta(),
      })
    }
    try {
      await db.transaction(async (trx) => {
        for (const r of esito.valide) {
          const el = await ElaboratoAnagrafica.create(
            {
              commessaId: commessa.id,
              codice: r.codice,
              titolo: r.titolo,
              disciplinaId: r.disciplinaId!,
              budgetMinuti: r.budgetMinuti!,
              classeServizio: 'standard',
              statoId,
            },
            { client: trx }
          )
          await registraAudit(
            {
              utenteId: utente.id,
              azione: 'elaborato.importato',
              entita: 'elaborati',
              entitaId: el.id,
              commessaId: commessa.id,
              dopo: istantaneaPerAudit(el),
              ip: ip(ctx),
            },
            trx
          )
        }
      })
    } catch (errore) {
      if (!eViolazioneUnicita(errore)) throw errore
      // Un altro utente ha inserito nel frattempo uno dei codici: nuova anteprima
      ctx.response.status(409)
      return ctx.view.render('modules/anagrafiche/import', {
        commessa,
        testo,
        esito: await this.analizza(commessa, testo),
        discipline: await disciplinePerScelta(),
      })
    }
    pubblica(commessa.id, 'elaborato.aggiornato')
    const n = esito.valide.length
    ctx.session.flash('messaggio', n === 1 ? 'Importato 1 elaborato' : `Importati ${n} elaborati`)
    return ctx.response.redirect(`/commesse/${commessa.id}/anagrafica#pannello-elaborati`)
  }

  // -------------------------------------------------------------------------

  private async analizza(commessa: Commessa, testo: string) {
    const discipline = await disciplinePerScelta()
    return analizzaImport(testo, discipline, await codiciElaborati(commessa.id))
  }

  private async elaborato(ctx: HttpContext, commessa: Commessa) {
    const el = await ElaboratoAnagrafica.query()
      .where('id', Number(ctx.params.elaboratoId))
      .where('commessa_id', commessa.id)
      .first()
    if (!el) return ctx.response.abort('Elaborato non trovato', 404)
    return el
  }

  /** Legge e valida il form dell'elaborato */
  private async leggi(ctx: HttpContext, commessa: Commessa, el: ElaboratoAnagrafica | null) {
    const campi = new Campi(ctx.request.all())
    const codice = campi.testo('codice', 'Codice', { obbligatorio: true, max: 40 })
    const titolo = campi.testo('titolo', 'Titolo', { obbligatorio: true, max: 300 })
    const disciplinaId = campi.id('disciplina_id', 'Disciplina', { obbligatorio: true })
    const budgetMinuti = campi.ore('budget_ore', 'Budget ore', { obbligatorio: true })
    const classe =
      campi.scelta('classe_servizio', 'Classe di servizio', CLASSI_SERVIZIO) ?? 'standard'
    const dataFissa = campi.data('data_fissa', 'Data fissa')
    const responsabileId = campi.id('responsabile_id', 'Responsabile')
    const milestoneId = campi.id('milestone_id', 'Milestone')

    if (classe === 'data_fissa' && !dataFissa && !campi.errori.data_fissa) {
      campi.errore('data_fissa', 'Data fissa: obbligatoria per la classe "data fissa".')
    }
    if (disciplinaId !== null) {
      const d = await db.from('discipline').where('id', disciplinaId).first()
      if (!d) campi.errore('disciplina_id', 'Disciplina: non trovata.')
      else if (!d.attiva && d.id !== el?.disciplinaId) {
        campi.errore('disciplina_id', 'Disciplina: non più attiva.')
      }
    }
    if (responsabileId !== null && responsabileId !== el?.responsabileId) {
      const u = await db.from('utenti').where('id', responsabileId).where('attivo', true).first()
      if (!u) campi.errore('responsabile_id', 'Responsabile: utente inesistente o disattivato.')
    }
    if (milestoneId !== null) {
      const m = await db
        .from('milestone')
        .where('id', milestoneId)
        .where('commessa_id', commessa.id)
        .first()
      if (!m) campi.errore('milestone_id', 'Milestone: non appartiene a questa commessa.')
    }
    if (codice && codice !== el?.codice) {
      const dup = await db
        .from('elaborati')
        .where('commessa_id', commessa.id)
        .whereRaw('upper(codice) = upper(?)', [codice])
        .whereNot('id', el?.id ?? 0)
        .first()
      if (dup)
        campi.errore('codice', `Codice: esiste già un elaborato ${codice} in questa commessa.`)
    }

    const valori: ValoriElaborato = {
      codice: codice!,
      titolo: titolo!,
      disciplinaId: disciplinaId!,
      budgetMinuti: budgetMinuti!,
      classeServizio: classe,
      dataFissa: classe === 'data_fissa' ? dataFissa : null,
      responsabileId,
      milestoneId,
    }
    return { campi, valori }
  }

  private opzioniVuote() {
    return {
      discipline: [],
      persone: [],
      milestone: [],
      classi: CLASSI_SERVIZIO.map((c) => ({ valore: c, etichetta: ETICHETTE_CLASSI[c] })),
      errori: {},
      valori: {},
    }
  }

  private async rendiForm(
    ctx: HttpContext,
    commessa: Commessa,
    elaborato: ElaboratoAnagrafica | null,
    errori: Errori,
    valori: Record<string, unknown>
  ) {
    // Prima i membri del team, poi gli altri utenti attivi
    const membri = await elencoMembri(commessa.id)
    const idMembri = new Set(membri.map((m) => m.utenteId))
    const attivi = await utentiAttivi()
    const altri = attivi.filter((u) => !idMembri.has(u.id))
    return ctx.view.render('modules/anagrafiche/elaborato', {
      commessa,
      elaborato,
      errori,
      valori,
      discipline: await disciplinePerScelta(),
      persone: [
        ...membri.map((m) => ({ id: m.utenteId, nome: m.nome, nota: 'team' })),
        ...altri.map((u) => ({ id: u.id, nome: u.nome, nota: '' })),
      ],
      milestone: await elencoMilestone(commessa.id),
      classi: CLASSI_SERVIZIO.map((c) => ({ valore: c, etichetta: ETICHETTE_CLASSI[c] })),
    })
  }
}
