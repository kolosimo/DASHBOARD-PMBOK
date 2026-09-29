/**
 * Letture del registro attività (tabella audit_log, solo inserimenti).
 * Proprietario: agente B3. Il modulo non scrive su nessuna tabella.
 *
 * Il registro è uno strumento di controllo dell'amministratore (chi ha cambiato
 * cosa e quando): l'ordine è sempre cronologico, mai per persona, e non si
 * calcolano conteggi o totali per utente (art. 4 Statuto dei lavoratori).
 */
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { FUSO } from '#shared/calendario'

export const VOCI_PER_PAGINA = 50

export interface FiltriRegistro {
  /** Primo giorno incluso, "YYYY-MM-DD" (ora di Roma) */
  dal: string | null
  /** Ultimo giorno incluso, "YYYY-MM-DD" (ora di Roma) */
  al: string | null
  utenteId: number | null
  entita: string | null
  pagina: number
}

export interface VoceRegistro {
  id: number
  creatoIl: Date
  utenteNome: string | null
  azione: string
  entita: string
  entitaId: string | null
  commessaCodice: string | null
  ip: string | null
  datiPrima: string | null
  datiDopo: string | null
}

/** Giorno valido "YYYY-MM-DD", altrimenti null */
export function giornoValido(valore: unknown): string | null {
  if (typeof valore !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valore)) return null
  return DateTime.fromISO(valore, { zone: FUSO }).isValid ? valore : null
}

/** Inizio del giorno a Roma, come istante */
function inizioGiorno(giorno: string) {
  return DateTime.fromISO(giorno, { zone: FUSO }).startOf('day').toJSDate()
}

function testoJson(valore: unknown): string | null {
  if (valore === null || valore === undefined) return null
  return typeof valore === 'string' ? valore : JSON.stringify(valore, null, 2)
}

/** Voci del registro filtrate, dalla più recente, una pagina alla volta */
export async function vociRegistro(f: FiltriRegistro) {
  const q = db
    .from('audit_log as a')
    .leftJoin('utenti as u', 'u.id', 'a.utente_id')
    .leftJoin('commesse as c', 'c.id', 'a.commessa_id')
    .select(
      'a.id',
      'a.creato_il',
      'u.nome as utente_nome',
      'a.azione',
      'a.entita',
      'a.entita_id',
      'c.codice as commessa_codice',
      'a.ip',
      'a.dati_prima',
      'a.dati_dopo'
    )
  if (f.dal) q.where('a.creato_il', '>=', inizioGiorno(f.dal))
  if (f.al) {
    const fine = DateTime.fromISO(f.al, { zone: FUSO }).plus({ days: 1 }).startOf('day')
    q.where('a.creato_il', '<', fine.toJSDate())
  }
  if (f.utenteId !== null) q.where('a.utente_id', f.utenteId)
  if (f.entita) q.where('a.entita', f.entita)
  q.orderBy('a.creato_il', 'desc').orderBy('a.id', 'desc')

  const risultato = await q.paginate(f.pagina, VOCI_PER_PAGINA)
  const voci: VoceRegistro[] = risultato.all().map((r: any) => ({
    id: Number(r.id),
    creatoIl: r.creato_il,
    utenteNome: r.utente_nome ?? null,
    azione: r.azione,
    entita: r.entita,
    entitaId: r.entita_id ?? null,
    commessaCodice: r.commessa_codice ?? null,
    ip: r.ip ?? null,
    datiPrima: testoJson(r.dati_prima),
    datiDopo: testoJson(r.dati_dopo),
  }))
  return {
    voci,
    totale: Number(risultato.total),
    pagina: risultato.currentPage,
    ultimaPagina: Math.max(1, risultato.lastPage),
  }
}

/** Utenti per il filtro, in ordine alfabetico (anche i disattivati) */
export async function utentiPerFiltro() {
  return db.from('utenti').orderBy('nome', 'asc').select('id', 'nome', 'attivo')
}

/** Entità presenti nel registro, in ordine alfabetico */
export async function entitaPresenti(): Promise<string[]> {
  const righe = await db.from('audit_log').distinct('entita').orderBy('entita', 'asc')
  return righe.map((r) => r.entita as string)
}
