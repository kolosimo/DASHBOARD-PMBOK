/**
 * Scritture sulla baseline (tabelle baseline, baseline_date_stato,
 * baseline_pv_settimana). Proprietario: agente A5.
 *
 * Ciclo di vita:
 * - bozza: date previste modificabili (una sola bozza per commessa);
 * - approvata: pesi, budget, BAC e PV settimanale **congelati**; una sola
 *   attiva per commessa (indice unico parziale nel DB);
 * - superata: sostituita da una re-baseline (nuova riga con motivo).
 */
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Baseline from '#models/baseline'
import BaselineDataStato from '#models/baseline_data_stato'
import type Commessa from '#models/commessa'
import type { DataIso } from '#domain/types'
import { aggiornaConVersione, ConflittoVersione, type RendiFrammento } from '#shared/optimistic'
import { istantaneaPerAudit, registraAudit } from '#shared/audit'
import { pubblica } from '#shared/eventi'
import { aggiungiSettimane, lunediDellaSettimana, oggiRoma } from '#shared/calendario'
import {
  controllaSequenzaDate,
  dataValida,
  distribuisciDate,
  pvSettimanali,
  type DataPrevista,
  type ElaboratoBaseline,
} from './calcoli.js'
import { baselineAttiva, baselineInBozza, elaboratiDellaBaseline, statiElaborato } from './queries.js'

/** Errore di validazione della baseline: 422 con messaggio per l'utente */
export class ErroreBaseline extends Error {
  status = 422
}

/** Intervallo di default per le date generate automaticamente */
function intervalloDefault(commessa: Commessa, oggi: DataIso, rebaseline: boolean) {
  let inizio = commessa.dataInizio ?? oggi
  if (rebaseline && inizio < oggi) inizio = oggi
  let fine = commessa.dataFinePrevista ?? aggiungiSettimane(lunediDellaSettimana(inizio), 12)
  if (fine < inizio) fine = inizio
  return { inizio, fine }
}

/** Righe baseline_date_stato distribuite tra inizio e fine per un elaborato */
function righeAutomatiche(
  baselineId: number,
  elaborato: { id: number; budget_minuti: number },
  statiPianificabili: { id: number }[],
  inizio: DataIso,
  fine: DataIso
) {
  const date = distribuisciDate(inizio, fine, statiPianificabili.length)
  return statiPianificabili.map((s, i) => ({
    baseline_id: baselineId,
    elaborato_id: elaborato.id,
    stato_id: s.id,
    budget_minuti: elaborato.budget_minuti,
    data_prevista: date[i],
  }))
}

/**
 * Crea la bozza di una nuova baseline. Se esiste una baseline attiva è una
 * re-baseline: il motivo è obbligatorio e le date partono da quella attiva.
 */
