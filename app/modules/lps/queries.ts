/**
 * Query di lettura del Last Planner. Proprietario: agente A2.
 * Le formule sono in #domain/lps (contratto di Fase 0).
 *
 * Le date dei timestamp (rimosso_il, annullato_il) si portano a data di
 * calendario di Roma direttamente in SQL.
 */
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { calcolaPcr, calcolaPpc, calcolaTmrTa, paretoCause as calcolaPareto } from '#domain/lps'
import type {
  AttivitaSnapshotLps,
  CategoriaVincolo,
  DataIso,
  ImpegnoLps,
  Indice,
  Lunedi,
  RisultatoPcr,
  RisultatoPpc,
  RisultatoTmrTa,
  StatoPiano,
  StatoVincolo,
  TipoAttivitaLookahead,
  VincoloLps,
  VoceParetoCausa,
} from '#domain/types'
import { aggiungiSettimane } from '#shared/calendario'

type Client = TransactionClientContract | typeof db

/** Stati di un vincolo che rendono l'attività "vincolata" */
export const STATI_VINCOLO_APERTI: readonly StatoVincolo[] = ['da_analizzare', 'aperto']

/** Settimane di storico PPC mostrate (oltre alla settimana richiesta) */
export const SETTIMANE_STORICO_PPC = 8

export interface RiepilogoLps {
  commessaId: number
  settimana: Lunedi
  statoPiano: StatoPiano | null
  promessi: number
  fatti: number
  /** Rapporto 0–1, null se nessun impegno promesso */
  ppc: Indice
  vincoliAperti: number
  pcr: Indice
  tmr: Indice
  ta: Indice
  /** Serie storica dagli snapshot_lps (settimane chiuse) più la settimana corrente */
  storicoPpc: { settimana: Lunedi; ppc: Indice; daSnapshot: boolean }[]
}

/** Indicatori completi di una settimana, calcolati ora dai dati (base degli snapshot) */
export interface IndicatoriSettimana {
  pianoId: number | null
  statoPiano: StatoPiano | null
  ppc: RisultatoPpc
  pcr: RisultatoPcr
  tmrTa: RisultatoTmrTa
}

// ---------------------------------------------------------------------------
// Letture per il dominio
// ---------------------------------------------------------------------------

/** Vincoli della commessa nella forma del dominio (date di Roma) */
export async function vincoliPerDominio(
  commessaId: number,
  client: Client = db
): Promise<VincoloLps[]> {
  const righe = await client
    .from('vincoli')
    .where('commessa_id', commessaId)
    .select(
      'id',
      'stato',
      'identificato_il',
      'data_necessaria',
      db.raw(`(rimosso_il AT TIME ZONE 'Europe/Rome')::date AS rimosso_data`),
      db.raw(`(annullato_il AT TIME ZONE 'Europe/Rome')::date AS annullato_data`)
    )
  return righe.map((r) => ({
    vincoloId: r.id,
    stato: r.stato,
    identificatoIl: r.identificato_il,
    dataNecessaria: r.data_necessaria,
    rimossoIl: r.rimosso_data,
    annullatoIl: r.annullato_data,
  }))
}

interface RigaImpegnoDominio extends ImpegnoLps {
  codiceAttivita: string | null
}

async function pianoEImpegni(commessaId: number, settimana: Lunedi, client: Client) {
  const piano = await client
    .from('piani_settimanali')
    .where('commessa_id', commessaId)
    .where('settimana', settimana)
    .select('id', 'stato')
    .first()
  if (!piano) return { piano: null, impegni: [] as RigaImpegnoDominio[] }
  const righe = await client
    .from('impegni as i')
    .leftJoin('attivita_lookahead as a', 'a.id', 'i.attivita_id')
    .where('i.piano_id', piano.id)
    .select('i.id', 'i.fatto', 'i.causa_id', 'i.aggiunto_dopo_promessa', 'a.codice')
  const impegni: RigaImpegnoDominio[] = righe.map((r) => ({
    impegnoId: r.id,
    fatto: r.fatto,
    causaId: r.causa_id,
    aggiuntoDopoPromessa: r.aggiunto_dopo_promessa,
    codiceAttivita: r.codice,
  }))
  return { piano: piano as { id: number; stato: StatoPiano }, impegni }
}

