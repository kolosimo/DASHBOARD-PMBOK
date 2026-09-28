import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Disciplina from '#models/disciplina'
import CausaNonCompletamento from '#models/causa_non_completamento'
import StatoElaborato from '#models/stato_elaborato'
import ColonnaKanban from '#models/colonna_kanban'
import { aggiornaConVersione } from '#shared/optimistic'
import { istantaneaPerAudit, registraAudit } from '#shared/audit'
import { Campi, eViolazioneUnicita } from '#modules/anagrafiche/validazione'
import type { Errori } from '#modules/anagrafiche/validazione'
import { elencoCause, elencoColonne, elencoDiscipline, elencoStati } from './queries.js'
import { datiPagina, pubblicaConfigurazione, rispondiRiga, soloAdmin } from './comune.js'

/**
 * Voci semplici di configurazione (codice, nome, ordine, attiva):
 * discipline e cause di non completamento.
 */
const VOCI = {
  discipline: {
    Modello: Disciplina,
    tabella: 'discipline',
    maxCodice: 10,
    etichetta: 'disciplina',
    titolo: 'Discipline',
    descrizione:
      'Discipline degli elaborati. Una disciplina non più usata si disattiva: resta sugli elaborati esistenti ma non si può scegliere per i nuovi.',
    formatoCodice: (s: string) => s.toUpperCase(),
    elenco: elencoDiscipline,
  },
  cause: {
    Modello: CausaNonCompletamento,
    tabella: 'cause_non_completamento',
    maxCodice: 40,
    etichetta: 'causa',
    titolo: 'Cause di non completamento',
    descrizione:
      'Elenco delle cause da scegliere quando un impegno settimanale non viene mantenuto (Pareto nel Last Planner). Una causa non più usata si disattiva: lo storico resta.',
    formatoCodice: (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, ''),
    elenco: elencoCause,
  },
} as const

type TipoVoce = keyof typeof VOCI

function tipoDa(ctx: HttpContext): TipoVoce {
  const tipo = ctx.params.tipo as string
  if (tipo !== 'discipline' && tipo !== 'cause') ctx.response.abort('Sezione non trovata', 404)
  return tipo as TipoVoce
}

export default class ConfigurazioneController {
  // -------------------------------------------------------------------------
  // Discipline e cause
  // -------------------------------------------------------------------------

  async voci(ctx: HttpContext) {
    await soloAdmin(ctx)
    const tipo = tipoDa(ctx)
    return this.paginaVoci(ctx, tipo, {}, {})
  }

  async creaVoce(ctx: HttpContext) {
    const utente = await soloAdmin(ctx)
    const tipo = tipoDa(ctx)
    const conf = VOCI[tipo]
    const campi = new Campi(ctx.request.all())
    const codiceGrezzo = campi.testo('codice', 'Codice', {
      obbligatorio: true,
      max: conf.maxCodice,
    })
    const codice = codiceGrezzo ? conf.formatoCodice(codiceGrezzo) : null
    if (codiceGrezzo && !codice) campi.errore('codice', 'Codice: usa lettere e numeri.')
    const nome = campi.testo('nome', 'Nome', {
      obbligatorio: true,
      max: tipo === 'discipline' ? 100 : 200,
    })
    const ordine = campi.intero('ordine', 'Ordine', { min: 0, max: 9999 }) ?? 0
    if (codice) {
      const dup = await db.from(conf.tabella).where('codice', codice).first()
      if (dup) campi.errore('codice', `Codice: ${codice} esiste già.`)
    }
    if (!campi.valido) {
      ctx.response.status(422)
      return this.paginaVoci(ctx, tipo, campi.errori, ctx.request.all())
    }
    try {
      await db.transaction(async (trx) => {
        const voce = await (conf.Modello as typeof Disciplina).create(
          { codice: codice!, nome: nome!, ordine, attiva: true },
          { client: trx }
        )
        await registraAudit(
          {
            utenteId: utente.id,
            azione: `${conf.etichetta}.creata`,
            entita: conf.tabella,
            entitaId: voce.id,
            dopo: istantaneaPerAudit(voce),
            ip: ctx.request.ip(),
          },
          trx
        )
      })
    } catch (errore) {
      if (!eViolazioneUnicita(errore)) throw errore
      ctx.response.status(422)
      return this.paginaVoci(
        ctx,
        tipo,
        { codice: `Codice: ${codice} esiste già.` },
        ctx.request.all()
      )
    }
    await pubblicaConfigurazione(tipo)
    ctx.session.flash(
      'messaggio',
      `${tipo === 'discipline' ? 'Disciplina' : 'Causa'} ${codice} aggiunta`
    )
    return ctx.response.redirect(`/admin/${tipo}`)
  }

