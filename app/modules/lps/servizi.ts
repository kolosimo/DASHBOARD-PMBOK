/**
 * Scritture del Last Planner (solo tabelle del modulo LPS).
 *
 * Ogni funzione lavora in una transazione, usa `aggiornaConVersione` per le
 * modifiche (409 se la versione è cambiata) e `registraAudit`. L'evento in
 * tempo reale (`pubblica`) lo manda il controller dopo il commit.
 */
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Vincolo from '#models/vincolo'
import PianoSettimanale from '#models/piano_settimanale'
import Impegno from '#models/impegno'
import { aggiornaConVersione, ConflittoVersione, type RendiFrammento } from '#shared/optimistic'
import { istantaneaPerAudit, registraAudit } from '#shared/audit'
import { eLunedi, oggiRoma } from '#shared/calendario'
import type { CategoriaVincolo, DataIso, Lunedi, TipoAttivitaLookahead } from '#domain/types'
import { AttivitaLps } from './modelli.js'
import { STATI_VINCOLO_APERTI } from './queries.js'

/** Errore di validazione con messaggio per l'utente (422) */
export class ErroreLps extends Error {
  status = 422
}

export interface Autore {
  utenteId: number
  ip?: string | null
}

function controllaSettimana(data: string, nome: string) {
  if (!eLunedi(data)) throw new ErroreLps(`${nome}: scegli il lunedì di una settimana.`)
}

async function controllaElaborato(
  trx: TransactionClientContract,
  commessaId: number,
  elaboratoId: number | null | undefined
) {
  if (!elaboratoId) return
  const e = await trx
    .from('elaborati')
    .where('id', elaboratoId)
    .where('commessa_id', commessaId)
    .first()
  if (!e) throw new ErroreLps('L’elaborato scelto non appartiene a questa commessa.')
}

async function controllaDisciplina(trx: TransactionClientContract, disciplinaId?: number | null) {
  if (!disciplinaId) return
  const d = await trx.from('discipline').where('id', disciplinaId).first()
  if (!d) throw new ErroreLps('Disciplina sconosciuta.')
}

async function controllaPersona(
  trx: TransactionClientContract,
  commessaId: number,
  utenteId: number | null | undefined,
  ruolo: string
) {
  if (!utenteId) return
  const r = await trx
    .from('utenti as u')
    .where('u.id', utenteId)
    .where('u.attivo', true)
    .where((q) => {
      q.whereIn('u.id', trx.from('commesse').where('id', commessaId).select('pm_id')).orWhereIn(
        'u.id',
        trx
          .from('membri_commessa')
          .where('commessa_id', commessaId)
          .whereIn('ruolo_commessa', ['pm', 'progettista', 'verificatore'])
          .select('utente_id')
      )
    })
    .first()
  if (!r) throw new ErroreLps(`${ruolo}: scegli una persona del team della commessa.`)
}

function eDuplicato(errore: unknown): boolean {
  return (
    typeof errore === 'object' && errore !== null && (errore as { code?: string }).code === '23505'
  )
}

// ---------------------------------------------------------------------------
// Attività del lookahead
// ---------------------------------------------------------------------------

export interface DatiAttivita {
  codice: string
  titolo: string
  tipo: TipoAttivitaLookahead
  elaboratoId: number | null
  disciplinaId: number | null
  responsabileId: number | null
  settimanaInizio: Lunedi
  settimanaFine: Lunedi
}

async function controllaAttivita(
  trx: TransactionClientContract,
  commessaId: number,
  dati: DatiAttivita
) {
  controllaSettimana(dati.settimanaInizio, 'Settimana di inizio')
  controllaSettimana(dati.settimanaFine, 'Settimana di fine')
  if (dati.settimanaFine < dati.settimanaInizio) {
    throw new ErroreLps('La settimana di fine non può precedere quella di inizio.')
  }
  await controllaElaborato(trx, commessaId, dati.elaboratoId)
  await controllaDisciplina(trx, dati.disciplinaId)
  await controllaPersona(trx, commessaId, dati.responsabileId, 'Last planner')
}