/** Righe di snapshot_lookahead di una settimana; null se lo snapshot non c'è */
export async function snapshotLookahead(
  commessaId: number,
  settimana: Lunedi,
  client: Client = db
): Promise<AttivitaSnapshotLps[] | null> {
  const righe = await client
    .from('snapshot_lookahead')
    .where('commessa_id', commessaId)
    .where('settimana', settimana)
    .select('codice_attivita', 'settimana_inizio', 'settimana_fine', 'pronta')
  if (righe.length === 0) return null
  return righe.map((r) => ({
    codiceAttivita: r.codice_attivita,
    settimanaInizio: r.settimana_inizio,
    settimanaFine: r.settimana_fine,
    pronta: r.pronta,
  }))
}

/** PPC, PCR e TMR/TA della settimana calcolati adesso dai dati */
export async function indicatoriSettimana(
  commessaId: number,
  settimana: Lunedi,
  client: Client = db
): Promise<IndicatoriSettimana> {
  const [{ piano, impegni }, vincoli, snapshotW2] = await Promise.all([
    pianoEImpegni(commessaId, settimana, client),
    vincoliPerDominio(commessaId, client),
    snapshotLookahead(commessaId, aggiungiSettimane(settimana, -2), client),
  ])
  const promessi = impegni.filter((i) => !i.aggiuntoDopoPromessa)
  const codici = promessi.flatMap((i) => (i.codiceAttivita ? [i.codiceAttivita] : []))
  return {
    pianoId: piano?.id ?? null,
    statoPiano: piano?.stato ?? null,
    ppc: calcolaPpc(impegni),
    pcr: calcolaPcr(vincoli, settimana),
    tmrTa: calcolaTmrTa(settimana, snapshotW2, codici, promessi.length),
  }
}

/** Numero di vincoli oggi da analizzare o aperti */
export async function contaVincoliAperti(commessaId: number): Promise<number> {
  const r = await db
    .from('vincoli')
    .where('commessa_id', commessaId)
    .whereIn('stato', STATI_VINCOLO_APERTI as StatoVincolo[])
    .count('* as n')
    .first()
  return Number(r?.n ?? 0)
}

/** Riepilogo LPS della commessa per la settimana indicata (lunedì) */
export async function riepilogoLps(commessaId: number, settimana: Lunedi): Promise<RiepilogoLps> {
  const [ind, vincoliAperti, snapshot] = await Promise.all([
    indicatoriSettimana(commessaId, settimana),
    contaVincoliAperti(commessaId),
    db
      .from('snapshot_lps')
      .where('commessa_id', commessaId)
      .where('settimana', '<=', settimana)
      .orderBy('settimana', 'desc')
      .limit(SETTIMANE_STORICO_PPC + 1)
      .select('settimana', 'ppc'),
  ])

  const storico = snapshot
    .filter((s) => s.settimana < settimana)
    .slice(0, SETTIMANE_STORICO_PPC)
    .reverse()
    .map((s) => ({ settimana: s.settimana as Lunedi, ppc: s.ppc as Indice, daSnapshot: true }))
  const snapshotCorrente = snapshot.find((s) => s.settimana === settimana)
  storico.push(
    snapshotCorrente
      ? { settimana, ppc: snapshotCorrente.ppc as Indice, daSnapshot: true }
      : { settimana, ppc: ind.ppc.ppc, daSnapshot: false }
  )

  return {
    commessaId,
    settimana,
    statoPiano: ind.statoPiano,
    promessi: ind.ppc.promessi,
    fatti: ind.ppc.fatti,
    ppc: ind.ppc.ppc,
    vincoliAperti,
    pcr: ind.pcr.pcr,
    tmr: ind.tmrTa.tmr,
    ta: ind.tmrTa.ta,
    storicoPpc: storico,
  }
}

/** Cause di non completamento (tutte, anche quelle disattivate, per lo storico) */
export async function causeNonCompletamento(soloAttive = false) {
  const q = db
    .from('cause_non_completamento')
    .select('id', 'codice', 'nome', 'ordine', 'attiva')
    .orderBy('ordine', 'asc')
  if (soloAttive) q.where('attiva', true)
  return (await q) as {
    id: number
    codice: string
    nome: string
    ordine: number
    attiva: boolean
  }[]
}

