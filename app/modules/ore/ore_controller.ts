import type { HttpContext } from '@adonisjs/core/http'
import Utente from '#models/utente'
import { admin, registraOre, vedeOrePerPersona } from '#abilities/main'
import { commessaCorrente } from '#shared/commessa_corrente'
import { ConflittoVersione } from '#shared/optimistic'
import { leggiImpostazione } from '#shared/impostazioni'
import db from '@adonisjs/lucid/services/db'
import {
  aggiungiSettimane,
  differenzaGiorni,
  domenicaDi,
  eLunedi,
  lunediDellaSettimana,
  oggiRoma,
} from '#shared/calendario'
import type { DataIso, Lunedi, Minuti } from '#domain/types'
import * as formato from '#ui/formato'
import {
  minutiElaborato,
  minutiGiornoUtente,
  minutiPeriodoUtente,
  oreCommessa,
  orePerPersona,
  righeTimesheet,
  type RigaTimesheet,
} from './queries.js'
import {
  minutiDaTesto,
  OreNonConsentite,
  OreNonValide,
  salvaCella,
  statoSettimana,
} from './registrazione_service.js'
import RegistrazioneOre from '#models/registrazione_ore'

const NOMI_GIORNI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']

/** Settimana richiesta in query string (?settimana=YYYY-MM-DD), altrimenti quella di oggi */
function settimanaRichiesta(valore: unknown): Lunedi {
  if (typeof valore === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valore)) {
    try {
      return eLunedi(valore) ? valore : lunediDellaSettimana(valore)
    } catch {
      // data non valida: si usa la settimana corrente
    }
  }
  return lunediDellaSettimana(oggiRoma())
}

