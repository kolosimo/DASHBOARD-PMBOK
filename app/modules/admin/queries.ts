/**
 * Query del pannello di amministrazione. Proprietario: agente A1.
 * Tabelle di configurazione: discipline, stati_elaborato, colonne_kanban,
 * cause_non_completamento, impostazioni, utenti (ruolo e attivo).
 */
import db from '@adonisjs/lucid/services/db'
import Impostazione from '#models/impostazione'
import Utente from '#models/utente'
import Disciplina from '#models/disciplina'
import StatoElaborato from '#models/stato_elaborato'
import ColonnaKanban from '#models/colonna_kanban'
import CausaNonCompletamento from '#models/causa_non_completamento'

/** Impostazioni in ordine di chiave (implementata in Fase 0) */
export async function elencoImpostazioni() {
  return Impostazione.query().orderBy('chiave', 'asc')
}

/** Utenti in ordine di nome (anche i disattivati) */
export async function elencoUtenti() {
  return Utente.query().orderBy('attivo', 'desc').orderBy('nome', 'asc')
}

/** Discipline in ordine di visualizzazione */
export async function elencoDiscipline() {
  return Disciplina.query().orderBy('ordine', 'asc').orderBy('codice', 'asc')
}

/** Discipline per le tendine (id, codice, nome, attiva) */
export async function disciplinePerScelta() {
  return db
    .from('discipline')
    .orderBy('ordine', 'asc')
    .orderBy('codice', 'asc')
    .select('id', 'codice', 'nome', 'attiva')
}

/** Stati dell'elaborato in ordine di avanzamento, con la colonna Kanban */
export async function elencoStati() {
  return StatoElaborato.query().preload('colonnaKanban').orderBy('ordine', 'asc')
}

/** Colonne Kanban in ordine */
export async function elencoColonne() {
  return ColonnaKanban.query().orderBy('ordine', 'asc')
}

/** Cause di non completamento in ordine */
export async function elencoCause() {
  return CausaNonCompletamento.query().orderBy('ordine', 'asc').orderBy('codice', 'asc')
}

/** Id delle commesse non chiuse (per avvisare le pagine aperte di un cambio di configurazione) */
export async function commesseAperte(): Promise<number[]> {
  const righe = await db.from('commesse').whereNot('stato', 'chiusa').select('id')
  return righe.map((r) => r.id as number)
}