/**
 * Pareto delle cause di non completamento nelle settimane da `daSettimana`
 * ad `aSettimana` incluse (impegni con fatto = false).
 */
export async function paretoCause(
  commessaId: number,
  daSettimana: Lunedi,
  aSettimana: Lunedi
): Promise<VoceParetoCausa[]> {
  const [righe, cause] = await Promise.all([
    db
      .from('impegni as i')
      .join('piani_settimanali as p', 'p.id', 'i.piano_id')
      .where('p.commessa_id', commessaId)
      .whereBetween('p.settimana', [daSettimana, aSettimana])
      .where('i.fatto', false)
      .select('i.id', 'i.fatto', 'i.causa_id', 'i.aggiunto_dopo_promessa'),
    causeNonCompletamento(),
  ])
  const impegni: ImpegnoLps[] = righe.map((r) => ({
    impegnoId: r.id,
    fatto: r.fatto,
    causaId: r.causa_id,
    aggiuntoDopoPromessa: r.aggiunto_dopo_promessa,
  }))
  return calcolaPareto(impegni, cause)
}

// ---------------------------------------------------------------------------
// Letture per le viste
// ---------------------------------------------------------------------------

export interface VincoloCollegato {
  id: number
  codice: string
  stato: StatoVincolo
}

export interface RigaLookahead {
  id: number
  codice: string
  titolo: string
  tipo: TipoAttivitaLookahead
  elaboratoId: number | null
  elaboratoCodice: string | null
  disciplinaId: number | null
  /** Disciplina propria dell'attività oppure, se vuota, quella dell'elaborato */
  disciplinaCodice: string | null
  disciplinaPropria: boolean
  responsabileId: number | null
  responsabileNome: string | null
  settimanaInizio: Lunedi
  settimanaFine: Lunedi
  version: number
  vincoli: VincoloCollegato[]
  vincoliAperti: number
  /** Calcolato: nessun vincolo collegato da analizzare o aperto */
  pronta: boolean
}

const SQL_VINCOLI_ATTIVITA = `LEFT JOIN LATERAL (
  SELECT coalesce(json_agg(json_build_object('id', v.id, 'codice', v.codice, 'stato', v.stato)
           ORDER BY v.codice), '[]'::json) AS vincoli,
         count(*) FILTER (WHERE v.stato IN ('da_analizzare', 'aperto')) AS aperti
  FROM vincoli_attivita va JOIN vincoli v ON v.id = va.vincolo_id
  WHERE va.attivita_id = a.id
) AS vc ON TRUE`

function mappaAttivita(r: Record<string, any>): RigaLookahead {
  const aperti = Number(r.aperti ?? 0)
  return {
    id: r.id,
    codice: r.codice,
    titolo: r.titolo,
    tipo: r.tipo,
    elaboratoId: r.elaborato_id,
    elaboratoCodice: r.elaborato_codice,
    disciplinaId: r.disciplina_id,
    disciplinaCodice: r.disciplina_codice,
    disciplinaPropria: r.disciplina_id !== null,
    responsabileId: r.responsabile_id,
    responsabileNome: r.responsabile_nome,
    settimanaInizio: r.settimana_inizio,
    settimanaFine: r.settimana_fine,
    version: r.version,
    vincoli: r.vincoli ?? [],
    vincoliAperti: aperti,
    pronta: aperti === 0,
  }
}

function queryAttivita(commessaId: number, client: Client = db) {
  return client
    .from('attivita_lookahead as a')
    .leftJoin('elaborati as e', 'e.id', 'a.elaborato_id')
    .joinRaw('LEFT JOIN discipline AS d ON d.id = coalesce(a.disciplina_id, e.disciplina_id)')
    .leftJoin('utenti as u', 'u.id', 'a.responsabile_id')
    .joinRaw(SQL_VINCOLI_ATTIVITA)
    .where('a.commessa_id', commessaId)
    .select(
      'a.id',
      'a.codice',
      'a.titolo',
      'a.tipo',
      'a.elaborato_id',
      'e.codice as elaborato_codice',
      'a.disciplina_id',
      'd.codice as disciplina_codice',
      'a.responsabile_id',
      'u.nome as responsabile_nome',
      'a.settimana_inizio',
      'a.settimana_fine',
      'a.version',
      'vc.vincoli',
      'vc.aperti'
    )
}

