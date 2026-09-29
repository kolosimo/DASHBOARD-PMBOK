/**
 * Seeder "produzione": solo la configurazione iniziale, nessuna commessa e
 * nessun utente (il primo admin si crea con `node ace utenti:crea-admin`).
 *
 * - discipline MEC, ELE, IDR, ANT;
 * - colonne Kanban con WIP di default 4 (in corso) e 3 (in verifica);
 * - stati dell'elaborato con pesi EV confermati al Gate 0: 0/20/50/70/85/100;
 * - 8 cause di non completamento;
 * - impostazioni con i valori di default (`IMPOSTAZIONI_DEFAULT`).
 *
 * È **idempotente** e **non cancella né modifica** nulla: inserisce solo le
 * righe che mancano (per codice o chiave). Quello che l'admin ha già
 * cambiato resta com'è; le differenze dai valori confermati si segnalano.
 *
 * Gira da solo con `node ace db:seed` solo con NODE_ENV=production; il
 * comando `node ace db:inizializza-produzione` lo esegue in ogni ambiente.
 */
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { IMPOSTAZIONI_DEFAULT } from '#shared/impostazioni'

export const DISCIPLINE_PRODUZIONE = [
  { codice: 'MEC', nome: 'Impianti meccanici', ordine: 1 },
  { codice: 'ELE', nome: 'Impianti elettrici', ordine: 2 },
  { codice: 'IDR', nome: 'Impianti idrico-sanitari', ordine: 3 },
  { codice: 'ANT', nome: 'Antincendio', ordine: 4 },
] as const

export const COLONNE_PRODUZIONE = [
  { codice: 'da_fare', nome: 'Da fare', ordine: 1, limiteWip: null },
  { codice: 'in_corso', nome: 'In corso', ordine: 2, limiteWip: 4 },
  { codice: 'in_verifica', nome: 'In verifica', ordine: 3, limiteWip: 3 },
  { codice: 'emesso', nome: 'Emesso', ordine: 4, limiteWip: null },
] as const

/** Pesi EV cumulativi confermati al Gate 0 (28/09) */
export const STATI_PRODUZIONE = [
  { codice: 'non_iniziato', nome: 'Non iniziato', ordine: 0, peso: 0, colonna: 'da_fare' },
  { codice: 'impostato', nome: 'Impostato', ordine: 1, peso: 20, colonna: 'in_corso' },
  {
    codice: 'calcoli',
    nome: 'Calcoli e dimensionamento',
    ordine: 2,
    peso: 50,
    colonna: 'in_corso',
  },
  {
    codice: 'emissione_interna',
    nome: 'Emissione interna',
    ordine: 3,
    peso: 70,
    colonna: 'in_verifica',
  },
  { codice: 'verificato', nome: 'Verificato', ordine: 4, peso: 85, colonna: 'in_verifica' },
  { codice: 'emesso_cliente', nome: 'Emesso al cliente', ordine: 5, peso: 100, colonna: 'emesso' },
] as const

export const CAUSE_PRODUZIONE = [
  { codice: 'input_mancante', nome: 'Input mancante da altri' },
  { codice: 'criteri_cambiati', nome: 'Criteri o requisiti cambiati' },
  { codice: 'approvazione_attesa', nome: 'Approvazione cliente/ente attesa' },
  { codice: 'risorsa_non_disponibile', nome: 'Risorsa non disponibile' },
  { codice: 'stima_ottimista', nome: 'Stima troppo ottimista' },
  { codice: 'errore_rilavorazione', nome: 'Errore o rilavorazione' },
  { codice: 'priorita_cambiata', nome: 'Priorità cambiata dal PM' },
  { codice: 'altro', nome: 'Altro' },
] as const

/**
 * Impostazioni ancora "di esempio" (da tarare con i PM nel pilota): le soglie
 * dei semafori (D5) e le ore per persona (in attesa di D4). Le altre sono
 * valori di lavoro.
 */
function diEsempio(chiave: string) {
  return chiave.startsWith('soglie.') || chiave === 'ore.per_persona_visibili'
}

export interface EsitoTabella {
  tabella: string
  aggiunte: number
  presenti: number
}

export interface EsitoSeminaProduzione {
  tabelle: EsitoTabella[]
  /** Differenze tra DB e valori confermati, lasciate invariate */
  differenze: string[]
}

/** Inserisce le righe mancanti (per `colonnaUnica`) e conta aggiunte e presenti */
async function inserisciMancanti(
  client: QueryClientContract,
  tabella: string,
  colonnaUnica: string,
  righe: Record<string, unknown>[]
): Promise<EsitoTabella> {
  const inserite: unknown[] = await client
    .knexQuery()
    .table(tabella)
    .insert(righe)
    .onConflict(colonnaUnica)
    .ignore()
    .returning(colonnaUnica)
  return { tabella, aggiunte: inserite.length, presenti: righe.length - inserite.length }
}

/**
 * Semina la configurazione di produzione. Da chiamare dentro una
 * transazione: o entra tutto o niente.
 */
