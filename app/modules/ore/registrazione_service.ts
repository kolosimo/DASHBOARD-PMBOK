/**
 * Scrittura delle ore (unica tabella del modulo: `registrazioni_ore`).
 *
 * Una cella del timesheet = una riga (utente, elaborato, giorno). Salvare 0
 * cancella la riga. Ogni scrittura:
 * - parte dalla versione vista dall'utente (0 = "la cella era vuota"): se nel
 *   frattempo è cambiata si risponde 409 (`ConflittoVersione`);
 * - finisce nel registro di audit nella stessa transazione;
 * - dopo il commit pubblica `ore.registrate` sul canale della commessa.
 *
 * Le regole di permesso (solo per sé, correzione admin) stanno nel controller;
 * qui si controllano le regole sui dati (appartenenza, giorni, limiti).
 */
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import RegistrazioneOre from '#models/registrazione_ore'
import { aggiornaConVersione, ConflittoVersione } from '#shared/optimistic'
import { istantaneaPerAudit, registraAudit } from '#shared/audit'
import { pubblica } from '#shared/eventi'
import { leggiImpostazione } from '#shared/impostazioni'
import { differenzaGiorni, domenicaDi, lunediDellaSettimana, oggiRoma } from '#shared/calendario'
import type { DataIso, Minuti } from '#domain/types'

/** Minuti massimi di una singola cella (vincolo del DB) */
export const MINUTI_MASSIMI_CELLA = 1440

/** Errore di validazione (422) con messaggio per l'utente */
export class OreNonValide extends Error {
  constructor(messaggio: string) {
    super(messaggio)
  }
}

/** Errore di permesso sui dati (403): l'utente non fa parte della commessa */
export class OreNonConsentite extends Error {
  constructor(messaggio: string) {
    super(messaggio)
  }
}

/**
 * "1,5" · "1.5" · "1:30" · "" → minuti interi (arrotondati al minuto).
 * Vuoto = 0. null se il testo non è un numero valido o è negativo.
 */
export function minutiDaTesto(testo: string | null | undefined): Minuti | null {
  const t = (testo ?? '').trim().replace(/\s+/g, '').replace(/h$/i, '')
  if (t === '') return 0
  const hm = t.match(/^(\d{1,2}):([0-5]\d)$/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])
  if (!/^\d+([.,]\d+)?$/.test(t)) return null
  const ore = Number(t.replace(',', '.'))
  if (!Number.isFinite(ore) || ore < 0) return null
  return Math.round(ore * 60)
}

export interface StatoSettimana {
  /** true se la settimana non si può più modificare (oltre i giorni consentiti) */
  chiusa: boolean
  /** Ultimo giorno in cui la settimana è modificabile */
  modificabileFinoAl: DataIso
}

/**
 * Una settimana resta modificabile fino a `giorniConsentiti` giorni dopo la
 * sua domenica (impostazione `ore.giorni_modifica_consentita`).
 */
export function statoSettimana(
  lunedi: DataIso,
  giorniConsentiti: number,
  oggi: DataIso = oggiRoma()
): StatoSettimana {
  const domenica = domenicaDi(lunedi)
  const chiusa = differenzaGiorni(domenica, oggi) > giorniConsentiti
  const fino = new Date(`${domenica}T12:00:00Z`)
  fino.setUTCDate(fino.getUTCDate() + giorniConsentiti)
  return { chiusa, modificabileFinoAl: fino.toISOString().slice(0, 10) }
}

export interface RichiestaCella {
  /** Proprietario delle ore */
  utenteId: number
  elaboratoId: number
  data: DataIso
  minuti: Minuti
  /** Versione vista dall'utente; 0 se la cella era vuota */
  versione: number
  /** Chi scrive: il proprietario, oppure l'admin che corregge */
  autoreId: number
  /** Motivo obbligatorio per la correzione dell'admin (finisce nell'audit) */
  motivoCorrezione?: string
  ip?: string | null
}

export interface EsitoCella {
  registrazione: RegistrazioneOre | null
  commessaId: number
  /** true se non c'era niente da cambiare */
  invariata: boolean
}

/** Controlla la data: formato, non futura, settimana ancora aperta (salvo correzione admin) */
async function controllaData(data: DataIso, correzione: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T00:00:00Z`))) {
    throw new OreNonValide('Data non valida.')
  }
  const oggi = oggiRoma()
  if (data > oggi) {
    throw new OreNonValide('Non si possono registrare ore per giorni futuri.')
  }
  if (correzione) return
  const giorni = await leggiImpostazione('ore.giorni_modifica_consentita')
  const stato = statoSettimana(lunediDellaSettimana(data), giorni, oggi)
  if (stato.chiusa) {
    throw new OreNonValide(
      `La settimana è chiusa: le ore si potevano modificare fino al ${stato.modificabileFinoAl.split('-').reverse().join('/')}. Per una correzione rivolgiti all'amministratore.`
    )
  }
}

/**
 * Salva una cella del timesheet (inserisce, aggiorna o cancella).
 * Lancia `OreNonValide` (422), `OreNonConsentite` (403), `ConflittoVersione` (409).
 */
