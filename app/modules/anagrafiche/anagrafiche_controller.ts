import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import MembroCommessa from '#models/membro_commessa'
import LimiteWipCommessa from '#models/limite_wip_commessa'
import { aggiornaConVersione } from '#shared/optimistic'
import { istantaneaPerAudit, registraAudit } from '#shared/audit'
import { pubblica } from '#shared/eventi'
import { STATI_COMMESSA } from '#domain/types'
import { Campi, eViolazioneUnicita } from './validazione.js'
import {
  commessaModificabile,
  commessaVisibile,
  frammentoConflitto,
  ip,
  rendiPagina,
  rispondiPannello,
} from './pagina.js'

/** Anagrafica di commessa: dati generali e limiti WIP della commessa */
export default class AnagraficheController {
  async show(ctx: HttpContext) {
    const commessa = await commessaVisibile(ctx)
    return rendiPagina(ctx, commessa)
  }

  /** Modifica dei dati della commessa (codice, nome, cliente, PM, stato, date, note) */
  async aggiornaDati(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const campi = new Campi(ctx.request.all())
    const versione = campi.versione()
    const codice = campi.testo('codice', 'Codice', { obbligatorio: true, max: 30 })
    const nome = campi.testo('nome', 'Nome', { obbligatorio: true, max: 300 })
    const cliente = campi.testo('cliente', 'Cliente', { max: 300 })
    const pmId = campi.id('pm_id', 'PM')
    const stato = campi.scelta('stato', 'Stato', STATI_COMMESSA, { obbligatorio: true })
    const dataInizio = campi.data('data_inizio', 'Data di inizio')
    const dataFine = campi.data('data_fine_prevista', 'Fine prevista')
    const note = campi.testo('note', 'Note', { max: 4000 })
    if (dataInizio && dataFine && dataFine < dataInizio) {
      campi.errore('data_fine_prevista', 'Fine prevista: non può precedere la data di inizio.')
    }
    if (pmId !== null) {
      const pm = await db.from('utenti').where('id', pmId).where('attivo', true).first()
      if (!pm) campi.errore('pm_id', 'PM: utente inesistente o disattivato.')
    }
    if (codice && codice !== commessa.codice) {
      const dup = await db
        .from('commesse')
        .where('codice', codice)
        .whereNot('id', commessa.id)
        .first()
      if (dup) campi.errore('codice', `Codice: esiste già una commessa ${codice}.`)
    }
    if (!campi.valido) {
      return rispondiPannello(
        ctx,
        'dati',
        commessa,
        { errori: campi.errori, valori: ctx.request.all() },
        422
      )
    }

    try {
      await db.transaction(async (trx) => {
        await aggiornaConVersione(
          Commessa,
          commessa.id,
          versione,
          {
            codice: codice!,
            nome: nome!,
            cliente,
            pmId,
            stato: stato!,
            dataInizio,
            dataFinePrevista: dataFine,
            note,
          },
          {
            client: trx,
            audit: {
              utenteId: utente.id,
              azione: 'commessa.aggiornata',
              commessaId: commessa.id,
              ip: ip(ctx),
            },
            rendiFrammento: frammentoConflitto(ctx, 'dati', commessa),
          }
        )
        // Il nuovo PM entra nel team, se non c'è già
        if (pmId !== null) {
          const presente = await MembroCommessa.query({ client: trx })
            .where('commessa_id', commessa.id)
            .where('utente_id', pmId)
            .first()
          if (!presente) {
            const membro = await MembroCommessa.create(
              { commessaId: commessa.id, utenteId: pmId, ruoloCommessa: 'pm' },
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
          }
        }
      })
    } catch (errore) {
      if (!eViolazioneUnicita(errore)) throw errore
      return rispondiPannello(
        ctx,
        'dati',
        commessa,
        {
          errori: { codice: `Codice: esiste già una commessa ${codice}.` },
          valori: ctx.request.all(),
        },
        422
      )
    }
    pubblica(commessa.id, 'commessa.aggiornata')
    await commessa.refresh()
    ctx.view.share({ commessa })
    return rispondiPannello(ctx, 'dati', commessa, { messaggio: 'Dati della commessa salvati' })
  }

  /**
   * Limite WIP di una colonna per questa commessa. Campo vuoto = si torna al
   * limite di default (la riga specifica viene eliminata).
   */
  async aggiornaLimiteWip(ctx: HttpContext) {
    const commessa = await commessaModificabile(ctx)
    const utente = ctx.auth.getUserOrFail()
    const colonnaId = Number(ctx.params.colonnaId)
    const colonna = await db.from('colonne_kanban').where('id', colonnaId).first()
    if (!colonna) return ctx.response.abort('Colonna non trovata', 404)

    const campi = new Campi(ctx.request.all())
    const limite = campi.intero('limite', `Limite WIP ${colonna.nome}`, { min: 1, max: 999 })
    const versioneTesto = campi.grezzo('version').trim()
    if (!campi.valido) {
      return rispondiPannello(
        ctx,
        'wip',
        commessa,
        { errori: campi.errori, rigaId: colonnaId, valori: ctx.request.all() },
        422
      )
    }

    const esistente = await LimiteWipCommessa.query()
      .where('commessa_id', commessa.id)
      .where('colonna_kanban_id', colonnaId)
      .first()
    const audit = {
      utenteId: utente.id,
      azione: 'limite_wip.aggiornato',
      commessaId: commessa.id,
      ip: ip(ctx),
    }

    if (esistente) {
      const versione = Number(versioneTesto)
      if (limite === null) {
        await db.transaction(async (trx) => {
          // Controllo di versione anche per l'eliminazione
          const riga = await aggiornaConVersione(
            LimiteWipCommessa,
            esistente.id,
            versione,
            {},
            { client: trx, rendiFrammento: frammentoConflitto(ctx, 'wip', commessa) }
          )
          await riga.useTransaction(trx).delete()
          await registraAudit(
            {
              ...audit,
              azione: 'limite_wip.rimosso',
              entita: 'limiti_wip_commessa',
              entitaId: esistente.id,
              prima: istantaneaPerAudit(esistente),
            },
            trx
          )
        })
      } else {
        await aggiornaConVersione(
          LimiteWipCommessa,
          esistente.id,
          versione,
          { limite },
          { audit, rendiFrammento: frammentoConflitto(ctx, 'wip', commessa) }
        )
      }
    } else if (limite !== null) {
      if (versioneTesto !== '') {
        // La riga che l'utente aveva visto è stata eliminata da un altro utente
        return this.conflittoWip(ctx, commessa)
      }
      try {
        await db.transaction(async (trx) => {
          const riga = await LimiteWipCommessa.create(
            { commessaId: commessa.id, colonnaKanbanId: colonnaId, limite },
            { client: trx }
          )
          await registraAudit(
            {
              ...audit,
              azione: 'limite_wip.creato',
              entita: 'limiti_wip_commessa',
              entitaId: riga.id,
              dopo: istantaneaPerAudit(riga),
            },
            trx
          )
        })
      } catch (errore) {
        if (!eViolazioneUnicita(errore)) throw errore
        return this.conflittoWip(ctx, commessa)
      }
    }
    pubblica(commessa.id, 'commessa.aggiornata')
    return rispondiPannello(ctx, 'wip', commessa, { messaggio: 'Limite WIP salvato' })
  }

  private async conflittoWip(ctx: HttpContext, commessa: Commessa) {
    const messaggio =
      'Qualcun altro ha modificato questo dato mentre lo stavi modificando. ' +
      'Qui sotto vedi la versione aggiornata: controlla e, se serve, ripeti la modifica.'
    return rispondiPannello(ctx, 'wip', commessa, { conflitto: messaggio }, 409)
  }
}