/** Attività del lookahead che toccano le settimane [da, a] (una query) */
export async function attivitaLookahead(
  commessaId: number,
  da: Lunedi,
  a: Lunedi,
  client: Client = db
): Promise<RigaLookahead[]> {
  const righe = await queryAttivita(commessaId, client)
    .where('a.settimana_fine', '>=', da)
    .where('a.settimana_inizio', '<=', a)
    .orderBy('a.settimana_inizio', 'asc')
    .orderByRaw("CASE a.tipo WHEN 'milestone' THEN 1 ELSE 0 END")
    .orderBy('a.codice', 'asc')
  return righe.map(mappaAttivita)
}

/** Tutte le attività della commessa (per i collegamenti dei vincoli) */
export async function tutteLeAttivita(commessaId: number): Promise<RigaLookahead[]> {
  const righe = await queryAttivita(commessaId)
    .orderBy('a.settimana_inizio', 'asc')
    .orderBy('a.codice', 'asc')
  return righe.map(mappaAttivita)
}

/** Una attività della commessa, null se non esiste */
export async function attivitaDellaCommessa(
  commessaId: number,
  attivitaId: number
): Promise<RigaLookahead | null> {
  const r = await queryAttivita(commessaId).where('a.id', attivitaId).first()
  return r ? mappaAttivita(r) : null
}

export interface RigaVincolo {
  id: number
  codice: string
  descrizione: string
  categoria: CategoriaVincolo
  stato: StatoVincolo
  responsabileId: number | null
  responsabileNome: string | null
  responsabileEsterno: string | null
  dataNecessaria: DataIso | null
  identificatoIl: DataIso
  rimossoIl: DataIso | null
  annullatoIl: DataIso | null
  note: string | null
  version: number
  attivita: { id: number; codice: string }[]
  aperto: boolean
}

/** Registro vincoli della commessa: prima quelli aperti, per data necessaria */
export async function registroVincoli(
  commessaId: number,
  filtro: 'aperti' | 'tutti' = 'tutti',
  vincoloId?: number
): Promise<RigaVincolo[]> {
  const q = db
    .from('vincoli as v')
    .leftJoin('utenti as u', 'u.id', 'v.responsabile_id')
    .joinRaw(
      `LEFT JOIN LATERAL (
         SELECT coalesce(json_agg(json_build_object('id', a.id, 'codice', a.codice)
                  ORDER BY a.codice), '[]'::json) AS attivita
         FROM vincoli_attivita va JOIN attivita_lookahead a ON a.id = va.attivita_id
         WHERE va.vincolo_id = v.id
       ) AS va ON TRUE`
    )
    .where('v.commessa_id', commessaId)
    .select(
      'v.id',
      'v.codice',
      'v.descrizione',
      'v.categoria',
      'v.stato',
      'v.responsabile_id',
      'u.nome as responsabile_nome',
      'v.responsabile_esterno',
      'v.data_necessaria',
      'v.identificato_il',
      db.raw(`(v.rimosso_il AT TIME ZONE 'Europe/Rome')::date AS rimosso_data`),
      db.raw(`(v.annullato_il AT TIME ZONE 'Europe/Rome')::date AS annullato_data`),
      'v.note',
      'v.version',
      'va.attivita'
    )
    .orderByRaw(
      "CASE v.stato WHEN 'aperto' THEN 0 WHEN 'da_analizzare' THEN 1 WHEN 'rimosso' THEN 2 ELSE 3 END"
    )
    .orderByRaw('v.data_necessaria ASC NULLS LAST')
    .orderBy('v.codice', 'asc')
  if (filtro === 'aperti') q.whereIn('v.stato', STATI_VINCOLO_APERTI as StatoVincolo[])
  if (vincoloId !== undefined) q.where('v.id', vincoloId)
  const righe = await q
  return righe.map((r) => ({
    id: r.id,
    codice: r.codice,
    descrizione: r.descrizione,
    categoria: r.categoria,
    stato: r.stato,
    responsabileId: r.responsabile_id,
    responsabileNome: r.responsabile_nome,
    responsabileEsterno: r.responsabile_esterno,
    dataNecessaria: r.data_necessaria,
    identificatoIl: r.identificato_il,
    rimossoIl: r.rimosso_data,
    annullatoIl: r.annullato_data,
    note: r.note,
    version: r.version,
    attivita: r.attivita ?? [],
    aperto: STATI_VINCOLO_APERTI.includes(r.stato),
  }))
}