export async function seminaConfigurazioneProduzione(
  client: QueryClientContract
): Promise<EsitoSeminaProduzione> {
  const tabelle: EsitoTabella[] = []
  const differenze: string[] = []

  tabelle.push(
    await inserisciMancanti(
      client,
      'discipline',
      'codice',
      DISCIPLINE_PRODUZIONE.map((d) => ({ ...d, attiva: true }))
    )
  )

  // Le colonne hanno anche `ordine` univoco: si inseriscono solo quelle con
  // codice e ordine liberi, per non urtare una configurazione già cambiata.
  const colonneEsistenti = await client.from('colonne_kanban').select('codice', 'ordine')
  const codiciColonne = new Set(colonneEsistenti.map((c) => c.codice))
  const ordiniColonne = new Set(colonneEsistenti.map((c) => c.ordine))
  const colonneDaInserire = COLONNE_PRODUZIONE.filter(
    (c) => !codiciColonne.has(c.codice) && !ordiniColonne.has(c.ordine)
  )
  for (const c of COLONNE_PRODUZIONE) {
    if (!codiciColonne.has(c.codice) && ordiniColonne.has(c.ordine)) {
      differenze.push(
        `Colonna "${c.codice}" non aggiunta: l'ordine ${c.ordine} è già usato da un'altra colonna.`
      )
    }
  }
  if (colonneDaInserire.length > 0) {
    await client
      .insertQuery()
      .table('colonne_kanban')
      .multiInsert(
        colonneDaInserire.map((c) => ({
          codice: c.codice,
          nome: c.nome,
          ordine: c.ordine,
          limite_wip_default: c.limiteWip,
        }))
      )
  }
  tabelle.push({
    tabella: 'colonne_kanban',
    aggiunte: colonneDaInserire.length,
    presenti: COLONNE_PRODUZIONE.length - colonneDaInserire.length,
  })
  const colonne = await client.from('colonne_kanban').select('id', 'codice', 'limite_wip_default')
  const colonnaId = new Map(colonne.map((c) => [c.codice as string, c.id as number]))
  for (const c of COLONNE_PRODUZIONE) {
    const riga = colonne.find((x) => x.codice === c.codice)
    if (riga && riga.limite_wip_default !== c.limiteWip) {
      differenze.push(
        `Colonna "${c.codice}": WIP di default ${riga.limite_wip_default ?? 'nessuno'} nel DB, ` +
          `${c.limiteWip ?? 'nessuno'} nei valori confermati (lasciato invariato).`
      )
    }
  }

  // Stati: stessa cautela su `ordine` (univoco) e sulla colonna di arrivo
  const statiEsistenti = await client
    .from('stati_elaborato')
    .select('codice', 'ordine', 'peso_ev_percento')
  const codiciStati = new Set(statiEsistenti.map((s) => s.codice))
  const ordiniStati = new Set(statiEsistenti.map((s) => s.ordine))
  const statiDaInserire = STATI_PRODUZIONE.filter((s) => {
    if (codiciStati.has(s.codice)) return false
    if (ordiniStati.has(s.ordine)) {
      differenze.push(
        `Stato "${s.codice}" non aggiunto: l'ordine ${s.ordine} è già usato da un altro stato.`
      )
      return false
    }
    if (!colonnaId.has(s.colonna)) {
      differenze.push(`Stato "${s.codice}" non aggiunto: manca la colonna "${s.colonna}".`)
      return false
    }
    return true
  })
  if (statiDaInserire.length > 0) {
    await client
      .insertQuery()
      .table('stati_elaborato')
      .multiInsert(
        statiDaInserire.map((s) => ({
          codice: s.codice,
          nome: s.nome,
          ordine: s.ordine,
          peso_ev_percento: s.peso,
          colonna_kanban_id: colonnaId.get(s.colonna),
          finale: s.ordine === 5,
        }))
      )
  }
  tabelle.push({
    tabella: 'stati_elaborato',
    aggiunte: statiDaInserire.length,
    presenti: STATI_PRODUZIONE.length - statiDaInserire.length,
  })
  for (const s of STATI_PRODUZIONE) {
    const riga = statiEsistenti.find((x) => x.codice === s.codice)
    if (riga && riga.peso_ev_percento !== s.peso) {
      differenze.push(
        `Stato "${s.codice}": peso EV ${riga.peso_ev_percento}% nel DB, ${s.peso}% confermato (lasciato invariato).`
      )
    }
  }

  tabelle.push(
    await inserisciMancanti(
      client,
      'cause_non_completamento',
      'codice',
      CAUSE_PRODUZIONE.map((c, i) => ({ ...c, ordine: i + 1, attiva: true }))
    )
  )

  tabelle.push(
    await inserisciMancanti(
      client,
      'impostazioni',
      'chiave',
      Object.entries(IMPOSTAZIONI_DEFAULT).map(([chiave, v]) => ({
        chiave,
        valore: JSON.stringify(v.valore),
        descrizione: v.descrizione,
        di_esempio: diEsempio(chiave),
      }))
    )
  )

  return { tabelle, differenze }
}

export default class ConfigurazioneProduzioneSeeder extends BaseSeeder {
  static environment = ['production']

  async run() {
    await this.client.transaction(async (trx) => {
      await seminaConfigurazioneProduzione(trx)
    })
  }
}
