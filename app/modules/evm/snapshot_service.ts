/**
 * Snapshot settimanale dell'EVM (snapshot_evm + snapshot_evm_elaborato).
 *
 * - Lo snapshot della settimana w si scatta quando è scaduto il termine per
 *   modificare le ore di w (`ore.giorni_modifica_consentita` giorni dopo la
 *   domenica): da quel momento le ore della settimana sono definitive.
 * - EV dallo stato che ogni elaborato aveva a fine settimana (domenica
 *   23:59 a Roma) con i pesi congelati della baseline; AC dalle ore fino alla
 *   domenica; PV dal valore congelato in baseline_pv_settimana.
 * - Idempotente: una settimana già fotografata non si tocca (ON CONFLICT DO
 *   NOTHING sul vincolo unico commessa + settimana).
 * - Rettifica tardiva: se le ore di una settimana già fotografata cambiano, lo
 *   snapshot resta com'è ma viene segnato `rettificato` con l'AC ricalcolato.
 */
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DataIso, Lunedi } from '#domain/types'
import {
  FUSO,
  aggiungiSettimane,
  differenzaGiorni,
  domenicaDi,
  lunediDellaSettimana,
  oggiRoma,
} from '#shared/calendario'
import { leggiImpostazione } from '#shared/impostazioni'
import { registraAudit } from '#shared/audit'
import { caricaContesto, componiEvm, righeElaborati } from './queries.js'

export interface EsitoSnapshot {
  creati: { commessaId: number; settimana: Lunedi }[]
  rettificati: { commessaId: number; settimana: Lunedi; acPrima: number; acOra: number }[]
}

/** Arrotonda un indice a 4 decimali (colonna decimal(10,4)) */
function indice4(x: number | null): number | null {
  return x === null ? null : Math.round(x * 10_000) / 10_000
}

/** Ultima settimana le cui ore non sono più modificabili a `oggi` */
export function ultimaSettimanaChiusa(oggi: DataIso, giorniModifica: number): Lunedi {
  let w = aggiungiSettimane(lunediDellaSettimana(oggi), -1)
  // La settimana w è chiusa se oggi > domenica(w) + giorniModifica
  while (differenzaGiorni(domenicaDi(w), oggi) <= giorniModifica) {
    w = aggiungiSettimane(w, -1)
  }
  return w
}

/** Istante di fine settimana: il lunedì successivo alle 00:00 a Roma (escluso) */
function fineSettimana(lunedi: Lunedi): string {
  return DateTime.fromISO(aggiungiSettimane(lunedi, 1), { zone: FUSO }).toISO()!
}

/**
 * Scatta lo snapshot di una settimana per una commessa, nella transazione.
 * Restituisce true se è stato creato, false se esisteva già.
 */
export async function scattaSettimana(
  commessaId: number,
  settimana: Lunedi,
  trx: TransactionClientContract
): Promise<boolean> {
  const contesto = await caricaContesto(commessaId, trx)
  if (!contesto.baseline) return false
  const domenica = domenicaDi(settimana)
  const righe = await righeElaborati(commessaId, domenica, fineSettimana(settimana), trx)
  const { indicatori, perElaborato } = componiEvm(contesto, righe, domenica)

  // ON CONFLICT DO NOTHING: due esecuzioni concorrenti non creano doppioni
  const inseriti: { id: number }[] = await trx
    .insertQuery()
    .table('snapshot_evm')
    .knexQuery.insert({
      commessa_id: commessaId,
      baseline_id: contesto.baseline.id,
      settimana,
      bac_minuti: indicatori.bacMinuti,
      pv_minuti: indicatori.pvMinuti,
      ev_minuti: indicatori.evMinuti,
      ac_minuti: indicatori.acMinuti,
      spi: indice4(indicatori.spi),
      cpi: indice4(indicatori.cpi),
      eac_minuti: indicatori.eacMinuti,
      etc_minuti: indicatori.etcMinuti,
      vac_minuti: indicatori.vacMinuti,
    })
    .onConflict(['commessa_id', 'settimana'])
    .ignore()
    .returning('id')
  const riga = inseriti[0]
  if (!riga) return false

  if (perElaborato.length > 0) {
    await trx.table('snapshot_evm_elaborato').multiInsert(
      perElaborato.map((e) => ({
        snapshot_id: riga.id,
        elaborato_id: e.elaboratoId,
        stato_id: e.statoId,
        budget_minuti: e.budgetMinuti,
        pv_minuti: e.pvMinuti,
        ev_minuti: e.evMinuti,
        ac_minuti: e.acMinuti,
      }))
    )
  }
  return true
}