/** 7 date da lunedì a domenica */
function giorniSettimana(lunedi: Lunedi): DataIso[] {
  const base = new Date(`${lunedi}T12:00:00Z`)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

/** Minuti in ore decimali per il campo della cella: 90 → "1,5", 0 → "" */
function oreCella(minuti: Minuti): string {
  if (!minuti) return ''
  const h = minuti / 60
  const decimali = Number.isInteger(h) ? 0 : Number.isInteger(h * 10) ? 1 : 2
  return formato.numero(h, decimali)
}

function intestazioniGiorni(giorni: DataIso[]) {
  return giorni.map((data, i) => ({
    data,
    nome: NOMI_GIORNI[i],
    etichetta: `${NOMI_GIORNI[i]} ${formato.dataBreve(data)}`,
    weekend: i >= 5,
  }))
}

interface Timesheet {
  settimana: Lunedi
  precedente: Lunedi
  successiva: Lunedi | null
  giorni: ReturnType<typeof intestazioniGiorni>
  righeProprie: RigaTimesheet[]
  righeAltre: RigaTimesheet[]
  totaliGiorno: Minuti[]
  totaleSettimana: Minuti
  massimoGiorno: Minuti
  chiusa: boolean
  modificabileFinoAl: DataIso
  oggi: DataIso
  mostraWeekend: boolean
  mostraAltre: boolean
}

async function costruisciTimesheet(utenteId: number, settimana: Lunedi): Promise<Timesheet> {
  const giorni = giorniSettimana(settimana)
  // Query in sequenza: nei test girano tutte sulla stessa connessione (transazione globale)
  const righe = await righeTimesheet(utenteId, giorni)
  const massimoGiorno = await leggiImpostazione('ore.minuti_massimi_giorno')
  const giorniConsentiti = await leggiImpostazione('ore.giorni_modifica_consentita')
  const oggi = oggiRoma()
  const stato = statoSettimana(settimana, giorniConsentiti, oggi)
  const totaliGiorno = giorni.map((_, i) => righe.reduce((a, r) => a + r.celle[i].minuti, 0))
  const corrente = lunediDellaSettimana(oggi)
  const righeAltre = righe.filter((r) => !r.responsabile)
  return {
    settimana,
    precedente: aggiungiSettimane(settimana, -1),
    successiva: settimana < corrente ? aggiungiSettimane(settimana, 1) : null,
    giorni: intestazioniGiorni(giorni),
    righeProprie: righe.filter((r) => r.responsabile),
    righeAltre,
    totaliGiorno,
    totaleSettimana: totaliGiorno.reduce((a, b) => a + b, 0),
    massimoGiorno,
    chiusa: stato.chiusa,
    modificabileFinoAl: stato.modificabileFinoAl,
    oggi,
    mostraWeekend: totaliGiorno[5] + totaliGiorno[6] > 0,
    mostraAltre:
      righeAltre.some((r) => r.minutiSettimana > 0) || righe.every((r) => !r.responsabile),
  }
}

/** Dati della cella da inviare al template dopo il salvataggio */
interface CampiCella {
  elaboratoId: number
  data: DataIso
  testo: string
  versione: number
}

function leggiCampi(request: HttpContext['request']) {
  const elaboratoId = Number(request.input('elaborato_id'))
  const data = String(request.input('data') ?? '')
  const versione = Number(request.input('version') ?? 0)
  const testo = String(request.input('ore') ?? '')
  return { elaboratoId, data, versione, testo }
}

/**
 * 403 esplicito per i POST: l'eccezione di Bouncer, per i form HTML,
 * farebbe un redirect "back" (302), inutile per HTMX.
 */
function vietato({ response }: HttpContext, messaggio: string) {
  return response.status(403).send(messaggio)
}

/** Ore (sempre e solo per sé) */
export default class OreController {
  /** Timesheet personale: ognuno vede e registra solo le proprie ore */
  async mie({ view, auth, request }: HttpContext) {
    const utente = auth.getUserOrFail()
    const ts = await costruisciTimesheet(utente.id, settimanaRichiesta(request.qs().settimana))
    return view.render('modules/ore/mie', {
      voceAttiva: 'ore',
      ts,
      oreCella,
      urlCella: '/ore/celle',
      urlSettimana: (s: string) => `/ore?settimana=${s}`,
      correzione: null,
    })
  }

  /** Salvataggio di una cella del proprio timesheet (HTMX, una cella alla volta) */
  async salvaCella(ctx: HttpContext) {
    const { request, auth, bouncer } = ctx
    const utente = auth.getUserOrFail()
    // Si registra solo per sé: un utente_id diverso è un 403, anche per l'admin
    const proprietario = request.input('utente_id')
    const proprietarioId =
      proprietario === undefined || proprietario === null || proprietario === ''
        ? utente.id
        : Number(proprietario)
    if (!Number.isInteger(proprietarioId) || (await bouncer.denies(registraOre, proprietarioId))) {
      return vietato(ctx, 'Puoi registrare solo le tue ore.')
    }
    return this.eseguiSalvataggio(ctx, proprietarioId, utente.id, undefined)
  }

  /** Correzione dell'admin: timesheet di un'altra persona, con motivo obbligatorio */
  async correzione({ view, bouncer, request }: HttpContext) {
    await bouncer.authorize(admin)
    const utenti = await Utente.query().where('attivo', true).orderBy('nome', 'asc')
    const scelto = Number(request.qs().utente)
    const persona = utenti.find((u) => u.id === scelto) ?? null
    const settimana = settimanaRichiesta(request.qs().settimana)
    const ts = persona ? await costruisciTimesheet(persona.id, settimana) : null
    return view.render('modules/ore/correzione', {
      voceAttiva: 'admin',
      utenti,
      persona,
      settimana,
      ts,
      oreCella,
      urlCella: '/ore/correzione/celle',
      urlSettimana: (s: string) => `/ore/correzione?utente=${persona?.id ?? ''}&settimana=${s}`,
      correzione: persona ? { utenteId: persona.id } : null,
    })
  }

  async salvaCorrezione(ctx: HttpContext) {
    const { request, auth, bouncer } = ctx
    if (await bouncer.denies(admin)) {
      return vietato(ctx, 'Solo l’amministratore può correggere le ore di un’altra persona.')
    }
    const utente = auth.getUserOrFail()
    const proprietarioId = Number(request.input('utente_id'))
    const persona = await Utente.find(proprietarioId)
    if (!persona) return ctx.response.notFound('Persona non trovata')
    const motivo = String(request.input('motivo') ?? '').trim()
    return this.eseguiSalvataggio(ctx, proprietarioId, utente.id, motivo)
  }

  private async eseguiSalvataggio(
    ctx: HttpContext,
    proprietarioId: number,
    autoreId: number,
    motivo: string | undefined
  ) {
    const { request, response, view } = ctx
    const campi = leggiCampi(request)
    const htmx = request.header('hx-request') === 'true'
    const settimana = /^\d{4}-\d{2}-\d{2}$/.test(campi.data)
      ? settimanaRichiesta(campi.data)
      : settimanaRichiesta(undefined)
    const correzione = motivo !== undefined ? { utenteId: proprietarioId } : null
    const urlCella = correzione ? '/ore/correzione/celle' : '/ore/celle'
    const base = { oreCella, urlCella, correzione }

    const rispondi = async (stato: number, dati: Record<string, unknown>) => {
      if (!htmx) {
        if (stato >= 400) {
          response.status(stato)
          return String(dati.errore ?? dati.conflitto ?? 'Operazione non riuscita')
        }
        const dove = correzione
          ? `/ore/correzione?utente=${proprietarioId}&settimana=${settimana}`
          : `/ore?settimana=${settimana}`
        return response.redirect(dove)
      }
      response.status(stato)
      return view.render('modules/ore/_esito_cella', { ...base, ...dati })
    }

    const cellaOriginale = (registrazione: RegistrazioneOre | null): CampiCella => ({
      elaboratoId: campi.elaboratoId,
      data: campi.data,
      testo: oreCella(registrazione?.minuti ?? 0),
      versione: registrazione?.version ?? 0,
    })

    if (!Number.isInteger(campi.elaboratoId) || campi.elaboratoId <= 0) {
      return rispondi(422, { errore: 'Elaborato non valido.' })
    }
    const minuti = minutiDaTesto(campi.testo)
    if (minuti === null) {
      return rispondi(422, {
        errore: `“${campi.testo}” non è un numero di ore valido: scrivi per esempio 1,5 o 1:30.`,
        cella: await this.cellaAttuale(proprietarioId, campi.elaboratoId, campi.data),
      })
    }

    try {
      await salvaCella({
        utenteId: proprietarioId,
        elaboratoId: campi.elaboratoId,
        data: campi.data,
        minuti,
        versione: Number.isInteger(campi.versione) ? campi.versione : -1,
        autoreId,
        motivoCorrezione: motivo,
        ip: request.ip(),
      })
    } catch (errore) {
      if (errore instanceof OreNonValide) {
        return rispondi(422, {
          errore: errore.message,
          cella: await this.cellaAttuale(proprietarioId, campi.elaboratoId, campi.data),
        })
      }
      if (errore instanceof OreNonConsentite) {
        return rispondi(403, { errore: errore.message })
      }
      if (errore instanceof ConflittoVersione) {
        return rispondi(409, {
          conflitto: errore.message,
          cella: cellaOriginale(errore.attuale as RegistrazioneOre | null),
          ...(await this.totali(proprietarioId, campi.elaboratoId, campi.data)),
        })
      }
      throw errore
    }

    const cella = await this.cellaAttuale(proprietarioId, campi.elaboratoId, campi.data)
    const totali = await this.totali(proprietarioId, campi.elaboratoId, campi.data)
    const massimo = await leggiImpostazione('ore.minuti_massimi_giorno')
    const avviso =
      totali.minutiGiorno > massimo
        ? `Attenzione: ${formato.dataEstesa(campi.data)} risultano ${formato.oreEsatte(totali.minutiGiorno)}, oltre il massimo di ${formato.oreEsatte(massimo)} al giorno. Le ore sono salvate: controlla che siano giuste.`
        : null
    if (htmx) response.header('HX-Trigger', JSON.stringify({ toast: 'Ore salvate' }))
    return rispondi(200, { cella, ...totali, massimo, avviso, salvata: true })
  }

  /** Stato attuale della cella (valore e versione) dal DB */
  private async cellaAttuale(utenteId: number, elaboratoId: number, data: DataIso) {
    const r = /^\d{4}-\d{2}-\d{2}$/.test(data)
      ? await RegistrazioneOre.query()
          .where('utente_id', utenteId)
          .where('elaborato_id', elaboratoId)
          .where('data', data)
          .first()
      : null
    return {
      elaboratoId,
      data,
      testo: oreCella(r?.minuti ?? 0),
      versione: r?.version ?? 0,
    } satisfies CampiCella
  }

  /** Totali da aggiornare nella pagina dopo il salvataggio di una cella */
  private async totali(utenteId: number, elaboratoId: number, data: DataIso) {
    const lunedi = lunediDellaSettimana(data)
    const domenica = domenicaDi(lunedi)
    const minutiGiorno = await minutiGiornoUtente(utenteId, data)
    const minutiRiga = await minutiPeriodoUtente(utenteId, lunedi, domenica, elaboratoId)
    const minutiSettimana = await minutiPeriodoUtente(utenteId, lunedi, domenica)
    const minutiElab = await minutiElaborato(elaboratoId)
    const elaborato = await db
      .from('elaborati')
      .where('id', elaboratoId)
      .select('budget_minuti')
      .first()
    return {
      giornoWeekend: differenzaGiorni(lunedi, data) >= 5,
      budgetMinuti: elaborato ? Number(elaborato.budget_minuti) : null,
      minutiGiorno,
      minutiRiga,
      minutiSettimana,
      minutiElaborato: minutiElab,
      massimo: await leggiImpostazione('ore.minuti_massimi_giorno'),
    }
  }

  /** Ore aggregate della commessa (vista PM): per elaborato e, se consentito, per persona */
  async commessa(ctx: HttpContext) {
    const commessa = await commessaCorrente(ctx, 'ore')
    const settimana = settimanaRichiesta(ctx.request.qs().settimana)
    const perPersonaConsentito = await ctx.bouncer.allows(vedeOrePerPersona, commessa)
    const ore = await oreCommessa(commessa.id, settimana)
    const persone = perPersonaConsentito ? await orePerPersona(commessa.id, settimana) : null
    const attivaImpostazione = await leggiImpostazione('ore.per_persona_visibili')
    const corrente = lunediDellaSettimana(oggiRoma())
    const budgetTotale = ore.perElaborato.reduce((a, r) => a + r.budgetMinuti, 0)
    return ctx.view.render('modules/ore/commessa', {
      ore,
      persone,
      attivaImpostazione,
      budgetTotale,
      settimana,
      precedente: aggiungiSettimane(settimana, -1),
      successiva: settimana < corrente ? aggiungiSettimane(settimana, 1) : null,
      domenica: domenicaDi(settimana),
    })
  }
}