export async function creaBozza(
  commessa: Commessa,
  utenteId: number,
  motivo: string | null,
  oggi: DataIso = oggiRoma()
): Promise<Baseline> {
  const bozza = await db.transaction(async (trx) => {
    // Serializza le creazioni concorrenti sulla stessa commessa
    await trx.rawQuery('SELECT id FROM commesse WHERE id = ? FOR UPDATE', [commessa.id])
    if (await baselineInBozza(commessa.id, trx)) {
      throw new ErroreBaseline('Esiste già una bozza di baseline: modificala o scartala.')
    }
    const attiva = await baselineAttiva(commessa.id, trx)
    const testoMotivo = motivo?.trim() || null
    if (attiva && !testoMotivo) {
      throw new ErroreBaseline(
        'Per una nuova baseline (re-baseline) serve il motivo: scrivi perché la pianificazione cambia.'
      )
    }

    const stati = await statiElaborato(trx)
    const pesi = Object.fromEntries(stati.map((s) => [s.codice, s.pesoAttuale]))
    const massimo = await trx
      .from('baseline')
      .where('commessa_id', commessa.id)
      .max('numero as n')
      .first()
    const numero = Number(massimo?.n ?? 0) + 1

    const nuova = await Baseline.create(
      {
        commessaId: commessa.id,
        numero,
        stato: 'bozza',
        pesiStati: pesi,
        bacMinuti: 0,
        note: testoMotivo,
      },
      { client: trx }
    )

    const elaborati = await trx
      .from('elaborati')
      .where('commessa_id', commessa.id)
      .select('id', 'budget_minuti')
    const statiPianificabili = stati.filter((s) => s.ordine > 0)
    const { inizio, fine } = intervalloDefault(commessa, oggi, attiva !== null)

    const righe: Record<string, unknown>[] = []
    if (attiva) {
      // Re-baseline: si parte dalle date della baseline attiva
      const precedenti = await trx
        .from('baseline_date_stato')
        .where('baseline_id', attiva.id)
        .select('elaborato_id', 'stato_id', 'data_prevista')
      const perChiave = new Map(
        precedenti.map((p) => [`${p.elaborato_id}:${p.stato_id}`, String(p.data_prevista)])
      )
      for (const e of elaborati) {
        const automatiche = righeAutomatiche(nuova.id, e, statiPianificabili, inizio, fine)
        for (const r of automatiche) {
          const precedente = perChiave.get(`${e.id}:${r.stato_id}`)
          righe.push(precedente ? { ...r, data_prevista: precedente } : r)
        }
      }
    } else {
      for (const e of elaborati) {
        righe.push(...righeAutomatiche(nuova.id, e, statiPianificabili, inizio, fine))
      }
    }
    if (righe.length > 0) await trx.table('baseline_date_stato').multiInsert(righe)

    await registraAudit(
      {
        utenteId,
        azione: attiva ? 'evm.rebaseline_creata' : 'evm.baseline_creata',
        entita: 'baseline',
        entitaId: nuova.id,
        commessaId: commessa.id,
        dopo: istantaneaPerAudit(nuova),
      },
      trx
    )
    return nuova
  })
  pubblica(commessa.id, 'baseline.aggiornata', { baselineId: bozza.id })
  return bozza
}

/** Blocca la baseline e verifica che sia una bozza della commessa */
async function bozzaModificabile(
  commessaId: number,
  baselineId: number,
  trx: TransactionClientContract
) {
  const riga = await trx
    .from('baseline')
    .where('id', baselineId)
    .where('commessa_id', commessaId)
    .forUpdate()
    .first()
  if (!riga) throw new ErroreBaseline('Baseline non trovata.')
  if (riga.stato !== 'bozza') {
    throw new ErroreBaseline(
      'Questa baseline è già approvata: le date sono congelate. Per cambiarle crea una nuova baseline.'
    )
  }
  return riga
}

export interface CellaData {
  statoId: number
  data: string
  version: number
}

/**
 * Salva le date previste di un elaborato nella bozza. Ogni cella porta la
 * versione vista dall'utente: se qualcuno l'ha cambiata nel frattempo, 409.
 */
export async function salvaDateElaborato(
  commessaId: number,
  baselineId: number,
  elaboratoId: number,
  celle: CellaData[],
  utenteId: number,
  rendiFrammento?: RendiFrammento<BaselineDataStato>
) {
  for (const c of celle) {
    if (!dataValida(c.data)) {
      throw new ErroreBaseline('Ogni stato deve avere una data valida (gg/mm/aaaa).')
    }
  }
  await db.transaction(async (trx) => {
    await bozzaModificabile(commessaId, baselineId, trx)
    const righe = await trx
      .from('baseline_date_stato as d')
      .join('stati_elaborato as s', 's.id', 'd.stato_id')
      .where('d.baseline_id', baselineId)
      .where('d.elaborato_id', elaboratoId)
      .select('d.id', 'd.stato_id', 'd.data_prevista', 's.ordine')
    if (righe.length === 0) throw new ErroreBaseline('Elaborato non presente nella bozza.')

    const perStato = new Map(righe.map((r) => [Number(r.stato_id), r]))
    const nuove: DataPrevista[] = righe.map((r) => {
      const cella = celle.find((c) => c.statoId === Number(r.stato_id))
      return {
        ordine: Number(r.ordine),
        data: (cella ? cella.data : String(r.data_prevista)) as DataIso,
      }
    })
    const errore = controllaSequenzaDate(nuove)
    if (errore) throw new ErroreBaseline(errore)

    const prima = Object.fromEntries(righe.map((r) => [r.stato_id, String(r.data_prevista)]))
    for (const c of celle) {
      const riga = perStato.get(c.statoId)
      if (!riga) continue
      await aggiornaConVersione(
        BaselineDataStato,
        Number(riga.id),
        c.version,
        { dataPrevista: c.data },
        { client: trx, rendiFrammento }
      )
    }
    await registraAudit(
      {
        utenteId,
        azione: 'evm.baseline_date_modificate',
        entita: 'baseline_date_stato',
        entitaId: `${baselineId}:${elaboratoId}`,
        commessaId,
        prima,
        dopo: Object.fromEntries(celle.map((c) => [c.statoId, c.data])),
      },
      trx
    )
  })
  pubblica(commessaId, 'baseline.aggiornata', { baselineId })
}

