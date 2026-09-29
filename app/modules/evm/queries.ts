/**
 * Query di lettura dell'EVM. Proprietario: agente A5.
 * Formule in #domain/evm. La curva S storica si legge da snapshot_evm e non
 * si ricalcola; solo la settimana corrente è calcolata al momento.
 *
 * Letture di dati di altri moduli: AC per elaborato da `minutiPerElaborato`
 * (modulo ore), stato a fine settimana da `statiAllIstante` (modulo flusso);
 * `elaborati` e `stati_elaborato` (tabelle condivise) si leggono direttamente.
 */
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { calcolaCpi, calcolaEv, calcolaSpi, calcolaIndicatori, calcolaPv } from '#domain/evm'
import type {
  DataIso,
  ElaboratoEvm,
  IndicatoriEvm,
  Lunedi,
  Minuti,
  PuntoCurvaS,
  StatoBaseline,
} from '#domain/types'
import { FUSO, aggiungiSettimane, lunediDellaSettimana, oggiRoma } from '#shared/calendario'
import { statiAllIstante } from '#modules/flusso/queries'
import { minutiPerElaborato } from '#modules/ore/queries'
import {
  ordinePianificatoAlla,
  pvDellaSettimana,
  type DataPrevista,
  type ElaboratoBaseline,
} from './calcoli.js'

type Client = TransactionClientContract | typeof db

// ---------------------------------------------------------------------------
// Tipi esposti
// ---------------------------------------------------------------------------

export interface RigaEvmElaborato {
  elaboratoId: number
  codice: string
  titolo: string
  statoNome: string
  statoOrdine: number
  /** Peso dello stato attuale preso dalla baseline congelata */
  pesoStatoPercento: number
  /** Stato che secondo la baseline doveva essere raggiunto alla data (null: nessuno) */
  statoPianificatoNome: string | null
  /** Budget congelato nella baseline (0 se l'elaborato è fuori baseline) */
  budgetMinuti: Minuti
  /** Budget attuale dell'elaborato */
  budgetAttualeMinuti: Minuti
  pvMinuti: Minuti
  evMinuti: Minuti
  acMinuti: Minuti
  spi: number | null
  cpi: number | null
  /** L'elaborato non compare nella baseline attiva */
  fuoriBaseline: boolean
}

export interface RiepilogoEvm extends IndicatoriEvm {
  commessaId: number
  baselineId: number | null
  baselineNumero: number | null
  dataStato: DataIso
  settimana: Lunedi
  perElaborato: RigaEvmElaborato[]
  /** Elaborati della commessa assenti dalla baseline attiva */
  fuoriBaseline: { elaboratoId: number; codice: string; titolo: string }[]
  /** Elaborati il cui budget è cambiato dopo l'approvazione */
  budgetCambiati: { elaboratoId: number; codice: string; prima: Minuti; ora: Minuti }[]
}

export interface PuntoCurvaSEvm extends PuntoCurvaS {
  /** Ore della settimana rettificate dopo lo snapshot */
  rettificato: boolean
  acRettificatoMinuti: Minuti | null
}

export interface RigaBaseline {
  id: number
  commessaId: number
  numero: number
  stato: StatoBaseline
  pesiStati: Record<string, number>
  bacMinuti: Minuti
  approvataIl: DateTime | null
  approvataDa: string | null
  note: string | null
  version: number
}

export interface StatoConPeso {
  id: number
  codice: string
  nome: string
  ordine: number
  pesoAttuale: number
}

// ---------------------------------------------------------------------------
// Letture di base
// ---------------------------------------------------------------------------