export async function creaAttivita(commessaId: number, dati: DatiAttivita, autore: Autore) {
  try {
    return await db.transaction(async (trx) => {
      await controllaAttivita(trx, commessaId, dati)
      const a = await AttivitaLps.create({ commessaId, ...dati }, { client: trx })
      await registraAudit(
        {
          utenteId: autore.utenteId,
          azione: 'lps.attivita.creata',
          entita: 'attivita_lookahead',
          entitaId: a.id,
          commessaId,
          dopo: istantaneaPerAudit(a),
          ip: autore.ip,
        },
        trx
      )
      return a
    })
  } catch (errore) {
    if (eDuplicato(errore)) throw new ErroreLps(`Il codice ${dati.codice} è già usato.`)
    throw errore
  }
}

export async function modificaAttivita(
  commessaId: number,
  attivitaId: number,
  versione: number,
  dati: DatiAttivita,
  autore: Autore
) {
  try {
    return await db.transaction(async (trx) => {
      await controllaAttivita(trx, commessaId, dati)
      await attivitaDellaCommessaOErrore(trx, commessaId, attivitaId)
      return aggiornaConVersione(AttivitaLps, attivitaId, versione, dati, {
        client: trx,
        audit: { ...autore, azione: 'lps.attivita.modificata', commessaId },
      })
    })
  } catch (errore) {
    if (eDuplicato(errore)) throw new ErroreLps(`Il codice ${dati.codice} è già usato.`)
    throw errore
  }
}

async function attivitaDellaCommessaOErrore(
  trx: TransactionClientContract,
  commessaId: number,
  attivitaId: number
) {
  const a = await trx
    .from('attivita_lookahead')
    .where('id', attivitaId)
    .where('commessa_id', commessaId)
    .first()
  if (!a) throw new ErroreLps('Attività non trovata in questa commessa.')
  return a
}

export async function eliminaAttivita(
  commessaId: number,
  attivitaId: number,
  versione: number,
  autore: Autore
) {
  await db.transaction(async (trx) => {
    const a = await AttivitaLps.query({ client: trx })
      .where('id', attivitaId)
      .where('commessa_id', commessaId)
      .forUpdate()
      .first()
    if (!a) throw new ConflittoVersione(null, versione)
    if (a.version !== versione) throw new ConflittoVersione(a, versione)
    const prima = istantaneaPerAudit(a)
    await a.useTransaction(trx).delete()
    await registraAudit(
      {
        utenteId: autore.utenteId,
        azione: 'lps.attivita.eliminata',
        entita: 'attivita_lookahead',
        entitaId: attivitaId,
        commessaId,
        prima,
        ip: autore.ip,
      },
      trx
    )
  })
}

// ---------------------------------------------------------------------------
// Vincoli
// ---------------------------------------------------------------------------

export interface DatiVincolo {
  descrizione: string
  categoria: CategoriaVincolo
  stato: 'da_analizzare' | 'aperto'
  responsabileId: number | null
  responsabileEsterno: string | null
  dataNecessaria: DataIso | null
  identificatoIl: DataIso | null
  note: string | null
  attivita: number[]
}

async function collegaAttivita(
  trx: TransactionClientContract,
  commessaId: number,
  vincoloId: number,
  attivita: number[]
) {
  const distinte = [...new Set(attivita)]
  if (distinte.length > 0) {
    const trovate = await trx
      .from('attivita_lookahead')
      .where('commessa_id', commessaId)
      .whereIn('id', distinte)
      .count('* as n')
      .first()
    if (Number(trovate?.n ?? 0) !== distinte.length) {
      throw new ErroreLps('Una delle attività scelte non appartiene a questa commessa.')
    }
  }
  await trx.from('vincoli_attivita').where('vincolo_id', vincoloId).delete()
  if (distinte.length > 0) {
    await trx
      .table('vincoli_attivita')
      .multiInsert(distinte.map((id) => ({ vincolo_id: vincoloId, attivita_id: id })))
  }
}

