/**
 * Pagina anagrafica di commessa: caricamento dei dati dei pannelli e risposte
 * (frammento per HTMX, pagina intera o redirezione senza JavaScript).
 */
import type { HttpContext } from '@adonisjs/core/http'
import Commessa from '#models/commessa'
import { modificaCommessa, vedeCommessa } from '#abilities/main'
import { commessaCorrente } from '#shared/commessa_corrente'
import { RUOLI_COMMESSA, STATI_COMMESSA } from '#domain/types'
import {
  elencoElaborati,
  elencoMembri,
  elencoMilestone,
  limitiWipCommessa,
  utentiAttivi,
} from './queries.js'
import type { Errori } from './validazione.js'

/** Oltre questo numero di membri il team si mostra con un avviso (Last Planner) */
export const MEMBRI_CONSIGLIATI = 10

export type NomePannello = 'dati' | 'team' | 'milestone' | 'wip'

/** Stato di un pannello dopo un invio: errori, valori reinseriti, conflitto */
export interface StatoPannello {
  errori?: Errori
  /** Id della riga a cui si riferiscono errori e valori (null = riga nuova) */
  rigaId?: number | null
  valori?: Record<string, unknown>
  conflitto?: string
  messaggio?: string
}

const PARZIALI: Record<NomePannello, string> = {
  dati: 'modules/anagrafiche/_dati',
  team: 'modules/anagrafiche/_team',
  milestone: 'modules/anagrafiche/_milestone',
  wip: 'modules/anagrafiche/_wip',
}

/** Commessa visibile all'utente (403/404) */
export async function commessaVisibile(ctx: HttpContext) {
  return commessaCorrente(ctx, 'anagrafica')
}

export const NEGATO = 'Non hai i permessi per modificare questa commessa.'

/**
 * Commessa che l'utente può modificare: 404 se non esiste, 403 se non la vede o
 * se non è admin o PM della commessa.
 *
 * Non si usa `bouncer.authorize` perché sulle richieste POST l'eccezione di
 * Bouncer risponde con una redirezione (302) invece che con 403.
 */
export async function commessaModificabile(ctx: HttpContext) {
  const id = Number(ctx.params.id)
  const commessa = Number.isInteger(id) && id > 0 ? await Commessa.find(id) : null
  if (!commessa) return ctx.response.abort('Commessa non trovata', 404)
  if (!(await ctx.bouncer.allows(vedeCommessa, commessa))) {
    return ctx.response.abort(NEGATO, 403)
  }
  if (!(await ctx.bouncer.allows(modificaCommessa, commessa))) {
    return ctx.response.abort(NEGATO, 403)
  }
  ctx.view.share({ commessa, schedaAttiva: 'anagrafica' })
  return commessa
}

/** Dati di un pannello per il template */
async function datiPannello(nome: NomePannello, commessa: Commessa) {
  switch (nome) {
    case 'dati':
      return { utenti: await utentiAttivi(), statiCommessa: STATI_COMMESSA }
    case 'team': {
      const membri = await elencoMembri(commessa.id)
      const presenti = new Set(membri.map((m) => m.utenteId))
      const utenti = (await utentiAttivi()).filter((u) => !presenti.has(u.id))
      return {
        membri,
        utentiDisponibili: utenti,
        ruoli: RUOLI_COMMESSA,
        troppi: membri.length > MEMBRI_CONSIGLIATI,
        consigliati: MEMBRI_CONSIGLIATI,
      }
    }
    case 'milestone':
      return { elenco: await elencoMilestone(commessa.id) }
    case 'wip':
      return { limiti: await limitiWipCommessa(commessa.id) }
  }
}

/** Rende un pannello (frammento HTML) */
export async function rendiPannello(
  ctx: HttpContext,
  nome: NomePannello,
  commessa: Commessa,
  stato: StatoPannello = {}
) {
  const puoModificare = await ctx.bouncer.allows(modificaCommessa, commessa)
  const dati = await datiPannello(nome, commessa)
  return ctx.view.render(PARZIALI[nome], {
    commessa,
    puoModificare,
    p: { ...dati, ...stato, errori: stato.errori ?? {}, valori: stato.valori ?? {} },
  })
}

/** Pagina intera, con eventualmente lo stato di un pannello (errori senza HTMX) */
export async function rendiPagina(
  ctx: HttpContext,
  commessa: Commessa,
  pannello?: NomePannello,
  stato: StatoPannello = {}
) {
  const puoModificare = await ctx.bouncer.allows(modificaCommessa, commessa)
  const pannelli: Record<string, unknown> = {}
  for (const nome of Object.keys(PARZIALI) as NomePannello[]) {
    const s = nome === pannello ? stato : {}
    pannelli[nome] = {
      ...(await datiPannello(nome, commessa)),
      ...s,
      errori: s.errori ?? {},
      valori: s.valori ?? {},
    }
  }
  const elaborati = await elencoElaborati(commessa.id)
  const budgetTotale = elaborati.reduce((t, e) => t + e.budgetMinuti, 0)
  return ctx.view.render('modules/anagrafiche/show', {
    puoModificare,
    pannelli,
    elaborati,
    budgetTotale,
    messaggio: ctx.session?.flashMessages.get('messaggio') ?? null,
  })
}

/** true se la richiesta arriva da HTMX */
export function daHtmx(ctx: HttpContext) {
  return ctx.request.header('hx-request') === 'true'
}

/**
 * Risposta dopo una modifica a un pannello:
 * - HTMX: il pannello aggiornato (con toast se riuscita);
 * - senza HTMX: redirezione alla pagina (riuscita) o pagina intera con gli errori (422).
 */
export async function rispondiPannello(
  ctx: HttpContext,
  nome: NomePannello,
  commessa: Commessa,
  stato: StatoPannello = {},
  status = 200
) {
  if (daHtmx(ctx)) {
    ctx.response.status(status)
    if (status === 200 && stato.messaggio) {
      ctx.response.header('HX-Trigger', JSON.stringify({ toast: stato.messaggio }))
    }
    return rendiPannello(ctx, nome, commessa, stato)
  }
  if (status === 200) {
    if (stato.messaggio) ctx.session.flash('messaggio', stato.messaggio)
    return ctx.response.redirect(`/commesse/${commessa.id}/anagrafica#pannello-${nome}`)
  }
  ctx.response.status(status)
  return rendiPagina(ctx, commessa, nome, stato)
}

/** Frammento per il 409: pannello aggiornato con il messaggio di conflitto sopra */
export function frammentoConflitto(ctx: HttpContext, nome: NomePannello, commessa: Commessa) {
  return (_attuale: unknown, messaggio: string) =>
    rendiPannello(ctx, nome, commessa, { conflitto: messaggio })
}

/** IP del client per l'audit */
export function ip(ctx: HttpContext) {
  return ctx.request.ip()
}