export async function salvaCella(richiesta: RichiestaCella): Promise<EsitoCella> {
  const correzione = richiesta.autoreId !== richiesta.utenteId
  if (correzione && !richiesta.motivoCorrezione?.trim()) {
    throw new OreNonValide('Per correggere le ore di un’altra persona serve il motivo.')
  }
  if (!Number.isInteger(richiesta.minuti) || richiesta.minuti < 0) {
    throw new OreNonValide('Scrivi le ore come numero, per esempio 1,5.')
  }
  if (richiesta.minuti > MINUTI_MASSIMI_CELLA) {
    throw new OreNonValide('In un giorno non si possono registrare più di 24 ore.')
  }
  await controllaData(richiesta.data, correzione)

  const elaborato = await db
    .from('elaborati as e')
    .join('commesse as c', 'c.id', 'e.commessa_id')
    .where('e.id', richiesta.elaboratoId)
    .select('e.id', 'e.commessa_id', 'c.pm_id')
    .first()
  if (!elaborato) throw new OreNonValide('Elaborato non trovato.')
  const commessaId = Number(elaborato.commessa_id)

  const membro =
    Number(elaborato.pm_id) === richiesta.utenteId ||
    (await db
      .from('membri_commessa')
      .where('commessa_id', commessaId)
      .where('utente_id', richiesta.utenteId)
      .first()) !== null

  const audit = (azione: string) => ({
    utenteId: richiesta.autoreId,
    azione: correzione ? 'ore.corrette_da_admin' : azione,
    commessaId,
    ip: richiesta.ip ?? null,
  })
  const motivo = correzione ? { motivo: richiesta.motivoCorrezione!.trim() } : {}

  const esegui = async (trx: TransactionClientContract) => {
    const esistente = await RegistrazioneOre.query({ client: trx })
      .where('utente_id', richiesta.utenteId)
      .where('elaborato_id', richiesta.elaboratoId)
      .where('data', richiesta.data)
      .forUpdate()
      .first()

    // La cella era vuota per l'utente ma nel frattempo qualcuno (altra scheda) l'ha riempita
    if (esistente && richiesta.versione !== esistente.version) {
      throw new ConflittoVersione<RegistrazioneOre>(esistente, richiesta.versione)
    }
    if (!esistente && richiesta.versione !== 0) {
      throw new ConflittoVersione<RegistrazioneOre>(null, richiesta.versione)
    }

    if (!esistente) {
      if (richiesta.minuti === 0) return { registrazione: null, invariata: true }
      if (!membro) {
        throw new OreNonConsentite('Non fai parte della commessa di questo elaborato.')
      }
      const nuova = await RegistrazioneOre.create(
        {
          utenteId: richiesta.utenteId,
          elaboratoId: richiesta.elaboratoId,
          data: richiesta.data,
          minuti: richiesta.minuti,
          version: 1,
        },
        { client: trx }
      )
      await registraAudit(
        {
          ...audit('ore.registrate'),
          entita: 'registrazioni_ore',
          entitaId: nuova.id,
          prima: null,
          dopo: { ...istantaneaPerAudit(nuova), ...motivo },
        },
        trx
      )
      return { registrazione: nuova, invariata: false }
    }

    if (richiesta.minuti === 0) {
      const prima = istantaneaPerAudit(esistente)
      await esistente.useTransaction(trx).delete()
      await registraAudit(
        {
          ...audit('ore.cancellate'),
          entita: 'registrazioni_ore',
          entitaId: esistente.id,
          prima,
          dopo: correzione ? motivo : null,
        },
        trx
      )
      return { registrazione: null, invariata: false }
    }

    if (esistente.minuti === richiesta.minuti && !correzione) {
      return { registrazione: esistente, invariata: true }
    }

    const aggiornata = await aggiornaConVersione(
      RegistrazioneOre,
      esistente.id,
      richiesta.versione,
      (r) => {
        r.minuti = richiesta.minuti
      },
      { client: trx, audit: audit('ore.modificate') }
    )
    if (correzione) {
      // Il motivo della correzione in una voce a parte (l'audit di aggiornaConVersione non ha campi liberi)
      await registraAudit(
        {
          ...audit('ore.corrette_da_admin'),
          azione: 'ore.correzione_motivo',
          entita: 'registrazioni_ore',
          entitaId: aggiornata.id,
          dopo: { ...motivo, utenteId: richiesta.utenteId, minuti: richiesta.minuti },
        },
        trx
      )
    }
    return { registrazione: aggiornata, invariata: false }
  }

  let esito: { registrazione: RegistrazioneOre | null; invariata: boolean }
  try {
    esito = await db.transaction(esegui)
  } catch (errore) {
    // Due inserimenti contemporanei della stessa cella: il secondo è un conflitto
    if ((errore as { code?: string }).code === '23505') {
      const attuale = await RegistrazioneOre.query()
        .where('utente_id', richiesta.utenteId)
        .where('elaborato_id', richiesta.elaboratoId)
        .where('data', richiesta.data)
        .first()
      throw new ConflittoVersione<RegistrazioneOre>(attuale, richiesta.versione)
    }
    throw errore
  }

  if (!esito.invariata) {
    pubblica(commessaId, 'ore.registrate', {
      elaboratoId: richiesta.elaboratoId,
      data: richiesta.data,
    })
  }
  return { ...esito, commessaId }
}