async function controllaVincolo(
  trx: TransactionClientContract,
  commessaId: number,
  dati: DatiVincolo
) {
  if (!dati.responsabileId && !dati.responsabileEsterno) {
    throw new ErroreLps('Indica chi rimuove il vincolo: una persona del team o un nome esterno.')
  }
  if (dati.responsabileId && dati.responsabileEsterno) {
    throw new ErroreLps('Indica una persona del team oppure un nome esterno, non entrambi.')
  }
  await controllaPersona(trx, commessaId, dati.responsabileId, 'Chi lo rimuove')
}

/** Codice del prossimo vincolo della commessa: V-<numero più alto + 1> */
async function prossimoCodiceVincolo(trx: TransactionClientContract, commessaId: number) {
  const r = await trx.rawQuery(
    `SELECT coalesce(max(substring(codice from 3)::int), 0) AS n
     FROM vincoli WHERE commessa_id = ? AND codice ~ '^V-[0-9]+$'`,
    [commessaId]
  )
  return `V-${Number(r.rows[0]?.n ?? 0) + 1}`
}

export async function creaVincolo(commessaId: number, dati: DatiVincolo, autore: Autore) {
  return db.transaction(async (trx) => {
    await controllaVincolo(trx, commessaId, dati)
    // Serializza i codici della commessa (due inserimenti insieme)
    await trx.rawQuery('SELECT pg_advisory_xact_lock(?, ?)', [4201, commessaId])
    const codice = await prossimoCodiceVincolo(trx, commessaId)
    const { attivita, ...campi } = dati
    const v = await Vincolo.create(
      { ...campi, commessaId, codice, identificatoIl: dati.identificatoIl ?? oggiRoma() },
      { client: trx }
    )
    await collegaAttivita(trx, commessaId, v.id, attivita)
    await registraAudit(
      {
        utenteId: autore.utenteId,
        azione: 'lps.vincolo.creato',
        entita: 'vincoli',
        entitaId: v.id,
        commessaId,
        dopo: { ...istantaneaPerAudit(v), attivita },
        ip: autore.ip,
      },
      trx
    )
    return v
  })
}

async function vincoloDellaCommessa(
  trx: TransactionClientContract,
  commessaId: number,
  vincoloId: number
) {
  const v = await trx
    .from('vincoli')
    .where('id', vincoloId)
    .where('commessa_id', commessaId)
    .first()
  if (!v) throw new ErroreLps('Vincolo non trovato in questa commessa.')
  return v
}

export async function modificaVincolo(
  commessaId: number,
  vincoloId: number,
  versione: number,
  dati: DatiVincolo,
  autore: Autore
) {
  return db.transaction(async (trx) => {
    await vincoloDellaCommessa(trx, commessaId, vincoloId)
    await controllaVincolo(trx, commessaId, dati)
    const { attivita, identificatoIl, ...campi } = dati
    const v = await aggiornaConVersione(
      Vincolo,
      vincoloId,
      versione,
      (riga) => {
        // Lo stato si cambia qui solo tra "da analizzare" e "aperto"
        const statoModificabile = STATI_VINCOLO_APERTI.includes(riga.stato)
        riga.merge({
          ...campi,
          stato: statoModificabile ? campi.stato : riga.stato,
          identificatoIl: identificatoIl ?? riga.identificatoIl,
        })
      },
      { client: trx, audit: { ...autore, azione: 'lps.vincolo.modificato', commessaId } }
    )
    await collegaAttivita(trx, commessaId, vincoloId, attivita)
    return v
  })
}

export type AzioneVincolo = 'rimuovi' | 'riapri' | 'annulla'

