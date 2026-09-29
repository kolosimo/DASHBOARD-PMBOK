/**
 * CambioStatoService: l'UNICO punto dell'app che scrive `elaborati.stato_id`,
 * `elaborati.stato_dal` e inserisce righe in `transizioni_elaborato`.
 * Proprietario: agente A3.
 *
 * Regole (docs/formule/formule.md, sezione Flusso):
 * - si avanza di uno stato alla volta; il salto di stato è rifiutato (422);
 * - per tornare indietro serve un motivo (rilavorazione);
 * - superare il limite WIP della colonna di arrivo va confermato, con un motivo,
 *   e finisce nell'audit (`kanban.wip_sforato`);
 * - optimistic locking sulla `version` dell'elaborato (409 se è cambiata);
 * - dopo il commit si pubblica `elaborato.stato_cambiato` sul canale della commessa.
 *
 * Uso dal modulo anagrafiche (creazione di un elaborato nuovo), nella stessa
 * transazione dell'inserimento:
 *
 *   const iniziale = await CambioStatoService.statoIniziale(trx)
 *   const el = await Elaborato.create({ ...campi, statoId: iniziale.statoId, statoDal: iniziale.statoDal }, { client: trx })
 *   await CambioStatoService.registraCreazione(el.id, utenteId, trx)
 */
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Elaborato from '#models/elaborato'
import TransizioneElaborato from '#models/transizione_elaborato'
import { aggiornaConVersione, type RendiFrammento } from '#shared/optimistic'
import { registraAudit } from '#shared/audit'
import { pubblica } from '#shared/eventi'
import { controllaPassaggioStato, sforaWip } from '#domain/flusso'
import { configurazioneFlusso, type ColonnaFlusso, type StatoFlusso } from './stati.js'

/** Spazio dei lock consultivi di PostgreSQL usato dal flusso (per commessa) */
const LOCK_FLUSSO = 3

/** Passaggio di stato non ammesso dalla regola di avanzamento (422) */
export class PassaggioNonAmmesso extends Exception {
  static status = 422
  static code = 'E_PASSAGGIO_NON_AMMESSO'
  constructor(messaggio: string) {
    super(messaggio, { status: 422, code: 'E_PASSAGGIO_NON_AMMESSO' })
  }
}

/** Il passaggio supera il limite WIP della colonna: serve una conferma (422) */
export class WipDaConfermare extends Exception {
  static status = 422
  static code = 'E_WIP_DA_CONFERMARE'
  constructor(
    public colonna: ColonnaFlusso,
    public elaboratiInColonna: number,
    public aStato: StatoFlusso
  ) {
    super(
      `La colonna "${colonna.nome}" ha già ${elaboratiInColonna} elaborati con limite WIP ${colonna.limiteWip}. ` +
        'Per superarlo conferma e indica il motivo.',
      { status: 422, code: 'E_WIP_DA_CONFERMARE' }
    )
  }
}

/** Elaborato inesistente o di un'altra commessa (404) */
export class ElaboratoNonTrovato extends Exception {
  static status = 404
  static code = 'E_ELABORATO_NON_TROVATO'
  constructor() {
    super('Elaborato non trovato.', { status: 404, code: 'E_ELABORATO_NON_TROVATO' })
  }
}

export interface RichiestaCambioStato {
  elaboratoId: number
  /** Se indicata, l'elaborato deve appartenere a questa commessa (404 altrimenti) */
  commessaId?: number
  /** Versione dell'elaborato vista dall'utente */
  versioneAttesa: number
  aStatoId: number
  /** Obbligatorio per tornare indietro e per confermare lo sforamento WIP */
  motivo?: string | null
  /** true quando l'utente ha confermato lo sforamento del limite WIP */
  confermaWip?: boolean
  utenteId: number | null
  ip?: string | null
  /** Frammento da mostrare in caso di 409 */
  rendiFrammento?: RendiFrammento<Elaborato>
}

export interface EsitoCambioStato {
  elaborato: Elaborato
  daStato: StatoFlusso
  aStato: StatoFlusso
  wipSforato: boolean
}

function motivoPulito(motivo: string | null | undefined): string | null {
  const m = (motivo ?? '').trim()
  return m === '' ? null : m
}

