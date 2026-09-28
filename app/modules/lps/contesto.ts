/**
 * Utilità comuni ai controller del Last Planner.
 */
import type { HttpContext } from '@adonisjs/core/http'
import { errors as erroriVine } from '@vinejs/vine'
import type Commessa from '#models/commessa'
import { gestisceLps } from '#abilities/main'
import { eLunedi, lunediDellaSettimana, oggiRoma } from '#shared/calendario'
import type { Lunedi } from '#domain/types'
import { ErroreLps, type Autore } from './servizi.js'

export function autore(ctx: HttpContext): Autore {
  return { utenteId: ctx.auth.getUserOrFail().id, ip: ctx.request.ip() }
}

export function eHtmx(ctx: HttpContext) {
  return ctx.request.header('hx-request') === 'true'
}

/** Settimana dalla query string (lunedì valido), altrimenti quella corrente */
export function settimanaRichiesta(ctx: HttpContext, nome = 'settimana'): Lunedi {
  const valore = ctx.request.qs()[nome]
  if (typeof valore === 'string' && eLunedi(valore)) return valore
  return lunediDellaSettimana(oggiRoma())
}

export async function puoGestire(ctx: HttpContext, commessa: Commessa) {
  return ctx.bouncer.allows(gestisceLps, commessa)
}

/**
 * Autorizza la gestione del LPS: 403 esplicito anche per i form e le richieste
 * HTMX (Bouncer, sui POST, rimanderebbe indietro con un redirect).
 */
export async function richiediGestione(ctx: HttpContext, commessa: Commessa) {
  if (!(await ctx.bouncer.allows(gestisceLps, commessa))) {
    ctx.response.abort('Non hai i permessi per gestire il Last Planner di questa commessa.', 403)
  }
}

/**
 * Valore dell'intestazione HX-Trigger: JSON con i caratteri non ASCII come
 * sequenze \uXXXX (le intestazioni HTTP accettano solo ASCII).
 */
export function intestazioneTrigger(eventi: Record<string, unknown>): string {
  return JSON.stringify(eventi).replace(
    /[^\x20-\x7e]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

const NOMI_CAMPI: Record<string, string> = {
  codice: 'codice',
  titolo: 'titolo',
  tipo: 'tipo',
  descrizione: 'descrizione',
  categoria: 'categoria',
  stato: 'stato',
  settimana_inizio: 'settimana di inizio',
  settimana_fine: 'settimana di fine',
  data_necessaria: 'serve entro',
  identificato_il: 'identificato il',
  responsabile_esterno: 'responsabile esterno',
  version: 'versione',
  fatto: 'fatto',
  causa_id: 'causa',
}

/**
 * Valida il corpo della richiesta. Gli errori diventano un ErroreLps con un
 * messaggio in italiano (i messaggi di VineJS sono in inglese).
 */
export async function valida<T>(
  ctx: HttpContext,
  validatore: { validate: (dati: unknown) => Promise<T> }
): Promise<T> {
  try {
    return await validatore.validate(ctx.request.all())
  } catch (errore) {
    if (errore instanceof erroriVine.E_VALIDATION_ERROR) {
      const campi = [
        ...new Set(
          (errore.messages as { field: string }[]).map((m) => {
            const base = m.field.split('.')[0]
            return NOMI_CAMPI[base] ?? base
          })
        ),
      ]
      throw new ErroreLps(`Controlla i campi: ${campi.join(', ')}.`)
    }
    throw errore
  }
}

/** Messaggio da mostrare nella pagina dopo un redirect */
export interface Messaggio {
  tipo: 'ok' | 'errore' | 'avviso'
  testo: string
}

export function flashMessaggio(ctx: HttpContext, messaggio: Messaggio) {
  ctx.session.flash('lps', messaggio)
}

export function messaggioFlash(ctx: HttpContext): Messaggio | null {
  return (ctx.session.flashMessages.get('lps') as Messaggio | undefined) ?? null
}