/** Rimuovi, riapri o annulla un vincolo */
export async function cambiaStatoVincolo(
  commessaId: number,
  vincoloId: number,
  versione: number,
  azione: AzioneVincolo,
  autore: Autore,
  rendiFrammento?: RendiFrammento<Vincolo>
) {
  return db.transaction(async (trx) => {
    await vincoloDellaCommessa(trx, commessaId, vincoloId)
    return aggiornaConVersione(
      Vincolo,
      vincoloId,
      versione,
      (v) => {
        const aperto = STATI_VINCOLO_APERTI.includes(v.stato)
        if (azione === 'rimuovi') {
          if (!aperto) throw new ErroreLps(`Il vincolo ${v.codice} non è aperto.`)
          v.stato = 'rimosso'
          v.rimossoIl = DateTime.now()
          v.annullatoIl = null
        } else if (azione === 'annulla') {
          if (!aperto) throw new ErroreLps(`Il vincolo ${v.codice} non è aperto.`)
          v.stato = 'annullato'
          v.annullatoIl = DateTime.now()
          v.rimossoIl = null
        } else {
          if (aperto) throw new ErroreLps(`Il vincolo ${v.codice} è già aperto.`)
          v.stato = 'aperto'
          v.rimossoIl = null
          v.annullatoIl = null
        }
      },
      {
        client: trx,
        audit: { ...autore, azione: `lps.vincolo.${azione}`, commessaId },
        rendiFrammento,
      }
    )
  })
}

// ---------------------------------------------------------------------------
// Piano settimanale e impegni
// ---------------------------------------------------------------------------

async function pianoDellaCommessa(
  trx: TransactionClientContract,
  commessaId: number,
  pianoId: number
) {
  const p = await PianoSettimanale.query({ client: trx })
    .where('id', pianoId)
    .where('commessa_id', commessaId)
    .first()
  if (!p) throw new ErroreLps('Piano non trovato in questa commessa.')
  return p
}

/** Crea il piano (bozza) della settimana; se esiste già lo restituisce */
export async function creaPiano(commessaId: number, settimana: Lunedi, autore: Autore) {
  controllaSettimana(settimana, 'Settimana')
  return db.transaction(async (trx) => {
    const esistente = await PianoSettimanale.query({ client: trx })
      .where('commessa_id', commessaId)
      .where('settimana', settimana)
      .first()
    if (esistente) return esistente
    const p = await PianoSettimanale.create(
      { commessaId, settimana, stato: 'bozza' },
      { client: trx }
    )
    await registraAudit(
      {
        utenteId: autore.utenteId,
        azione: 'lps.piano.creato',
        entita: 'piani_settimanali',
        entitaId: p.id,
        commessaId,
        dopo: istantaneaPerAudit(p),
        ip: autore.ip,
      },
      trx
    )
    return p
  })
}

export interface DatiImpegno {
  descrizione: string | null
  attivitaId: number | null
  elaboratoId: number | null
  lastPlannerId: number | null
}

/**
 * Aggiunge un impegno. Se il piano è già promesso l'impegno è marcato
 * "aggiunto dopo la promessa" (escluso dal PPC). Restituisce anche i vincoli
 * aperti dell'attività collegata, per l'avviso.
 */