export default class CambioStatoService {
  /**
   * Cambia lo stato di un elaborato. Lancia:
   * - `ConflittoVersione` (409) se la versione è cambiata nel frattempo;
   * - `PassaggioNonAmmesso` (422) per salti di stato o ritorni senza motivo;
   * - `WipDaConfermare` (422) se si sfora il WIP senza conferma e motivo;
   * - `ElaboratoNonTrovato` (404).
   */
  static async cambia(richiesta: RichiestaCambioStato): Promise<EsitoCambioStato> {
    const motivo = motivoPulito(richiesta.motivo)

    const esito = await db.transaction(async (trx) => {
      const base = await Elaborato.query({ client: trx })
        .where('id', richiesta.elaboratoId)
        .select('id', 'commessa_id')
        .first()
      if (
        !base ||
        (richiesta.commessaId !== undefined && base.commessaId !== richiesta.commessaId)
      ) {
        throw new ElaboratoNonTrovato()
      }
      const commessaId = base.commessaId

      // Un cambio di stato alla volta per commessa: i conteggi WIP restano coerenti
      await trx.rawQuery('SELECT pg_advisory_xact_lock(?, ?)', [LOCK_FLUSSO, commessaId])

      const conf = await configurazioneFlusso(commessaId, trx)
      const aStato = conf.statoPerId.get(richiesta.aStatoId)
      if (!aStato) throw new PassaggioNonAmmesso('Stato di destinazione non valido.')

      let daStato: StatoFlusso | undefined
      let wipSforato = false
      let colonnaArrivo: ColonnaFlusso | undefined
      let inColonna = 0
      const adesso = DateTime.now()

      const elaborato = await aggiornaConVersione(
        Elaborato,
        richiesta.elaboratoId,
        richiesta.versioneAttesa,
        async (riga) => {
          daStato = conf.statoPerId.get(riga.statoId)
          if (!daStato) throw new PassaggioNonAmmesso('Lo stato attuale non è configurato.')
          const errore = controllaPassaggioStato(daStato.posizione, aStato.posizione, motivo)
          if (errore) throw new PassaggioNonAmmesso(errore)

          if (aStato.colonnaId !== daStato.colonnaId) {
            colonnaArrivo = conf.colonne.find((c) => c.id === aStato.colonnaId)
            const statiColonna = conf.stati
              .filter((s) => s.colonnaId === aStato.colonnaId)
              .map((s) => s.id)
            const [{ n }] = await trx
              .from('elaborati')
              .where('commessa_id', commessaId)
              .whereIn('stato_id', statiColonna)
              .count('* as n')
            inColonna = Number(n)
            if (colonnaArrivo && sforaWip(inColonna, colonnaArrivo.limiteWip)) {
              if (!richiesta.confermaWip || motivo === null) {
                throw new WipDaConfermare(colonnaArrivo, inColonna, aStato)
              }
              wipSforato = true
            }
          }

          riga.statoId = aStato.id
          riga.statoDal = adesso
        },
        {
          client: trx,
          audit: {
            utenteId: richiesta.utenteId,
            azione: 'elaborato.stato_cambiato',
            commessaId,
            ip: richiesta.ip ?? null,
          },
          rendiFrammento: richiesta.rendiFrammento,
        }
      )

      await TransizioneElaborato.create(
        {
          elaboratoId: elaborato.id,
          daStatoId: daStato!.id,
          aStatoId: aStato.id,
          utenteId: richiesta.utenteId,
          motivo,
          wipSforato,
          avvenutaIl: adesso,
        },
        { client: trx }
      )

      if (wipSforato && colonnaArrivo) {
        await registraAudit(
          {
            utenteId: richiesta.utenteId,
            azione: 'kanban.wip_sforato',
            entita: 'elaborati',
            entitaId: elaborato.id,
            commessaId,
            dopo: {
              elaborato: elaborato.codice,
              colonna: colonnaArrivo.codice,
              limiteWip: colonnaArrivo.limiteWip,
              elaboratiPrima: inColonna,
              daStato: daStato!.codice,
              aStato: aStato.codice,
              motivo,
            },
            ip: richiesta.ip ?? null,
          },
          trx
        )
      }

      return { elaborato, daStato: daStato!, aStato, wipSforato }
    })

    pubblica(esito.elaborato.commessaId, 'elaborato.stato_cambiato', {
      elaboratoId: esito.elaborato.id,
      statoId: esito.aStato.id,
    })
    return esito
  }

  /**
   * Stato di partenza di un elaborato nuovo: il primo stato in ordine
   * ("Non iniziato" nei dati di esempio), da adesso. Null se non c'è nessuno
   * stato configurato (il chiamante mostra un messaggio all'utente).
   */
  static async statoInizialeSeConfigurato(
    client?: TransactionClientContract
  ): Promise<{ statoId: number; statoDal: DateTime } | null> {
    const riga = await (client ?? db)
      .from('stati_elaborato')
      .select('id')
      .orderBy('ordine', 'asc')
      .orderBy('id', 'asc')
      .first()
    return riga ? { statoId: Number(riga.id), statoDal: DateTime.now() } : null
  }

  /** Come `statoInizialeSeConfigurato`, ma lancia un errore se non c'è nessuno stato */
  static async statoIniziale(
    client?: TransactionClientContract
  ): Promise<{ statoId: number; statoDal: DateTime }> {
    const iniziale = await CambioStatoService.statoInizialeSeConfigurato(client)
    if (!iniziale) throw new Error('Nessuno stato dell’elaborato configurato')
    return iniziale
  }

  /**
   * Registra la creazione di un elaborato appena inserito (anche da import):
   * scrive la transizione di nascita (nessuno stato → stato attuale, all'istante
   * `stato_dal`). Va chiamata nella stessa transazione dell'inserimento, dopo
   * aver creato la riga con lo stato restituito da `statoIniziale()`.
   */
  static async registraCreazione(
    elaboratoId: number,
    utenteId: number | null,
    trx: TransactionClientContract
  ): Promise<TransizioneElaborato> {
    const el = await Elaborato.query({ client: trx })
      .where('id', elaboratoId)
      .select('id', 'stato_id', 'stato_dal')
      .first()
    if (!el) throw new ElaboratoNonTrovato()
    return CambioStatoService.registraNascita(el, utenteId, trx)
  }

  /**
   * Registra la "nascita" dell'elaborato nello storico (transizione da nessuno
   * stato allo stato iniziale): serve a CFD e cycle time. Da chiamare nella
   * stessa transazione dell'inserimento.
   */
  static async registraNascita(
    elaborato: Pick<Elaborato, 'id' | 'statoId' | 'statoDal'>,
    utenteId: number | null,
    client?: TransactionClientContract
  ): Promise<TransizioneElaborato> {
    return TransizioneElaborato.create(
      {
        elaboratoId: elaborato.id,
        daStatoId: null,
        aStatoId: elaborato.statoId,
        utenteId,
        motivo: null,
        wipSforato: false,
        avvenutaIl: elaborato.statoDal ?? DateTime.now(),
      },
      client ? { client } : undefined
    )
  }
}