/** Aggiunge alla bozza gli elaborati che non hanno ancora date (distribuite in automatico) */
export async function aggiungiElaboratiMancanti(
  commessa: Commessa,
  baselineId: number,
  utenteId: number,
  oggi: DataIso = oggiRoma()
): Promise<number> {
  const aggiunti = await db.transaction(async (trx) => {
    await bozzaModificabile(commessa.id, baselineId, trx)
    const mancanti = await trx
      .from('elaborati as e')
      .where('e.commessa_id', commessa.id)
      .whereNotExists((q) =>
        q
          .from('baseline_date_stato as d')
          .whereColumn('d.elaborato_id', 'e.id')
          .where('d.baseline_id', baselineId)
      )
      .select('e.id', 'e.budget_minuti')
    if (mancanti.length === 0) return 0
    const stati = (await statiElaborato(trx)).filter((s) => s.ordine > 0)
    const rebaseline = (await baselineAttiva(commessa.id, trx)) !== null
    const { inizio, fine } = intervalloDefault(commessa, oggi, rebaseline)
    const righe = mancanti.flatMap((e) => righeAutomatiche(baselineId, e, stati, inizio, fine))
    await trx.table('baseline_date_stato').multiInsert(righe)
    await registraAudit(
      {
        utenteId,
        azione: 'evm.baseline_elaborati_aggiunti',
        entita: 'baseline',
        entitaId: baselineId,
        commessaId: commessa.id,
        dopo: { elaborati: mancanti.map((e) => Number(e.id)) },
      },
      trx
    )
    return mancanti.length
  })
  if (aggiunti > 0) pubblica(commessa.id, 'baseline.aggiornata', { baselineId })
  return aggiunti
}

/**
 * Approva la bozza: congela pesi, budget, BAC e PV cumulato per settimana;
 * la baseline attiva precedente diventa "superata".
 */
