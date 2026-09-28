/**
 * Query di lettura del modulo anagrafiche (commesse, team, milestone).
 * Proprietario: agente A1. `commesseVisibili` è implementata in Fase 0.
 */
import db from '@adonisjs/lucid/services/db'
import type Utente from '#models/utente'
import type { ClasseServizio, DataIso, RuoloCommessa, StatoCommessa } from '#domain/types'

export interface RigaCommessaVisibile {
  id: number
  codice: string
  nome: string
  cliente: string | null
  stato: StatoCommessa
  pmNome: string | null
  /** Ruolo dell'utente nella commessa; null se la vede per ruolo globale */
  ruoloCommessa: RuoloCommessa | null
  prossimaMilestone: { titolo: string; data: DataIso } | null
  numeroElaborati: number
}

export interface CommessaConTeam {
  id: number
  codice: string
  nome: string
  cliente: string | null
  stato: StatoCommessa
  pm: { id: number; nome: string } | null
  membri: { utenteId: number; nome: string; email: string; ruoloCommessa: RuoloCommessa }[]
}

export interface MilestoneProssima {
  id: number
  titolo: string
  dataPrevista: DataIso
  dataEffettiva: DataIso | null
  contrattuale: boolean
}

/**
 * Commesse che l'utente può vedere, in una sola query:
 * - admin e direzione: tutte;
 * - gli altri: quelle di cui sono PM (pm_id) o membri.
 * Ordine: attive prima, poi per codice. Include la prossima milestone non
 * completata (data prevista più vicina) e il numero di elaborati.
 */
export async function commesseVisibili(utente: Utente): Promise<RigaCommessaVisibile[]> {
  const tutte = utente.ruolo === 'admin' || utente.ruolo === 'direzione'

  const query = db
    .from('commesse as c')
    .leftJoin('utenti as pm', 'pm.id', 'c.pm_id')
    .leftJoin('membri_commessa as m', (j) => {
      j.on('m.commessa_id', '=', 'c.id').andOnVal('m.utente_id', '=', utente.id)
    })
    .joinRaw(
      `LEFT JOIN LATERAL (
         SELECT ms.titolo, ms.data_prevista
         FROM milestone ms
         WHERE ms.commessa_id = c.id AND ms.data_effettiva IS NULL
         ORDER BY ms.data_prevista ASC, ms.ordine ASC
         LIMIT 1
       ) AS pross ON TRUE`
    )
    .joinRaw(
      `LEFT JOIN LATERAL (
         SELECT count(*) AS n FROM elaborati e WHERE e.commessa_id = c.id
       ) AS el ON TRUE`
    )
    .select(
      'c.id',
      'c.codice',
      'c.nome',
      'c.cliente',
      'c.stato',
      'pm.nome as pm_nome',
      'm.ruolo_commessa',
      'pross.titolo as ms_titolo',
      'pross.data_prevista as ms_data',
      'el.n as numero_elaborati'
    )
    .orderByRaw("CASE c.stato WHEN 'attiva' THEN 0 WHEN 'sospesa' THEN 1 ELSE 2 END")
    .orderBy('c.codice', 'asc')

  if (!tutte) {
    query.where((q) => {
      q.where('c.pm_id', utente.id).orWhereNotNull('m.id')
    })
  }

  const righe = await query
  return righe.map((r) => ({
    id: r.id,
    codice: r.codice,
    nome: r.nome,
    cliente: r.cliente,
    stato: r.stato,
    pmNome: r.pm_nome,
    ruoloCommessa: r.ruolo_commessa ?? (tutte ? null : 'pm'),
    prossimaMilestone: r.ms_titolo ? { titolo: r.ms_titolo, data: r.ms_data } : null,
    numeroElaborati: Number(r.numero_elaborati ?? 0),
  }))
}

const ORDINE_RUOLI =
  "CASE m.ruolo_commessa WHEN 'pm' THEN 0 WHEN 'progettista' THEN 1 WHEN 'verificatore' THEN 2 ELSE 3 END"

