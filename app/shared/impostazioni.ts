/**
 * Impostazioni dell'app (tabella `impostazioni`, valori JSON).
 *
 * I valori iniziali sono **di esempio** e vanno tarati con i PM al Gate 0.
 * Le chiavi sono tipizzate: aggiungere una chiave significa aggiungerla qui,
 * in IMPOSTAZIONI_DEFAULT e nel seeder (file dell'orchestratore).
 */
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Impostazione from '#models/impostazione'
import type { Soglia } from '#domain/types'
import { SOGLIE_DEFAULT } from '#domain/soglie'
import { aggiornaConVersione, type RendiFrammento } from '#shared/optimistic'

export interface MappaImpostazioni {
  'soglie.spi': Soglia
  'soglie.cpi': Soglia
  'soglie.ppc': Soglia
  'soglie.pcr': Soglia
  'ore.minuti_massimi_giorno': number
  'ore.giorni_modifica_consentita': number
  'ore.per_persona_visibili': boolean
  'flusso.giorni_elaborato_fermo': number
  'lps.settimane_lookahead': number
  'avvisi.giorni_preavviso_vincoli': number
}

export type ChiaveImpostazione = keyof MappaImpostazioni

export const IMPOSTAZIONI_DEFAULT: {
  [K in ChiaveImpostazione]: { valore: MappaImpostazioni[K]; descrizione: string }
} = {
  'soglie.spi': {
    valore: { ...SOGLIE_DEFAULT.spi },
    descrizione: 'Semaforo SPI: verde da, giallo da (sotto è rosso)',
  },
  'soglie.cpi': {
    valore: { ...SOGLIE_DEFAULT.cpi },
    descrizione: 'Semaforo CPI: verde da, giallo da (sotto è rosso)',
  },
  'soglie.ppc': {
    valore: { ...SOGLIE_DEFAULT.ppc },
    descrizione: 'Semaforo PPC (rapporto 0–1): verde da, giallo da',
  },
  'soglie.pcr': {
    valore: { ...SOGLIE_DEFAULT.pcr },
    descrizione: 'Semaforo PCR (rapporto 0–1): verde da, giallo da',
  },
  'ore.minuti_massimi_giorno': {
    valore: 720,
    descrizione: 'Minuti massimi registrabili da una persona in un giorno',
  },
  'ore.giorni_modifica_consentita': {
    valore: 7,
    descrizione: 'Giorni dopo la fine della settimana entro cui si possono modificare le ore',
  },
  'ore.per_persona_visibili': {
    valore: false,
    descrizione:
      'Il PM vede le ore per persona della sua commessa (disattivato: art. 4 Statuto dei lavoratori, D4)',
  },
  'flusso.giorni_elaborato_fermo': {
    valore: 10,
    descrizione: 'Giorni nello stesso stato oltre cui un elaborato è segnalato come fermo',
  },
  'lps.settimane_lookahead': {
    valore: 6,
    descrizione: 'Settimane mostrate nel lookahead',
  },
  'avvisi.giorni_preavviso_vincoli': {
    valore: 7,
    descrizione: 'Giorni di preavviso per i vincoli aperti in scadenza',
  },
}

/** Legge un'impostazione; se manca nel DB usa il valore di esempio */
export async function leggiImpostazione<K extends ChiaveImpostazione>(
  chiave: K,
  client?: TransactionClientContract
): Promise<MappaImpostazioni[K]> {
  const riga = await Impostazione.query(client ? { client } : {})
    .where('chiave', chiave)
    .first()
  if (!riga) return IMPOSTAZIONI_DEFAULT[chiave].valore
  return riga.valore as MappaImpostazioni[K]
}

/** Tutte le impostazioni in un colpo solo (una query) */
export async function leggiTutteLeImpostazioni(): Promise<MappaImpostazioni> {
  const righe = await Impostazione.all()
  const valori = Object.fromEntries(
    Object.entries(IMPOSTAZIONI_DEFAULT).map(([k, v]) => [k, v.valore])
  ) as Record<string, unknown>
  for (const r of righe) {
    if (r.chiave in IMPOSTAZIONI_DEFAULT) valori[r.chiave] = r.valore
  }
  return valori as unknown as MappaImpostazioni
}

/** Controlla che il valore abbia la stessa forma del valore di esempio */
export function valoreValido(chiave: string, valore: unknown): boolean {
  if (!(chiave in IMPOSTAZIONI_DEFAULT)) return false
  const esempio = IMPOSTAZIONI_DEFAULT[chiave as ChiaveImpostazione].valore
  if (typeof esempio === 'number')
    return typeof valore === 'number' && Number.isFinite(valore) && valore >= 0
  if (typeof esempio === 'boolean') return typeof valore === 'boolean'
  if (typeof valore !== 'object' || valore === null) return false
  const s = valore as Record<string, unknown>
  return (
    typeof s.verde === 'number' &&
    typeof s.giallo === 'number' &&
    (s.verso === 'alto' || s.verso === 'basso') &&
    Number.isFinite(s.verde) &&
    Number.isFinite(s.giallo)
  )
}

/**
 * Aggiorna un'impostazione con optimistic locking e audit.
 * Dopo la modifica il valore non è più "di esempio".
 */
export async function aggiornaImpostazione(
  id: number,
  versioneAttesa: number,
  valore: unknown,
  utenteId: number,
  rendiFrammento?: RendiFrammento<Impostazione>
) {
  return aggiornaConVersione(
    Impostazione,
    id,
    versioneAttesa,
    (riga) => {
      riga.valore = valore
      riga.diEsempio = false
      riga.aggiornatoDaId = utenteId
    },
    { audit: { utenteId, azione: 'impostazione.aggiornata' }, rendiFrammento }
  )
}