export async function aggiungiImpegno(
  commessaId: number,
  pianoId: number,
  dati: DatiImpegno,
  autore: Autore
) {
  return db.transaction(async (trx) => {
    const piano = await pianoDellaCommessa(trx, commessaId, pianoId)
    if (piano.stato === 'chiuso')
      throw new ErroreLps('Il piano è chiuso: non si aggiungono impegni.')

    let { descrizione, elaboratoId, lastPlannerId } = dati
    let vincoliAperti: string[] = []
    if (dati.attivitaId) {
      const a = await attivitaDellaCommessaOErrore(trx, commessaId, dati.attivitaId)
      elaboratoId = elaboratoId ?? a.elaborato_id
      lastPlannerId = lastPlannerId ?? a.responsabile_id
      descrizione = descrizione || a.titolo
      const aperti = await trx
        .from('vincoli_attivita as va')
        .join('vincoli as v', 'v.id', 'va.vincolo_id')
        .where('va.attivita_id', dati.attivitaId)
        .whereIn('v.stato', STATI_VINCOLO_APERTI as string[])
        .orderBy('v.codice')
        .select('v.codice')
      vincoliAperti = aperti.map((r) => r.codice as string)
    }
    if (!descrizione) throw new ErroreLps('Scrivi l’impegno o scegli un’attività del lookahead.')
    if (!lastPlannerId) throw new ErroreLps('Scegli il last planner che prende l’impegno.')
    await controllaElaborato(trx, commessaId, elaboratoId)
    await controllaPersona(trx, commessaId, lastPlannerId, 'Last planner')

    const massimo = await trx.from('impegni').where('piano_id', pianoId).max('ordine as m').first()
    const impegno = await Impegno.create(
      {
        pianoId,
        attivitaId: dati.attivitaId,
        elaboratoId,
        descrizione,
        lastPlannerId,
        fatto: null,
        causaId: null,
        cinquePerche: null,
        aggiuntoDopoPromessa: piano.stato === 'promesso',
        ordine: Number(massimo?.m ?? 0) + 1,
      },
      { client: trx }
    )
    await registraAudit(
      {
        utenteId: autore.utenteId,
        azione: 'lps.impegno.aggiunto',
        entita: 'impegni',
        entitaId: impegno.id,
        commessaId,
        dopo: istantaneaPerAudit(impegno),
        ip: autore.ip,
      },
      trx
    )
    return { impegno, vincoliAperti }
  })
}

/** Impegno con il suo piano, verificando che sia della commessa */
export async function impegnoConPiano(commessaId: number, impegnoId: number) {
  const impegno = await Impegno.find(impegnoId)
  if (!impegno) return null
  const piano = await PianoSettimanale.query()
    .where('id', impegno.pianoId)
    .where('commessa_id', commessaId)
    .first()
  if (!piano) return null
  return { impegno, piano }
}

/** Elimina un impegno: solo mentre il piano è in bozza */
export async function eliminaImpegno(
  commessaId: number,
  impegnoId: number,
  versione: number,
  autore: Autore
) {
  await db.transaction(async (trx) => {
    const impegno = await Impegno.query({ client: trx }).where('id', impegnoId).forUpdate().first()
    if (!impegno) throw new ConflittoVersione(null, versione)
    const piano = await pianoDellaCommessa(trx, commessaId, impegno.pianoId)
    if (piano.stato !== 'bozza') {
      throw new ErroreLps('Si eliminano impegni solo mentre il piano è in bozza.')
    }
    if (impegno.version !== versione) throw new ConflittoVersione(impegno, versione)
    const prima = istantaneaPerAudit(impegno)
    await impegno.useTransaction(trx).delete()
    await registraAudit(
      {
        utenteId: autore.utenteId,
        azione: 'lps.impegno.eliminato',
        entita: 'impegni',
        entitaId: impegnoId,
        commessaId,
        prima,
        ip: autore.ip,
      },
      trx
    )
  })
}

export interface DatiEsito {
  fatto: boolean | null
  causaId: number | null
  cinquePerche: string[] | null
}

/** Segna fatto sì/no, la causa e il 5 perché di un impegno (piano promesso) */
export async function segnaEsito(
  commessaId: number,
  impegnoId: number,
  versione: number,
  dati: DatiEsito,
  autore: Autore,
  rendiFrammento?: RendiFrammento<Impegno>
) {
  return db.transaction(async (trx) => {
    const impegno = await Impegno.query({ client: trx }).where('id', impegnoId).first()
    if (!impegno) throw new ConflittoVersione(null, versione)
    const piano = await pianoDellaCommessa(trx, commessaId, impegno.pianoId)
    if (piano.stato === 'bozza') {
      throw new ErroreLps('Il piano non è ancora promesso: l’esito si segna dopo la promessa.')
    }
    if (piano.stato === 'chiuso')
      throw new ErroreLps('Il piano è chiuso: l’esito non si cambia più.')
    if (dati.fatto === false && dati.causaId) {
      const causa = await trx
        .from('cause_non_completamento')
        .where('id', dati.causaId)
        .where('attiva', true)
        .first()
      if (!causa) throw new ErroreLps('Causa di non completamento sconosciuta.')
    }
    const perche = (dati.cinquePerche ?? []).map((p) => p.trim()).filter((p) => p !== '')
    return aggiornaConVersione(
      Impegno,
      impegnoId,
      versione,
      {
        fatto: dati.fatto,
        causaId: dati.fatto === false ? dati.causaId : null,
        cinquePerche: dati.fatto === false && perche.length > 0 ? perche : null,
      },
      {
        client: trx,
        audit: { ...autore, azione: 'lps.impegno.esito', commessaId },
        rendiFrammento,
      }
    )
  })
}