function aNumero(x: unknown): number | null {
  if (x === null || x === undefined) return null
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

function aDataTime(x: unknown): DateTime | null {
  if (!x) return null
  if (x instanceof Date) return DateTime.fromJSDate(x)
  const dt = DateTime.fromISO(String(x))
  return dt.isValid ? dt : null
}

function rigaBaseline(r: Record<string, unknown>): RigaBaseline {
  const pesi = typeof r.pesi_stati === 'string' ? JSON.parse(r.pesi_stati) : r.pesi_stati
  return {
    id: Number(r.id),
    commessaId: Number(r.commessa_id),
    numero: Number(r.numero),
    stato: r.stato as StatoBaseline,
    pesiStati: (pesi ?? {}) as Record<string, number>,
    bacMinuti: Number(r.bac_minuti),
    approvataIl: aDataTime(r.approvata_il),
    approvataDa: (r.approvata_da as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    version: Number(r.version),
  }
}

const COLONNE_BASELINE = [
  'b.id',
  'b.commessa_id',
  'b.numero',
  'b.stato',
  'b.pesi_stati',
  'b.bac_minuti',
  'b.approvata_il',
  'b.note',
  'b.version',
  'u.nome as approvata_da',
]

/** Baseline approvata (attiva) della commessa, null se non c'è */
export async function baselineAttiva(
  commessaId: number,
  client: Client = db
): Promise<RigaBaseline | null> {
  const r = await client
    .from('baseline as b')
    .leftJoin('utenti as u', 'u.id', 'b.approvata_da_id')
    .where('b.commessa_id', commessaId)
    .where('b.stato', 'approvata')
    .select(COLONNE_BASELINE)
    .first()
  return r ? rigaBaseline(r) : null
}

/** Baseline in bozza della commessa, null se non c'è */
export async function baselineInBozza(
  commessaId: number,
  client: Client = db
): Promise<RigaBaseline | null> {
  const r = await client
    .from('baseline as b')
    .leftJoin('utenti as u', 'u.id', 'b.approvata_da_id')
    .where('b.commessa_id', commessaId)
    .where('b.stato', 'bozza')
    .orderBy('b.numero', 'desc')
    .select(COLONNE_BASELINE)
    .first()
  return r ? rigaBaseline(r) : null
}

/** Tutte le baseline della commessa, dalla più recente */
export async function elencoBaseline(commessaId: number): Promise<RigaBaseline[]> {
  const righe = await db
    .from('baseline as b')
    .leftJoin('utenti as u', 'u.id', 'b.approvata_da_id')
    .where('b.commessa_id', commessaId)
    .orderBy('b.numero', 'desc')
    .select(COLONNE_BASELINE)
  return righe.map(rigaBaseline)
}

/** Stati dell'elaborato in ordine, con il peso della configurazione attuale */
export async function statiElaborato(client: Client = db): Promise<StatoConPeso[]> {
  const righe = await client
    .from('stati_elaborato')
    .orderBy('ordine', 'asc')
    .select('id', 'codice', 'nome', 'ordine', 'peso_ev_percento')
  return righe.map((r) => ({
    id: Number(r.id),
    codice: String(r.codice),
    nome: String(r.nome),
    ordine: Number(r.ordine),
    pesoAttuale: Number(r.peso_ev_percento),
  }))
}

/**
 * Peso di ogni stato secondo la baseline (congelato all'approvazione).
 * Uno stato aggiunto dopo l'approvazione usa il peso attuale.
 */
export function pesiCongelati(
  stati: readonly StatoConPeso[],
  baseline: RigaBaseline | null
): { perStatoId: Map<number, number>; perOrdine: Map<number, number> } {
  const perStatoId = new Map<number, number>()
  const perOrdine = new Map<number, number>()
  for (const s of stati) {
    const congelato = baseline ? aNumero(baseline.pesiStati[s.codice]) : null
    const peso = congelato ?? s.pesoAttuale
    perStatoId.set(s.id, peso)
    perOrdine.set(s.ordine, peso)
  }
  return { perStatoId, perOrdine }
}

/** Date previste e budget congelato per ogni elaborato della baseline */
export async function elaboratiDellaBaseline(
  baselineId: number,
  client: Client = db
): Promise<Map<number, ElaboratoBaseline>> {
  const righe = await client
    .from('baseline_date_stato as d')
    .join('stati_elaborato as s', 's.id', 'd.stato_id')
    .where('d.baseline_id', baselineId)
    .select('d.elaborato_id', 'd.budget_minuti', 'd.data_prevista', 's.ordine')
  const mappa = new Map<number, ElaboratoBaseline>()
  for (const r of righe) {
    const id = Number(r.elaborato_id)
    let e = mappa.get(id)
    if (!e) {
      e = { elaboratoId: id, budgetMinuti: Number(r.budget_minuti), date: [] }
      mappa.set(id, e)
    }
    e.date.push({ ordine: Number(r.ordine), data: String(r.data_prevista) as DataIso })
  }
  return mappa
}

/** PV cumulato congelato per settimana, in ordine di settimana */
export async function pvCongelato(
  baselineId: number,
  client: Client = db
): Promise<{ settimana: Lunedi; pvMinuti: Minuti }[]> {
  const righe = await client
    .from('baseline_pv_settimana')
    .where('baseline_id', baselineId)
    .orderBy('settimana', 'asc')
    .select('settimana', 'pv_minuti')
  return righe.map((r) => ({ settimana: String(r.settimana), pvMinuti: Number(r.pv_minuti) }))
}

// ---------------------------------------------------------------------------
// Calcolo EVM a una data
// ---------------------------------------------------------------------------

/** Contesto della baseline attiva, caricato una volta per commessa */
export interface ContestoEvm {
  commessaId: number
  baseline: RigaBaseline | null
  stati: StatoConPeso[]
  pesi: { perStatoId: Map<number, number>; perOrdine: Map<number, number> }
  elaboratiBaseline: Map<number, ElaboratoBaseline>
  serieP: { settimana: Lunedi; pvMinuti: Minuti }[]
}

export async function caricaContesto(
  commessaId: number,
  client: Client = db
): Promise<ContestoEvm> {
  // In sequenza: con una transazione la connessione è una sola
  const baseline = await baselineAttiva(commessaId, client)
  const stati = await statiElaborato(client)
  const elaboratiBaseline = baseline
    ? await elaboratiDellaBaseline(baseline.id, client)
    : new Map<number, ElaboratoBaseline>()
  const serieP = baseline ? await pvCongelato(baseline.id, client) : []
  return {
    commessaId,
    baseline,
    stati,
    pesi: pesiCongelati(stati, baseline),
    elaboratiBaseline,
    serieP,
  }
}

/** Riga di un elaborato letta dal DB per il calcolo */
export interface RigaElaboratoDb {
  elaboratoId: number
  codice: string
  titolo: string
  budgetAttualeMinuti: Minuti
  /** Stato (attuale o ricostruito a fine settimana); null = nessuno stato a quella data */
  statoId: number | null
  acMinuti: Minuti
}

/**
 * Elaborati della commessa con l'AC fino a `dataAc` (inclusa).
 * Con `statoAlIstante` lo stato è quello in vigore a quell'istante
 * (ricostruito da `transizioni_elaborato`), altrimenti è lo stato attuale.
 */
export async function righeElaborati(
  commessaId: number,
  dataAc: DataIso,
  statoAlIstante: string | null,
  client: Client = db
): Promise<RigaElaboratoDb[]> {
  // Stato storico dal modulo flusso, AC dal modulo ore. In sequenza: il client
  // può essere una transazione (una sola connessione).
  const elaborati = await client
    .from('elaborati')
    .where('commessa_id', commessaId)
    .orderBy('codice', 'asc')
    .select('id', 'codice', 'titolo', 'budget_minuti', 'stato_id')
  const statiStorici = statoAlIstante
    ? await statiAllIstante(commessaId, statoAlIstante, client)
    : null
  const ac = await minutiPerElaborato(commessaId, { finoAl: dataAc, client })
  return elaborati.map((r) => {
    const id = Number(r.id)
    const statoId = statiStorici ? (statiStorici.get(id) ?? null) : Number(r.stato_id)
    return {
      elaboratoId: id,
      codice: String(r.codice),
      titolo: String(r.titolo),
      budgetAttualeMinuti: Number(r.budget_minuti),
      statoId,
      acMinuti: ac.get(id) ?? 0,
    }
  })
}

/** Risultato del calcolo EVM di una commessa a una data */
export interface CalcoloEvm {
  indicatori: IndicatoriEvm
  perElaborato: (RigaEvmElaborato & { statoId: number })[]
}

/**
 * Compone BAC, PV, EV, AC e indicatori dagli elaborati.
 *
 * - budget e pesi dalla baseline attiva (congelati); elaborati fuori baseline
 *   con budget 0 (entrano solo in AC);
 * - PV totale dal PV congelato della settimana (`baseline_pv_settimana`),
 *   PV per elaborato dalle date previste a `dataPv`;
 * - senza baseline: budget e pesi attuali, PV = 0 (SPI n.d.).
 */
export function componiEvm(
  contesto: ContestoEvm,
  righe: readonly RigaElaboratoDb[],
  dataPv: DataIso
): CalcoloEvm {
  const { baseline, stati, pesi, elaboratiBaseline } = contesto
  const statoPerId = new Map(stati.map((s) => [s.id, s]))
  const statoPerOrdine = new Map(stati.map((s) => [s.ordine, s]))
  const statoIniziale = stati[0]

  const perElaborato = righe.map((r) => {
    const stato = (r.statoId !== null ? statoPerId.get(r.statoId) : undefined) ?? statoIniziale
    const inBaseline = baseline ? elaboratiBaseline.get(r.elaboratoId) : undefined
    const budget = baseline ? (inBaseline?.budgetMinuti ?? 0) : r.budgetAttualeMinuti
    const pesoStato = r.statoId === null ? 0 : (pesi.perStatoId.get(stato.id) ?? 0)
    const ordinePianificato = inBaseline ? ordinePianificatoAlla(inBaseline.date, dataPv) : 0
    const pesoPianificato = inBaseline ? (pesi.perOrdine.get(ordinePianificato) ?? 0) : 0
    const riga: ElaboratoEvm = {
      elaboratoId: r.elaboratoId,
      budgetMinuti: budget,
      pesoStatoPercento: pesoStato,
      pesoPianificatoPercento: pesoPianificato,
      acMinuti: r.acMinuti,
    }
    const ev = calcolaEv([riga])
    const pv = calcolaPv([riga])
    return {
      riga,
      dettaglio: {
        elaboratoId: r.elaboratoId,
        codice: r.codice,
        titolo: r.titolo,
        statoId: stato.id,
        statoNome: r.statoId === null ? 'Non ancora creato' : stato.nome,
        statoOrdine: r.statoId === null ? -1 : stato.ordine,
        pesoStatoPercento: pesoStato,
        statoPianificatoNome:
          inBaseline && ordinePianificato > 0
            ? (statoPerOrdine.get(ordinePianificato)?.nome ?? null)
            : null,
        budgetMinuti: budget,
        budgetAttualeMinuti: r.budgetAttualeMinuti,
        pvMinuti: pv,
        evMinuti: ev,
        acMinuti: r.acMinuti,
        spi: calcolaSpi(ev, pv),
        cpi: calcolaCpi(ev, r.acMinuti),
        fuoriBaseline: baseline !== null && !inBaseline,
      },
    }
  })

  const righeEvm = perElaborato.map((p) => p.riga)
  let bac = 0
  let ac = 0
  for (const r of righeEvm) {
    bac += r.budgetMinuti
    ac += r.acMinuti
  }
  const ev = calcolaEv(righeEvm)
  const pv = baseline ? pvDellaSettimana(contesto.serieP, lunediDellaSettimana(dataPv)) : 0
  const bacTotale = baseline ? baseline.bacMinuti : bac

  return {
    indicatori: calcolaIndicatori({
      bacMinuti: bacTotale,
      pvMinuti: pv,
      evMinuti: ev,
      acMinuti: ac,
    }),
    perElaborato: perElaborato.map((p) => p.dettaglio),
  }
}

// ---------------------------------------------------------------------------
// Contratti: riepilogoEvm e serieCurvaS
// ---------------------------------------------------------------------------

/** Indicatori EVM della commessa alla data di stato (default: oggi a Roma) */
export async function riepilogoEvm(
  commessaId: number,
  dataStato: DataIso = oggiRoma()
): Promise<RiepilogoEvm> {
  const contesto = await caricaContesto(commessaId)
  const righe = await righeElaborati(commessaId, dataStato, null)
  const settimana = lunediDellaSettimana(dataStato)
  // PV della settimana: cumulato a fine settimana, come in baseline_pv_settimana
  const domenica = DateTime.fromISO(settimana, { zone: FUSO }).plus({ days: 6 }).toISODate()!
  const calcolo = componiEvm(contesto, righe, domenica)

  const fuoriBaseline = calcolo.perElaborato
    .filter((e) => e.fuoriBaseline)
    .map((e) => ({ elaboratoId: e.elaboratoId, codice: e.codice, titolo: e.titolo }))
  const budgetCambiati = calcolo.perElaborato
    .filter(
      (e) => !e.fuoriBaseline && contesto.baseline && e.budgetMinuti !== e.budgetAttualeMinuti
    )
    .map((e) => ({
      elaboratoId: e.elaboratoId,
      codice: e.codice,
      prima: e.budgetMinuti,
      ora: e.budgetAttualeMinuti,
    }))

  return {
    ...calcolo.indicatori,
    commessaId,
    baselineId: contesto.baseline?.id ?? null,
    baselineNumero: contesto.baseline?.numero ?? null,
    dataStato,
    settimana,
    perElaborato: calcolo.perElaborato.map(({ statoId: _statoId, ...resto }) => resto),
    fuoriBaseline,
    budgetCambiati,
  }
}

/** Righe di snapshot_evm della commessa, in ordine di settimana */
export async function snapshotCommessa(commessaId: number) {
  const righe = await db
    .from('snapshot_evm')
    .where('commessa_id', commessaId)
    .orderBy('settimana', 'asc')
    .select(
      'id',
      'baseline_id',
      'settimana',
      'bac_minuti',
      'pv_minuti',
      'ev_minuti',
      'ac_minuti',
      'spi',
      'cpi',
      'eac_minuti',
      'etc_minuti',
      'vac_minuti',
      'creato_il',
      'rettificato',
      'ac_rettificato_minuti',
      'rettificato_il'
    )
  return righe.map((r) => ({
    id: Number(r.id),
    baselineId: Number(r.baseline_id),
    settimana: String(r.settimana) as Lunedi,
    bacMinuti: Number(r.bac_minuti),
    pvMinuti: Number(r.pv_minuti),
    evMinuti: Number(r.ev_minuti),
    acMinuti: Number(r.ac_minuti),
    spi: aNumero(r.spi),
    cpi: aNumero(r.cpi),
    eacMinuti: aNumero(r.eac_minuti),
    etcMinuti: aNumero(r.etc_minuti),
    vacMinuti: aNumero(r.vac_minuti),
    creatoIl: aDataTime(r.creato_il),
    rettificato: Boolean(r.rettificato),
    acRettificatoMinuti: aNumero(r.ac_rettificato_minuti),
    rettificatoIl: aDataTime(r.rettificato_il),
  }))
}

export type SnapshotCommessa = Awaited<ReturnType<typeof snapshotCommessa>>[number]

/**
 * Serie della curva S: PV dalla baseline (tutte le settimane), EV e AC dagli
 * snapshot per le settimane passate e dal calcolo live per quella corrente.
 * Le settimane passate senza snapshot hanno EV e AC null: non si ricostruiscono.
 */
export async function serieCurvaS(
  commessaId: number,
  oggi: DataIso = oggiRoma()
): Promise<PuntoCurvaSEvm[]> {
  const settimanaCorrente = lunediDellaSettimana(oggi)
  const [baseline, snapshot] = await Promise.all([
    baselineAttiva(commessaId),
    snapshotCommessa(commessaId),
  ])
  const serieP = baseline ? await pvCongelato(baseline.id) : []

  const settimane = new Set<Lunedi>()
  for (const p of serieP) settimane.add(p.settimana)
  for (const s of snapshot) if (s.settimana < settimanaCorrente) settimane.add(s.settimana)
  settimane.add(settimanaCorrente)

  // Riempie eventuali buchi tra la prima e l'ultima settimana
  const ordinate = [...settimane].sort()
  const tutte: Lunedi[] = []
  for (let w = ordinate[0]; w <= ordinate[ordinate.length - 1]; w = aggiungiSettimane(w, 1)) {
    tutte.push(w)
  }

  const snapPerSettimana = new Map(snapshot.map((s) => [s.settimana, s]))
  const live = await riepilogoEvm(commessaId, oggi)

  return tutte.map((settimana) => {
    const pv = baseline
      ? pvDellaSettimana(serieP, settimana)
      : (snapPerSettimana.get(settimana)?.pvMinuti ?? 0)
    if (settimana === settimanaCorrente) {
      return {
        settimana,
        pvMinuti: baseline ? pv : live.pvMinuti,
        evMinuti: live.evMinuti,
        acMinuti: live.acMinuti,
        daSnapshot: false,
        rettificato: false,
        acRettificatoMinuti: null,
      }
    }
    const s = settimana < settimanaCorrente ? snapPerSettimana.get(settimana) : undefined
    return {
      settimana,
      pvMinuti: pv,
      evMinuti: s ? s.evMinuti : null,
      acMinuti: s ? s.acMinuti : null,
      daSnapshot: s !== undefined,
      rettificato: s?.rettificato ?? false,
      acRettificatoMinuti: s?.acRettificatoMinuti ?? null,
    }
  })
}

// ---------------------------------------------------------------------------
// Editor della baseline
// ---------------------------------------------------------------------------

export interface RigaEditor {
  elaboratoId: number
  codice: string
  titolo: string
  budgetAttualeMinuti: Minuti
  /** Una cella per stato con ordine > 0 */
  date: {
    statoId: number
    ordine: number
    rigaId: number | null
    data: DataIso | null
    version: number | null
  }[]
  /** true se l'elaborato non ha ancora date in questa baseline */
  mancante: boolean
}

/** Righe dell'editor: tutti gli elaborati della commessa con le date della baseline */
export async function righeEditor(commessaId: number, baselineId: number): Promise<RigaEditor[]> {
  const [stati, elaborati, date] = await Promise.all([
    statiElaborato(),
    db
      .from('elaborati')
      .where('commessa_id', commessaId)
      .orderBy('codice', 'asc')
      .select('id', 'codice', 'titolo', 'budget_minuti'),
    db
      .from('baseline_date_stato')
      .where('baseline_id', baselineId)
      .select('id', 'elaborato_id', 'stato_id', 'data_prevista', 'version'),
  ])
  const statiPianificabili = stati.filter((s) => s.ordine > 0)
  const perChiave = new Map<string, Record<string, unknown>>()
  for (const d of date) perChiave.set(`${d.elaborato_id}:${d.stato_id}`, d)

  return elaborati.map((e) => {
    const celle = statiPianificabili.map((s) => {
      const d = perChiave.get(`${e.id}:${s.id}`)
      return {
        statoId: s.id,
        ordine: s.ordine,
        rigaId: d ? Number(d.id) : null,
        data: d ? (String(d.data_prevista) as DataIso) : null,
        version: d ? Number(d.version) : null,
      }
    })
    return {
      elaboratoId: Number(e.id),
      codice: String(e.codice),
      titolo: String(e.titolo),
      budgetAttualeMinuti: Number(e.budget_minuti),
      date: celle,
      mancante: celle.every((c) => c.rigaId === null),
    }
  })
}

/** Date previste di un elaborato nella baseline, per ordine di stato */
export function datePreviste(riga: RigaEditor): DataPrevista[] {
  return riga.date
    .filter((c) => c.data !== null)
    .map((c) => ({ ordine: c.ordine, data: c.data as DataIso }))
}

// ---------------------------------------------------------------------------
// Letture per gli altri moduli
// ---------------------------------------------------------------------------

/**
 * true se l'elaborato fa parte della baseline approvata (quella attiva) della
 * sua commessa. Il modulo anagrafiche la usa per bloccarne l'eliminazione:
 * cambierebbe il BAC congelato.
 */
export async function elaboratoInBaselineApprovata(
  elaboratoId: number,
  client: Client = db
): Promise<boolean> {
  const riga = await client
    .from('baseline_date_stato as d')
    .join('baseline as b', 'b.id', 'd.baseline_id')
    .where('d.elaborato_id', elaboratoId)
    .where('b.stato', 'approvata')
    .select('d.id')
    .first()
  return Boolean(riga)
}