export async function approvaBaseline(
  commessa: Commessa,
  baselineId: number,
  versioneAttesa: number,
  utenteId: number
): Promise<Baseline> {
  const approvata = await db.transaction(async (trx) => {
    await bozzaModificabile(commessa.id, baselineId, trx)
    const stati = await statiElaborato(trx)
    const statiPianificabili = stati.filter((s) => s.ordine > 0)

    // Completezza: ogni elaborato della commessa ha una data per ogni stato
    const elaborati = await trx
      .from('elaborati')
      .where('commessa_id', commessa.id)
      .orderBy('codice')
      .select('id', 'codice', 'budget_minuti')
    if (elaborati.length === 0) {
      throw new ErroreBaseline('La commessa non ha elaborati: non c’è niente da pianificare.')
    }
    const conDate = await elaboratiDellaBaseline(baselineId, trx)
    const incompleti = elaborati.filter(
      (e) => (conDate.get(Number(e.id))?.date.length ?? 0) < statiPianificabili.length
    )
    if (incompleti.length > 0) {
      const elenco = incompleti.slice(0, 5).map((e) => e.codice).join(', ')
      throw new ErroreBaseline(
        `Mancano date previste per ${incompleti.length} elaborati (${elenco}${incompleti.length > 5 ? '…' : ''}). Aggiungili prima di approvare.`
      )
    }
    for (const e of conDate.values()) {
      const errore = controllaSequenzaDate(e.date)
      if (errore) throw new ErroreBaseline(errore)
    }

    // Congela i budget attuali nelle righe della baseline
    await trx.rawQuery(
      `UPDATE baseline_date_stato d
          SET budget_minuti = e.budget_minuti, version = d.version + 1, updated_at = now()
         FROM elaborati e
        WHERE e.id = d.elaborato_id AND d.baseline_id = ?`,
      [baselineId]
    )
    const budgetPerElaborato = new Map(elaborati.map((e) => [Number(e.id), Number(e.budget_minuti)]))
    const congelati: ElaboratoBaseline[] = [...conDate.values()].map((e) => ({
      ...e,
      budgetMinuti: budgetPerElaborato.get(e.elaboratoId) ?? e.budgetMinuti,
    }))
    const bac = congelati.reduce((a, e) => a + e.budgetMinuti, 0)
    const pesi = Object.fromEntries(stati.map((s) => [s.codice, s.pesoAttuale]))
    const pesoPerOrdine = new Map(stati.map((s) => [s.ordine, s.pesoAttuale]))

    // PV cumulato a fine settimana, dalla settimana di inizio commessa
    let primaData: DataIso | null = commessa.dataInizio
    for (const e of congelati) {
      for (const d of e.date) if (primaData === null || d.data < primaData) primaData = d.data
    }
    const serie = pvSettimanali(congelati, pesoPerOrdine, lunediDellaSettimana(primaData!))
    await trx.from('baseline_pv_settimana').where('baseline_id', baselineId).delete()
    if (serie.length > 0) {
      await trx.table('baseline_pv_settimana').multiInsert(
        serie.map((p) => ({ baseline_id: baselineId, settimana: p.settimana, pv_minuti: p.pvMinuti }))
      )
    }

    // La baseline attiva precedente diventa superata (prima, per l'indice unico)
    const precedente = await baselineAttiva(commessa.id, trx)
    if (precedente) {
      await aggiornaConVersione(
        Baseline,
        precedente.id,
        precedente.version,
        { stato: 'superata' },
        {
          client: trx,
          audit: { utenteId, azione: 'evm.baseline_superata', commessaId: commessa.id },
        }
      )
    }

    return aggiornaConVersione(
      Baseline,
      baselineId,
      versioneAttesa,
      (b) => {
        b.stato = 'approvata'
        b.pesiStati = pesi
        b.bacMinuti = bac
        b.approvataDaId = utenteId
        b.approvataIl = DateTime.now()
      },
      {
        client: trx,
        audit: { utenteId, azione: 'evm.baseline_approvata', commessaId: commessa.id },
      }
    )
  })
  pubblica(commessa.id, 'baseline.aggiornata', { baselineId })
  return approvata
}

/** Scarta (elimina) una bozza mai approvata */
export async function scartaBozza(
  commessaId: number,
  baselineId: number,
  versioneAttesa: number,
  utenteId: number
) {
  await db.transaction(async (trx) => {
    await bozzaModificabile(commessaId, baselineId, trx)
    const riga = await Baseline.query({ client: trx })
      .where('id', baselineId)
      .where('version', versioneAttesa)
      .first()
    if (!riga) {
      const attuale = await Baseline.query({ client: trx }).where('id', baselineId).first()
      throw new ConflittoVersione(attuale, versioneAttesa)
    }
    const prima = istantaneaPerAudit(riga)
    await riga.useTransaction(trx).delete()
    await registraAudit(
      {
        utenteId,
        azione: 'evm.bozza_scartata',
        entita: 'baseline',
        entitaId: baselineId,
        commessaId,
        prima,
      },
      trx
    )
  })
  pubblica(commessaId, 'baseline.aggiornata', { baselineId })
}