/** Commessa con PM e membri del team (ordinati per ruolo e nome) */
export async function commessaConTeam(commessaId: number): Promise<CommessaConTeam | null> {
  const c = await db
    .from('commesse as c')
    .leftJoin('utenti as pm', 'pm.id', 'c.pm_id')
    .where('c.id', commessaId)
    .select('c.id', 'c.codice', 'c.nome', 'c.cliente', 'c.stato', 'c.pm_id', 'pm.nome as pm_nome')
    .first()
  if (!c) return null
  const membri = await db
    .from('membri_commessa as m')
    .join('utenti as u', 'u.id', 'm.utente_id')
    .where('m.commessa_id', commessaId)
    .select('m.utente_id', 'u.nome', 'u.email', 'm.ruolo_commessa')
    .orderByRaw(ORDINE_RUOLI)
    .orderBy('u.nome', 'asc')
  return {
    id: c.id,
    codice: c.codice,
    nome: c.nome,
    cliente: c.cliente,
    stato: c.stato,
    pm: c.pm_id ? { id: c.pm_id, nome: c.pm_nome } : null,
    membri: membri.map((m) => ({
      utenteId: m.utente_id,
      nome: m.nome,
      email: m.email,
      ruoloCommessa: m.ruolo_commessa,
    })),
  }
}

/**
 * Milestone non completate (senza data effettiva) con data prevista uguale o
 * successiva a `daData`, in ordine di data prevista; al massimo `limite`.
 */
export async function milestoneProssime(
  commessaId: number,
  daData: DataIso,
  limite = 5
): Promise<MilestoneProssima[]> {
  const righe = await db
    .from('milestone')
    .where('commessa_id', commessaId)
    .whereNull('data_effettiva')
    .where('data_prevista', '>=', daData)
    .orderBy('data_prevista', 'asc')
    .orderBy('ordine', 'asc')
    .orderBy('id', 'asc')
    .limit(limite)
    .select('id', 'titolo', 'data_prevista', 'data_effettiva', 'contrattuale')
  return righe.map((r) => ({
    id: r.id,
    titolo: r.titolo,
    dataPrevista: r.data_prevista,
    dataEffettiva: r.data_effettiva,
    contrattuale: r.contrattuale,
  }))
}

// ---------------------------------------------------------------------------
// Letture interne del modulo (pagina anagrafica)
// ---------------------------------------------------------------------------

export interface RigaMembro {
  id: number
  utenteId: number
  nome: string
  email: string
  ruoloCommessa: RuoloCommessa
  version: number
}

/** Membri del team con id e versione (per le modifiche) */
export async function elencoMembri(commessaId: number): Promise<RigaMembro[]> {
  const righe = await db
    .from('membri_commessa as m')
    .join('utenti as u', 'u.id', 'm.utente_id')
    .where('m.commessa_id', commessaId)
    .select('m.id', 'm.utente_id', 'u.nome', 'u.email', 'm.ruolo_commessa', 'm.version')
    .orderByRaw(ORDINE_RUOLI)
    .orderBy('u.nome', 'asc')
  return righe.map((r) => ({
    id: r.id,
    utenteId: r.utente_id,
    nome: r.nome,
    email: r.email,
    ruoloCommessa: r.ruolo_commessa,
    version: r.version,
  }))
}

export interface RigaMilestone {
  id: number
  titolo: string
  dataPrevista: DataIso
  dataEffettiva: DataIso | null
  contrattuale: boolean
  ordine: number
  version: number
}

/** Tutte le milestone della commessa, per data prevista */
export async function elencoMilestone(commessaId: number): Promise<RigaMilestone[]> {
  const righe = await db
    .from('milestone')
    .where('commessa_id', commessaId)
    .orderBy('data_prevista', 'asc')
    .orderBy('ordine', 'asc')
    .orderBy('id', 'asc')
    .select('id', 'titolo', 'data_prevista', 'data_effettiva', 'contrattuale', 'ordine', 'version')
  return righe.map((r) => ({
    id: r.id,
    titolo: r.titolo,
    dataPrevista: r.data_prevista,
    dataEffettiva: r.data_effettiva,
    contrattuale: r.contrattuale,
    ordine: r.ordine,
    version: r.version,
  }))
}