export interface RigaImpegno {
  id: number
  pianoId: number
  descrizione: string
  attivitaId: number | null
  attivitaCodice: string | null
  /** Attività con vincoli aperti in questo momento */
  vincolata: boolean
  vincoliAperti: string[]
  elaboratoId: number | null
  elaboratoCodice: string | null
  lastPlannerId: number | null
  lastPlannerNome: string | null
  fatto: boolean | null
  causaId: number | null
  causaNome: string | null
  cinquePerche: string[]
  aggiuntoDopoPromessa: boolean
  ordine: number
  version: number
}

export interface PianoSettimana {
  id: number
  settimana: Lunedi
  stato: StatoPiano
  promessoIl: string | null
  chiusoIl: string | null
  version: number
  impegni: RigaImpegno[]
}

const SELECT_IMPEGNO = [
  'i.id',
  'i.piano_id',
  'i.descrizione',
  'i.attivita_id',
  'a.codice as attivita_codice',
  'i.elaborato_id',
  'e.codice as elaborato_codice',
  'i.last_planner_id',
  'u.nome as last_planner_nome',
  'i.fatto',
  'i.causa_id',
  'c.nome as causa_nome',
  'i.cinque_perche',
  'i.aggiunto_dopo_promessa',
  'i.ordine',
  'i.version',
  'vc.aperti_codici',
]

function queryImpegni(client: Client = db) {
  return client
    .from('impegni as i')
    .leftJoin('attivita_lookahead as a', 'a.id', 'i.attivita_id')
    .leftJoin('elaborati as e', 'e.id', 'i.elaborato_id')
    .leftJoin('utenti as u', 'u.id', 'i.last_planner_id')
    .leftJoin('cause_non_completamento as c', 'c.id', 'i.causa_id')
    .joinRaw(
      `LEFT JOIN LATERAL (
         SELECT coalesce(array_agg(v.codice ORDER BY v.codice), '{}') AS aperti_codici
         FROM vincoli_attivita va JOIN vincoli v ON v.id = va.vincolo_id
         WHERE va.attivita_id = i.attivita_id AND v.stato IN ('da_analizzare', 'aperto')
       ) AS vc ON TRUE`
    )
    .select(SELECT_IMPEGNO)
}

function mappaImpegno(r: Record<string, any>): RigaImpegno {
  const aperti: string[] = r.aperti_codici ?? []
  return {
    id: r.id,
    pianoId: r.piano_id,
    descrizione: r.descrizione,
    attivitaId: r.attivita_id,
    attivitaCodice: r.attivita_codice,
    vincolata: aperti.length > 0,
    vincoliAperti: aperti,
    elaboratoId: r.elaborato_id,
    elaboratoCodice: r.elaborato_codice,
    lastPlannerId: r.last_planner_id,
    lastPlannerNome: r.last_planner_nome,
    fatto: r.fatto,
    causaId: r.causa_id,
    causaNome: r.causa_nome,
    cinquePerche: Array.isArray(r.cinque_perche) ? r.cinque_perche : [],
    aggiuntoDopoPromessa: r.aggiunto_dopo_promessa,
    ordine: r.ordine,
    version: r.version,
  }
}

/** Piano della settimana con gli impegni (due query), null se non esiste */
export async function pianoSettimana(
  commessaId: number,
  settimana: Lunedi
): Promise<PianoSettimana | null> {
  const p = await db
    .from('piani_settimanali')
    .where('commessa_id', commessaId)
    .where('settimana', settimana)
    .first()
  if (!p) return null
  const righe = await queryImpegni()
    .where('i.piano_id', p.id)
    .orderBy('i.ordine', 'asc')
    .orderBy('i.id', 'asc')
  return {
    id: p.id,
    settimana: p.settimana,
    stato: p.stato,
    promessoIl: p.promesso_il ? new Date(p.promesso_il).toISOString() : null,
    chiusoIl: p.chiuso_il ? new Date(p.chiuso_il).toISOString() : null,
    version: p.version,
    impegni: righe.map(mappaImpegno),
  }
}