  async aggiornaVoce(ctx: HttpContext) {
    const utente = await soloAdmin(ctx)
    const tipo = tipoDa(ctx)
    const conf = VOCI[tipo]
    const Modello = conf.Modello as typeof Disciplina
    const voce = await Modello.find(Number(ctx.params.voceId))
    if (!voce) return ctx.response.abort('Voce non trovata', 404)
    const campi = new Campi(ctx.request.all())
    const versione = campi.versione()
    const nome = campi.testo('nome', 'Nome', {
      obbligatorio: true,
      max: tipo === 'discipline' ? 100 : 200,
    })
    const ordine = campi.intero('ordine', 'Ordine', { min: 0, max: 9999 }) ?? 0
    const attiva = campi.booleano('attiva')
    const parziale = 'modules/admin/_voce'
    if (!campi.valido) {
      return rispondiRiga(ctx, {
        parziale,
        dati: { voce, tipo, errori: campi.errori },
        sezione: tipo,
        status: 422,
        pagina: () => this.paginaVoci(ctx, tipo, {}, {}, { id: voce.id, errori: campi.errori }),
      })
    }
    const aggiornata = await aggiornaConVersione(
      Modello,
      voce.id,
      versione,
      { nome: nome!, ordine, attiva },
      {
        audit: {
          utenteId: utente.id,
          azione: `${conf.etichetta}.aggiornata`,
          ip: ctx.request.ip(),
        },
        rendiFrammento: (attuale, messaggio) =>
          ctx.view.render(parziale, { voce: attuale, tipo, errori: {}, conflitto: messaggio }),
      }
    )
    await pubblicaConfigurazione(tipo)
    return rispondiRiga(ctx, {
      parziale,
      dati: { voce: aggiornata, tipo, errori: {}, salvata: true },
      sezione: tipo,
      messaggio: 'Salvato',
    })
  }

  private async paginaVoci(
    ctx: HttpContext,
    tipo: TipoVoce,
    errori: Errori,
    valori: Record<string, unknown>,
    riga?: { id: number; errori: Errori }
  ) {
    const conf = VOCI[tipo]
    return ctx.view.render('modules/admin/voci', {
      ...datiPagina(tipo),
      tipo,
      titolo: conf.titolo,
      descrizione: conf.descrizione,
      voci: await conf.elenco(),
      errori,
      valori,
      riga: riga ?? null,
      messaggio: ctx.session.flashMessages.get('messaggio') ?? null,
    })
  }

  // -------------------------------------------------------------------------
  // Stati dell'elaborato e pesi EV
  // -------------------------------------------------------------------------

  async stati(ctx: HttpContext) {
    await soloAdmin(ctx)
    return this.paginaStati(ctx)
  }

