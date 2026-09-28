/**
 * Configurazione del flusso letta dal DB: stati dell'elaborato in ordine,
 * colonne Kanban e limiti WIP della commessa. Proprietario: agente A3.
 *
 * Gli stati si confrontano per **posizione** nella sequenza ordinata
 * (0 = stato iniziale), così la regola "uno stato alla volta" vale anche se
 * l'admin configura ordini non consecutivi (per esempio 0, 10, 20).
 */
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export interface StatoFlusso {
  id: number
  codice: string
  nome: string
  ordine: number
  /** Posizione nella sequenza ordinata degli stati (0 = iniziale) */
  posizione: number
  finale: boolean
  colonnaId: number
  colonnaCodice: string
}

export interface ColonnaFlusso {
  id: number
  codice: string
  nome: string
  ordine: number
  /** Limite effettivo: quello della commessa se c'è, altrimenti il default */
  limiteWip: number | null
}

export interface ConfigurazioneFlusso {
  stati: StatoFlusso[]
  colonne: ColonnaFlusso[]
  statoPerId: Map<number, StatoFlusso>
  /** Posizione dello stato finale (l'ultimo con `finale`, altrimenti l'ultimo) */
  posizioneFinale: number
}

/** Stati, colonne e limiti WIP (default + commessa) in due query */
export async function configurazioneFlusso(
  commessaId: number | null,
  client?: TransactionClientContract
): Promise<ConfigurazioneFlusso> {
  const q = client ?? db
  const righeStati = await q
    .from('stati_elaborato as s')
    .join('colonne_kanban as c', 'c.id', 's.colonna_kanban_id')
    .select('s.id', 's.codice', 's.nome', 's.ordine', 's.finale', 's.colonna_kanban_id')
    .select('c.codice as colonna_codice')
    .orderBy('s.ordine', 'asc')

  const righeColonne = await q
    .from('colonne_kanban as c')
    .leftJoin('limiti_wip_commessa as l', (j) => {
      j.on('l.colonna_kanban_id', '=', 'c.id').andOnVal('l.commessa_id', '=', commessaId ?? 0)
    })
    .select('c.id', 'c.codice', 'c.nome', 'c.ordine', 'c.limite_wip_default', 'l.limite')
    .orderBy('c.ordine', 'asc')

  const stati: StatoFlusso[] = righeStati.map((r, i) => ({
    id: r.id,
    codice: r.codice,
    nome: r.nome,
    ordine: r.ordine,
    posizione: i,
    finale: r.finale,
    colonnaId: r.colonna_kanban_id,
    colonnaCodice: r.colonna_codice,
  }))
  const colonne: ColonnaFlusso[] = righeColonne.map((r) => ({
    id: r.id,
    codice: r.codice,
    nome: r.nome,
    ordine: r.ordine,
    limiteWip: r.limite ?? r.limite_wip_default ?? null,
  }))
  const finali = stati.filter((s) => s.finale)
  const posizioneFinale =
    finali.length > 0 ? finali[finali.length - 1].posizione : Math.max(stati.length - 1, 0)
  return {
    stati,
    colonne,
    statoPerId: new Map(stati.map((s) => [s.id, s])),
    posizioneFinale,
  }
}