/** Bozza → promesso. Restituisce i codici delle attività vincolate promesse (avviso). */
export async function promettiPiano(
  commessaId: number,
  pianoId: number,
  versione: number,
  autore: Autore
) {
  return db.transaction(async (trx) => {
    const piano = await pianoDellaCommessa(trx, commessaId, pianoId)
    if (piano.stato !== 'bozza') throw new ErroreLps('Il piano è già stato promesso.')
    const impegni = await trx.from('impegni').where('piano_id', pianoId).select('id', 'attivita_id')
    if (impegni.length === 0) throw new ErroreLps('Aggiungi almeno un impegno prima di promettere.')
    const vincolate = await trx
      .from('impegni as i')
      .join('attivita_lookahead as a', 'a.id', 'i.attivita_id')
      .where('i.piano_id', pianoId)
      .whereExists((q) => {
        q.from('vincoli_attivita as va')
          .join('vincoli as v', 'v.id', 'va.vincolo_id')
          .whereRaw('va.attivita_id = i.attivita_id')
          .whereIn('v.stato', STATI_VINCOLO_APERTI as string[])
      })
      .distinct('a.codice')
      .orderBy('a.codice')
    const p = await aggiornaConVersione(
      PianoSettimanale,
      pianoId,
      versione,
      { stato: 'promesso', promessoIl: DateTime.now() },
      { client: trx, audit: { ...autore, azione: 'lps.piano.promesso', commessaId } }
    )
    return { piano: p, attivitaVincolate: vincolate.map((r) => r.codice as string) }
  })
}

/**
 * Promesso → chiuso. Ogni impegno deve essere segnato sì o no e ogni "no"
 * deve avere la causa; altrimenti errore con l'elenco delle righe mancanti.
 */
export async function chiudiPiano(
  commessaId: number,
  pianoId: number,
  versione: number,
  autore: Autore
) {
  return db.transaction(async (trx) => {
    const piano = await pianoDellaCommessa(trx, commessaId, pianoId)
    if (piano.stato !== 'promesso') {
      throw new ErroreLps(
        piano.stato === 'bozza'
          ? 'Prima di chiudere il piano va promesso.'
          : 'Il piano è già chiuso.'
      )
    }
    const impegni = await trx
      .from('impegni')
      .where('piano_id', pianoId)
      .orderBy('ordine')
      .select('descrizione', 'fatto', 'causa_id')
    const nonSegnati = impegni.filter((i) => i.fatto === null)
    const senzaCausa = impegni.filter((i) => i.fatto === false && i.causa_id === null)
    if (nonSegnati.length > 0 || senzaCausa.length > 0) {
      const parti: string[] = []
      if (nonSegnati.length > 0) {
        parti.push(`segna sì o no su: ${nonSegnati.map((i) => `"${i.descrizione}"`).join(', ')}`)
      }
      if (senzaCausa.length > 0) {
        parti.push(`scegli la causa per: ${senzaCausa.map((i) => `"${i.descrizione}"`).join(', ')}`)
      }
      throw new ErroreLps(`Per chiudere il piano ${parti.join('; ')}.`)
    }
    return aggiornaConVersione(
      PianoSettimanale,
      pianoId,
      versione,
      { stato: 'chiuso', chiusoIl: DateTime.now() },
      { client: trx, audit: { ...autore, azione: 'lps.piano.chiuso', commessaId } }
    )
  })
}