  /**
   * Modifica nome, peso EV e colonna Kanban di uno stato. I pesi sono
   * cumulativi: non possono scendere passando allo stato successivo.
   * Le baseline approvate hanno i pesi congelati (baseline.pesi_stati) e non
   * cambiano: il nuovo peso vale per le baseline future.
   */
  async aggiornaStato(ctx: HttpContext) {
    const utente = await soloAdmin(ctx)
    const stato = await StatoElaborato.find(Number(ctx.params.statoId))
    if (!stato) return ctx.response.abort('Stato non trovato', 404)
    const campi = new Campi(ctx.request.all())
    const versione = campi.versione()
    const nome = campi.testo('nome', 'Nome', { obbligatorio: true, max: 100 })
    const peso = campi.intero('peso_ev_percento', 'Peso EV', {
      obbligatorio: true,
      min: 0,
      max: 100,
    })
    const colonnaId = campi.id('colonna_kanban_id', 'Colonna Kanban', { obbligatorio: true })
    if (colonnaId !== null && !(await ColonnaKanban.find(colonnaId))) {
      campi.errore('colonna_kanban_id', 'Colonna Kanban: non trovata.')
    }
    if (peso !== null) {
      const prima = await db
        .from('stati_elaborato')
        .where('ordine', '<', stato.ordine)
        .orderBy('ordine', 'desc')
        .first()
      const dopo = await db
        .from('stati_elaborato')
        .where('ordine', '>', stato.ordine)
        .orderBy('ordine', 'asc')
        .first()
      if (prima && peso < prima.peso_ev_percento) {
        campi.errore(
          'peso_ev_percento',
          `Peso EV: i pesi sono cumulativi, non può essere minore di quello di "${prima.nome}" (${prima.peso_ev_percento}%).`
        )
      } else if (dopo && peso > dopo.peso_ev_percento) {
        campi.errore(
          'peso_ev_percento',
          `Peso EV: i pesi sono cumulativi, non può essere maggiore di quello di "${dopo.nome}" (${dopo.peso_ev_percento}%).`
        )
      }
    }
    const parziale = 'modules/admin/_stato'
    const colonne = await elencoColonne()
    if (!campi.valido) {
      await stato.load('colonnaKanban')
      return rispondiRiga(ctx, {
        parziale,
        dati: { stato, colonne, errori: campi.errori, valori: ctx.request.all() },
        sezione: 'stati',
        status: 422,
        pagina: () => this.paginaStati(ctx, { id: stato.id, errori: campi.errori }),
      })
    }
    const aggiornato = await aggiornaConVersione(
      StatoElaborato,
      stato.id,
      versione,
      { nome: nome!, pesoEvPercento: peso!, colonnaKanbanId: colonnaId! },
      {
        audit: {
          utenteId: utente.id,
          azione:
            peso !== stato.pesoEvPercento
              ? 'stato_elaborato.peso_cambiato'
              : 'stato_elaborato.aggiornato',
          ip: ctx.request.ip(),
        },
        rendiFrammento: async (attuale, messaggio) => {
          await attuale.load('colonnaKanban')
          return ctx.view.render(parziale, {
            stato: attuale,
            colonne,
            errori: {},
            valori: {},
            conflitto: messaggio,
          })
        },
      }
    )
    await aggiornato.load('colonnaKanban')
    await pubblicaConfigurazione('stati')
    return rispondiRiga(ctx, {
      parziale,
      dati: { stato: aggiornato, colonne, errori: {}, valori: {}, salvata: true },
      sezione: 'stati',
      messaggio: 'Stato salvato',
    })
  }

  private async paginaStati(ctx: HttpContext, riga?: { id: number; errori: Errori }) {
    return ctx.view.render('modules/admin/stati', {
      ...datiPagina('stati'),
      stati: await elencoStati(),
      colonne: await elencoColonne(),
      riga: riga ?? null,
      messaggio: ctx.session.flashMessages.get('messaggio') ?? null,
    })
  }

  // -------------------------------------------------------------------------
  // Colonne Kanban e limiti WIP di default
  // -------------------------------------------------------------------------

  async colonne(ctx: HttpContext) {
    await soloAdmin(ctx)
    return this.paginaColonne(ctx)
  }

  async aggiornaColonna(ctx: HttpContext) {
    const utente = await soloAdmin(ctx)
    const colonna = await ColonnaKanban.find(Number(ctx.params.colonnaId))
    if (!colonna) return ctx.response.abort('Colonna non trovata', 404)
    const campi = new Campi(ctx.request.all())
    const versione = campi.versione()
    const nome = campi.testo('nome', 'Nome', { obbligatorio: true, max: 100 })
    const limite = campi.intero('limite_wip_default', 'Limite WIP', { min: 1, max: 999 })
    const parziale = 'modules/admin/_colonna'
    if (!campi.valido) {
      return rispondiRiga(ctx, {
        parziale,
        dati: { colonna, errori: campi.errori, valori: ctx.request.all() },
        sezione: 'colonne',
        status: 422,
        pagina: () => this.paginaColonne(ctx, { id: colonna.id, errori: campi.errori }),
      })
    }
    const aggiornata = await aggiornaConVersione(
      ColonnaKanban,
      colonna.id,
      versione,
      { nome: nome!, limiteWipDefault: limite },
      {
        audit: { utenteId: utente.id, azione: 'colonna_kanban.aggiornata', ip: ctx.request.ip() },
        rendiFrammento: (attuale, messaggio) =>
          ctx.view.render(parziale, {
            colonna: attuale,
            errori: {},
            valori: {},
            conflitto: messaggio,
          }),
      }
    )
    await pubblicaConfigurazione('colonne')
    return rispondiRiga(ctx, {
      parziale,
      dati: { colonna: aggiornata, errori: {}, valori: {}, salvata: true },
      sezione: 'colonne',
      messaggio: 'Colonna salvata',
    })
  }

  private async paginaColonne(ctx: HttpContext, riga?: { id: number; errori: Errori }) {
    return ctx.view.render('modules/admin/colonne', {
      ...datiPagina('colonne'),
      colonne: await elencoColonne(),
      riga: riga ?? null,
      messaggio: ctx.session.flashMessages.get('messaggio') ?? null,
    })
  }
}