/** Un impegno con i dati per la riga del piano, null se non esiste */
export async function impegnoPerRiga(impegnoId: number): Promise<RigaImpegno | null> {
  const r = await queryImpegni().where('i.id', impegnoId).first()
  return r ? mappaImpegno(r) : null
}

// ---------------------------------------------------------------------------
// Elenchi per i moduli (select)
// ---------------------------------------------------------------------------

export interface OpzionePersona {
  id: number
  nome: string
}

/**
 * Persone che possono essere last planner o responsabili di un vincolo:
 * PM della commessa e membri con ruolo pm, progettista o verificatore.
 * (Lettura locale: sostituibile con anagrafiche.commessaConTeam dopo il merge di A1.)
 */
export async function personeDelTeam(commessaId: number): Promise<OpzionePersona[]> {
  return db
    .from('utenti as u')
    .where('u.attivo', true)
    .where((q) => {
      q.whereIn('u.id', db.from('commesse').where('id', commessaId).select('pm_id')).orWhereIn(
        'u.id',
        db
          .from('membri_commessa')
          .where('commessa_id', commessaId)
          .whereIn('ruolo_commessa', ['pm', 'progettista', 'verificatore'])
          .select('utente_id')
      )
    })
    .orderBy('u.nome', 'asc')
    .select('u.id', 'u.nome')
}

export interface OpzioneElaborato {
  id: number
  codice: string
  titolo: string
  disciplinaId: number
}

export async function elaboratiDellaCommessa(commessaId: number): Promise<OpzioneElaborato[]> {
  const righe = await db
    .from('elaborati')
    .where('commessa_id', commessaId)
    .orderBy('codice', 'asc')
    .select('id', 'codice', 'titolo', 'disciplina_id')
  return righe.map((r) => ({
    id: r.id,
    codice: r.codice,
    titolo: r.titolo,
    disciplinaId: r.disciplina_id,
  }))
}

// ---------------------------------------------------------------------------
// Letture per la scheda elaborato
// ---------------------------------------------------------------------------

export interface ImpegnoElaborato extends RigaImpegno {
  settimana: Lunedi
  statoPiano: StatoPiano
}

export interface CollegamentiElaborato {
  /** Attività del lookahead collegate all'elaborato, con i loro vincoli */
  attivita: RigaLookahead[]
  /** Vincoli delle attività collegate (prima gli aperti) */
  vincoli: RigaVincolo[]
  /** Impegni dei piani settimanali sull'elaborato o sulle sue attività, dal più recente */
  impegni: ImpegnoElaborato[]
}

/** Attività, vincoli e impegni del Last Planner collegati a un elaborato */
export async function collegamentiElaborato(
  commessaId: number,
  elaboratoId: number
): Promise<CollegamentiElaborato> {
  const righeAttivita = await queryAttivita(commessaId)
    .where('a.elaborato_id', elaboratoId)
    .orderBy('a.settimana_inizio', 'asc')
    .orderBy('a.codice', 'asc')
  const attivita = righeAttivita.map(mappaAttivita)

  const idVincoli = new Set(attivita.flatMap((a) => a.vincoli.map((v) => v.id)))
  const registro = idVincoli.size === 0 ? [] : await registroVincoli(commessaId, 'tutti')
  const vincoli = registro.filter((v) => idVincoli.has(v.id))

  const righeImpegni = await queryImpegni()
    .join('piani_settimanali as p', 'p.id', 'i.piano_id')
    .where('p.commessa_id', commessaId)
    .where((q) => {
      q.where('i.elaborato_id', elaboratoId).orWhere('a.elaborato_id', elaboratoId)
    })
    .select('p.settimana as piano_settimana', 'p.stato as piano_stato')
    .orderBy('p.settimana', 'desc')
    .orderBy('i.ordine', 'asc')
    .orderBy('i.id', 'asc')
  const impegni = righeImpegni.map((r) => ({
    ...mappaImpegno(r),
    settimana: r.piano_settimana as Lunedi,
    statoPiano: r.piano_stato as StatoPiano,
  }))

  return { attivita, vincoli, impegni }
}

export async function disciplineAttive(): Promise<{ id: number; codice: string; nome: string }[]> {
  return db
    .from('discipline')
    .where('attiva', true)
    .orderBy('ordine', 'asc')
    .select('id', 'codice', 'nome')
}
