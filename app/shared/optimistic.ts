/**
 * Optimistic locking con la colonna `version`.
 *
 * Ogni modifica parte dalla versione che l'utente ha visto. Se nel frattempo
 * qualcun altro ha salvato, la versione nel DB è cambiata: si risponde 409
 * con un messaggio chiaro e, se disponibile, il frammento HTML aggiornato da
 * sostituire nella pagina (HTMX).
 */
import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import type { LucidModel, LucidRow, ModelAttributes } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { istantaneaPerAudit, registraAudit } from '#shared/audit'

type ConVersione = LucidRow & { version: number; id: number }

export type RendiFrammento<R> = (attuale: R, messaggio: string) => Promise<string>

export interface OpzioniAggiornamento<R> {
  /** Transazione esterna; se assente se ne apre una */
  client?: TransactionClientContract
  /** Se presente, registra la modifica nell'audit nella stessa transazione */
  audit?: {
    utenteId: number | null
    azione: string
    commessaId?: number | null
    ip?: string | null
  }
  /**
   * Rende il frammento aggiornato da mostrare in caso di conflitto (409).
   * Riceve la riga attuale e il messaggio: il frammento deve mostrare il
   * messaggio (componente `conflitto`) sopra i dati aggiornati.
   */
  rendiFrammento?: RendiFrammento<R>
}

/**
 * Errore 409: la riga è stata modificata da un altro utente.
 * `attuale` è la riga com'è ora nel DB (null se è stata cancellata).
 */
export class ConflittoVersione<R = unknown> extends Exception {
  static status = 409
  static code = 'E_CONFLITTO_VERSIONE'

  constructor(
    public attuale: R | null,
    public versioneAttesa: number,
    public rendiFrammento?: RendiFrammento<R>
  ) {
    super(
      attuale === null
        ? 'Questo dato è stato eliminato da un altro utente.'
        : 'Qualcun altro ha modificato questo dato mentre lo stavi modificando. ' +
            'Qui sotto vedi la versione aggiornata: controlla e, se serve, ripeti la modifica.',
      { status: 409, code: 'E_CONFLITTO_VERSIONE' }
    )
  }

  /** Risposta HTTP: frammento per HTMX, JSON per le API, pagina altrimenti */
  async handle(errore: this, ctx: HttpContext) {
    const { request, response, view } = ctx
    const frammento =
      errore.attuale !== null && errore.rendiFrammento
        ? await errore.rendiFrammento(errore.attuale, errore.message)
        : null
    const versioneAttuale =
      errore.attuale && typeof errore.attuale === 'object' && 'version' in errore.attuale
        ? (errore.attuale as { version: number }).version
        : null

    if (request.header('hx-request') === 'true') {
      response.header(
        'HX-Trigger',
        JSON.stringify({ conflitto: { messaggio: errore.message, versioneAttuale } })
      )
      const html =
        frammento ?? (await view.render('components/conflitto', { messaggio: errore.message }))
      return response.status(409).send(html)
    }

    if (request.accepts(['html', 'json']) === 'json') {
      return response.status(409).send({
        errore: errore.code,
        messaggio: errore.message,
        versioneAttuale,
      })
    }

    const html = await view.render('pages/conflitto', {
      messaggio: errore.message,
      frammento: frammento ?? '',
    })
    return response.status(409).send(html)
  }
}

/**
 * Aggiorna la riga `id` solo se la sua `version` è ancora `versioneAttesa`.
 *
 * - blocca la riga (SELECT … FOR UPDATE) nella transazione;
 * - se la versione non corrisponde lancia `ConflittoVersione` (409);
 * - applica le modifiche, incrementa `version`, salva;
 * - con `opzioni.audit` registra prima/dopo nell'audit nella stessa transazione.
 *
 * @param applica oggetto con i campi da cambiare oppure funzione che modifica l'istanza
 */
export async function aggiornaConVersione<M extends LucidModel>(
  Modello: M,
  id: number,
  versioneAttesa: number,
  applica:
    | Partial<ModelAttributes<InstanceType<M>>>
    | ((istanza: InstanceType<M>) => void | Promise<void>),
  opzioni: OpzioniAggiornamento<InstanceType<M>> = {}
): Promise<InstanceType<M>> {
  const esegui = async (trx: TransactionClientContract) => {
    const riga = (await Modello.query({ client: trx })
      .where('id', id)
      .where('version', versioneAttesa)
      .forUpdate()
      .first()) as (InstanceType<M> & ConVersione) | null

    if (!riga) {
      const attuale = (await Modello.query({ client: trx })
        .where('id', id)
        .first()) as InstanceType<M> | null
      throw new ConflittoVersione<InstanceType<M>>(attuale, versioneAttesa, opzioni.rendiFrammento)
    }

    const prima = opzioni.audit ? istantaneaPerAudit(riga) : null
    if (typeof applica === 'function') {
      await applica(riga)
    } else {
      ;(riga as InstanceType<M>).merge(applica)
    }
    riga.version = versioneAttesa + 1
    riga.useTransaction(trx)
    await riga.save()

    if (opzioni.audit) {
      await registraAudit(
        {
          utenteId: opzioni.audit.utenteId,
          azione: opzioni.audit.azione,
          entita: Modello.table,
          entitaId: riga.id,
          commessaId: opzioni.audit.commessaId ?? null,
          prima,
          dopo: istantaneaPerAudit(riga),
          ip: opzioni.audit.ip ?? null,
        },
        trx
      )
    }
    return riga as InstanceType<M>
  }

  if (opzioni.client) return esegui(opzioni.client)
  return db.transaction(esegui)
}