/**
 * Segna come rettificati gli snapshot della commessa le cui ore sono
 * cambiate dopo lo scatto. I valori storici non si modificano.
 */
async function controllaRettifiche(
  commessaId: number,
  trx: TransactionClientContract
): Promise<EsitoSnapshot['rettificati']> {
  const risultato = await trx.rawQuery(
    `SELECT s.id, s.settimana, s.ac_minuti, s.ac_rettificato_minuti,
            CAST(COALESCE((
              SELECT SUM(r.minuti) FROM registrazioni_ore r
                JOIN elaborati e ON e.id = r.elaborato_id
               WHERE e.commessa_id = s.commessa_id AND r.data <= s.settimana + 6
            ), 0) AS integer) AS ac_ora
       FROM snapshot_evm s
      WHERE s.commessa_id = ?
      ORDER BY s.settimana`,
    [commessaId]
  )
  const esito: EsitoSnapshot['rettificati'] = []
  for (const r of risultato.rows as Record<string, unknown>[]) {
    const acSnapshot = Number(r.ac_minuti)
    const acNoto = r.ac_rettificato_minuti === null ? acSnapshot : Number(r.ac_rettificato_minuti)
    const acOra = Number(r.ac_ora)
    if (acOra === acNoto) continue
    await trx
      .from('snapshot_evm')
      .where('id', Number(r.id))
      .update({ rettificato: true, ac_rettificato_minuti: acOra, rettificato_il: new Date() })
    const settimana = String(r.settimana)
    await registraAudit(
      {
        utenteId: null,
        azione: 'evm.snapshot_rettificato',
        entita: 'snapshot_evm',
        entitaId: Number(r.id),
        commessaId,
        prima: { settimana, acMinuti: acNoto },
        dopo: { settimana, acMinuti: acOra },
      },
      trx
    )
    esito.push({ commessaId, settimana, acPrima: acNoto, acOra })
  }
  return esito
}

/**
 * Job: per ogni commessa con baseline approvata scatta gli snapshot mancanti
 * delle settimane chiuse (dall'approvazione della prima baseline e
 * dall'inizio del PV) e segna le rettifiche tardive.
 */
export async function scattaSnapshotEvm(oggi: DataIso = oggiRoma()): Promise<EsitoSnapshot> {
  const giorniModifica = await leggiImpostazione('ore.giorni_modifica_consentita')
  const ultima = ultimaSettimanaChiusa(oggi, Number(giorniModifica))

  const commesse = await db.rawQuery(
    `SELECT b.commessa_id,
            (SELECT MIN(b2.approvata_il) FROM baseline b2
              WHERE b2.commessa_id = b.commessa_id AND b2.approvata_il IS NOT NULL) AS prima_approvazione,
            (SELECT MIN(p.settimana) FROM baseline_pv_settimana p WHERE p.baseline_id = b.id) AS inizio_pv
       FROM baseline b
      WHERE b.stato = 'approvata'
      ORDER BY b.commessa_id`
  )

  const esito: EsitoSnapshot = { creati: [], rettificati: [] }
  for (const c of commesse.rows as Record<string, unknown>[]) {
    const commessaId = Number(c.commessa_id)
    const candidati: Lunedi[] = []
    if (c.prima_approvazione) {
      const approvazione = lunediDellaSettimana(
        c.prima_approvazione instanceof Date ? c.prima_approvazione : String(c.prima_approvazione)
      )
      const inizioPv = c.inizio_pv ? String(c.inizio_pv) : approvazione
      const prima = approvazione > inizioPv ? approvazione : inizioPv
      for (let w = prima; w <= ultima; w = aggiungiSettimane(w, 1)) candidati.push(w)
    }

    await db.transaction(async (trx) => {
      if (candidati.length > 0) {
        const esistenti = await trx
          .from('snapshot_evm')
          .where('commessa_id', commessaId)
          .whereIn('settimana', candidati)
          .select('settimana')
        const giaFatte = new Set(esistenti.map((r) => String(r.settimana)))
        for (const settimana of candidati) {
          if (giaFatte.has(settimana)) continue
          if (await scattaSettimana(commessaId, settimana, trx)) {
            esito.creati.push({ commessaId, settimana })
          }
        }
      }
      esito.rettificati.push(...(await controllaRettifiche(commessaId, trx)))
    })
  }
  return esito
}