export interface RigaElaborato {
  id: number
  codice: string
  titolo: string
  disciplinaId: number
  disciplina: string
  budgetMinuti: number
  classeServizio: ClasseServizio
  dataFissa: DataIso | null
  responsabileId: number | null
  responsabile: string | null
  milestoneId: number | null
  milestone: string | null
  stato: string
  version: number
}

/** Elaborati della commessa con disciplina, stato, responsabile e milestone */
export async function elencoElaborati(commessaId: number): Promise<RigaElaborato[]> {
  const righe = await db
    .from('elaborati as e')
    .join('discipline as d', 'd.id', 'e.disciplina_id')
    .join('stati_elaborato as s', 's.id', 'e.stato_id')
    .leftJoin('utenti as u', 'u.id', 'e.responsabile_id')
    .leftJoin('milestone as ms', 'ms.id', 'e.milestone_id')
    .where('e.commessa_id', commessaId)
    .orderBy('e.codice', 'asc')
    .select(
      'e.id',
      'e.codice',
      'e.titolo',
      'e.disciplina_id',
      'd.codice as disciplina',
      'e.budget_minuti',
      'e.classe_servizio',
      'e.data_fissa',
      'e.responsabile_id',
      'u.nome as responsabile',
      'e.milestone_id',
      'ms.titolo as milestone',
      's.nome as stato',
      'e.version'
    )
  return righe.map((r) => ({
    id: r.id,
    codice: r.codice,
    titolo: r.titolo,
    disciplinaId: r.disciplina_id,
    disciplina: r.disciplina,
    budgetMinuti: r.budget_minuti,
    classeServizio: r.classe_servizio,
    dataFissa: r.data_fissa,
    responsabileId: r.responsabile_id,
    responsabile: r.responsabile,
    milestoneId: r.milestone_id,
    milestone: r.milestone,
    stato: r.stato,
    version: r.version,
  }))
}

/** Codici degli elaborati già presenti nella commessa */
export async function codiciElaborati(commessaId: number): Promise<Set<string>> {
  const righe = await db.from('elaborati').where('commessa_id', commessaId).select('codice')
  return new Set(righe.map((r) => r.codice as string))
}

export interface UtenteSelezionabile {
  id: number
  nome: string
  email: string
  ruolo: string
}

/** Utenti attivi, per le tendine (PM, membri, responsabili) */
export async function utentiAttivi(): Promise<UtenteSelezionabile[]> {
  return db
    .from('utenti')
    .where('attivo', true)
    .orderBy('nome', 'asc')
    .select('id', 'nome', 'email', 'ruolo')
}

export interface LimiteWipRiga {
  colonnaId: number
  codice: string
  nome: string
  limiteDefault: number | null
  /** Limite specifico della commessa (null = vale il default) */
  limiteCommessa: number | null
  limiteId: number | null
  version: number | null
}

/** Colonne Kanban con il limite WIP di default e quello della commessa */
export async function limitiWipCommessa(commessaId: number): Promise<LimiteWipRiga[]> {
  const righe = await db
    .from('colonne_kanban as k')
    .leftJoin('limiti_wip_commessa as l', (j) => {
      j.on('l.colonna_kanban_id', '=', 'k.id').andOnVal('l.commessa_id', '=', commessaId)
    })
    .orderBy('k.ordine', 'asc')
    .select(
      'k.id',
      'k.codice',
      'k.nome',
      'k.limite_wip_default',
      'l.id as limite_id',
      'l.limite',
      'l.version'
    )
  return righe.map((r) => ({
    colonnaId: r.id,
    codice: r.codice,
    nome: r.nome,
    limiteDefault: r.limite_wip_default,
    limiteCommessa: r.limite,
    limiteId: r.limite_id,
    version: r.version,
  }))
}
