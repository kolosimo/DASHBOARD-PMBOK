/**
 * Snapshot settimanali del Last Planner (solo inserimenti, idempotenti).
 *
 * - snapshot_lps(w): PPC, PCR, TMR/TA congelati a settimana chiusa. Si scatta
 *   quando la settimana w è finita e il piano di w è chiuso (o non c'è), oppure
 *   al più tardi quando è finita anche w + 1 (il piano non chiuso conta come
 *   è: gli impegni non segnati valgono "non fatto"). Si recuperano le
 *   settimane perse dall'ultimo snapshot (al massimo 52).
 * - snapshot_lookahead(w): fotografia del lookahead all'inizio della
 *   settimana corrente (base del TMR/TA di w + 2). Le settimane passate non
 *   si possono ricostruire: se il job non è girato, lo snapshot manca e
 *   TMR/TA di quella settimana restano n.d.
 *
 * `ON CONFLICT DO NOTHING` sulle chiavi uniche rende il job rieseguibile.
 */
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { Lunedi } from '#domain/types'
import { aggiungiSettimane, differenzaSettimane, lunediDellaSettimana } from '#shared/calendario'
import { leggiImpostazione } from '#shared/impostazioni'
import { indicatoriSettimana, attivitaLookahead } from './queries.js'

/** Settimane recuperate al massimo in una esecuzione */
export const MASSIMO_RECUPERO_SETTIMANE = 52

/** Scrive lo snapshot_lps di una settimana (se manca). true se inserito. */
export async function scattaSnapshotLps(commessaId: number, settimana: Lunedi): Promise<boolean> {
  const ind = await indicatoriSettimana(commessaId, settimana)
  const righe = await db
    .table('snapshot_lps')
    .insert({
      commessa_id: commessaId,
      settimana,
      impegni_promessi: ind.ppc.promessi,
      impegni_fatti: ind.ppc.fatti,
      ppc: ind.ppc.ppc,
      vincoli_da_rimuovere: ind.pcr.daRimuovere,
      vincoli_rimossi: ind.pcr.rimossi,
      pcr: ind.pcr.pcr,
      tmr: ind.tmrTa.tmr,
      ta: ind.tmrTa.ta,
    })
    .onConflict(['commessa_id', 'settimana'])
    .ignore()
    .returning('id')
  return righe.length > 0
}

/** Scrive lo snapshot del lookahead della settimana (se manca). Righe inserite. */
export async function scattaSnapshotLookahead(
  commessaId: number,
  settimana: Lunedi
): Promise<number> {
  const esiste = await db
    .from('snapshot_lookahead')
    .where('commessa_id', commessaId)
    .where('settimana', settimana)
    .first()
  if (esiste) return 0
  const n = await leggiImpostazione('lps.settimane_lookahead')
  const attivita = await attivitaLookahead(
    commessaId,
    settimana,
    aggiungiSettimane(settimana, Math.max(1, n) - 1)
  )
  if (attivita.length === 0) return 0
  const righe = await db
    .table('snapshot_lookahead')
    .insert(
      attivita.map((a) => ({
        commessa_id: commessaId,
        settimana,
        attivita_id: a.id,
        codice_attivita: a.codice,
        titolo_attivita: a.titolo,
        settimana_inizio: a.settimanaInizio,
        settimana_fine: a.settimanaFine,
        vincoli_aperti: a.vincoliAperti,
        pronta: a.pronta,
      }))
    )
    .onConflict(['commessa_id', 'settimana', 'codice_attivita'])
    .ignore()
    .returning('id')
  return righe.length
}

/** Settimane di una commessa per cui manca lo snapshot_lps e che si possono scattare ora */
export async function settimaneDaFotografare(
  commessaId: number,
  lunediCorrente: Lunedi
): Promise<Lunedi[]> {
  const ultimo = await db
    .from('snapshot_lps')
    .where('commessa_id', commessaId)
    .max('settimana as s')
    .first()
  const primoPiano = await db
    .from('piani_settimanali')
    .where('commessa_id', commessaId)
    .min('settimana as s')
    .first()
  let inizio: Lunedi | null = ultimo?.s ? aggiungiSettimane(ultimo.s, 1) : (primoPiano?.s ?? null)
  if (!inizio) return []
  const minimo = aggiungiSettimane(lunediCorrente, -MASSIMO_RECUPERO_SETTIMANE)
  if (inizio < minimo) inizio = minimo
  const totale = differenzaSettimane(inizio, lunediCorrente)
  if (totale <= 0) return []

  const piani = await db
    .from('piani_settimanali')
    .where('commessa_id', commessaId)
    .where('settimana', '>=', inizio)
    .where('settimana', '<', lunediCorrente)
    .select('settimana', 'stato')
  const statoPiano = new Map(piani.map((p) => [p.settimana as string, p.stato as string]))
  const settimanaScorsa = aggiungiSettimane(lunediCorrente, -1)

  const esito: Lunedi[] = []
  for (let i = 0; i < totale; i++) {
    const w = aggiungiSettimane(inizio, i)
    const stato = statoPiano.get(w)
    // La settimana appena finita aspetta la chiusura del piano (al più una settimana)
    if (w === settimanaScorsa && stato !== undefined && stato !== 'chiuso') break
    esito.push(w)
  }
  return esito
}

export interface EsitoSnapshot {
  snapshotLps: number
  righeLookahead: number
}

/**
 * Job: per ogni commessa non chiusa scatta gli snapshot_lps mancanti e lo
 * snapshot del lookahead della settimana corrente. Idempotente.
 */
export async function eseguiSnapshotSettimanali(adesso: Date = new Date()): Promise<EsitoSnapshot> {
  const lunediCorrente = lunediDellaSettimana(adesso)
  const commesse = await db.from('commesse').whereNot('stato', 'chiusa').select('id')
  const esito: EsitoSnapshot = { snapshotLps: 0, righeLookahead: 0 }
  for (const { id } of commesse) {
    try {
      for (const w of await settimaneDaFotografare(id, lunediCorrente)) {
        if (await scattaSnapshotLps(id, w)) esito.snapshotLps++
      }
      esito.righeLookahead += await scattaSnapshotLookahead(id, lunediCorrente)
    } catch (errore) {
      logger.error({ commessaId: id, err: errore }, 'snapshot LPS non riuscito')
    }
  }
  return esito
}
