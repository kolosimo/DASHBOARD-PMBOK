/**
 * Query di lettura del modulo anagrafiche (commesse, team, milestone).
 * Proprietario: agente A1. `commesseVisibili` è implementata in Fase 0.
 */
import db from '@adonisjs/lucid/services/db'
import type Utente from '#models/utente'
import type { DataIso, RuoloCommessa, StatoCommessa } from '#domain/types'

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

/** Commessa con PM e membri del team (ordinati per ruolo e nome) */
export async function commessaConTeam(commessaId: number): Promise<CommessaConTeam | null> {
  void commessaId
  throw new Error('non implementato')
}

/** Milestone non completate a partire da una data, al massimo `limite` */
export async function milestoneProssime(
  commessaId: number,
  daData: DataIso,
  limite = 5
): Promise<MilestoneProssima[]> {
  void commessaId
  void daData
  void limite
  throw new Error('non implementato')
}
