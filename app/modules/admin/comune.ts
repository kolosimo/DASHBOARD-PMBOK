/**
 * Funzioni comuni del pannello di amministrazione.
 */
import type { HttpContext } from '@adonisjs/core/http'
import { admin } from '#abilities/main'
import { pubblica } from '#shared/eventi'
import { commesseAperte } from './queries.js'

/** Sezioni del pannello (sottomenu) */
export const SEZIONI_ADMIN = [
  { id: 'impostazioni', etichetta: 'Impostazioni e soglie', percorso: '/admin' },
  { id: 'commesse', etichetta: 'Commesse', percorso: '/admin/commesse' },
  { id: 'utenti', etichetta: 'Utenti e ruoli', percorso: '/admin/utenti' },
  { id: 'discipline', etichetta: 'Discipline', percorso: '/admin/discipline' },
  { id: 'stati', etichetta: 'Stati e pesi', percorso: '/admin/stati' },
  { id: 'colonne', etichetta: 'Colonne Kanban e WIP', percorso: '/admin/colonne' },
  { id: 'cause', etichetta: 'Cause di non completamento', percorso: '/admin/cause' },
  { id: 'registro', etichetta: 'Registro attività', percorso: '/admin/registro' },
] as const

export type SezioneAdmin = (typeof SEZIONI_ADMIN)[number]['id']

export const NEGATO_ADMIN = 'Questa funzione è riservata agli amministratori.'

/**
 * 403 se l'utente non è amministratore. Non si usa `bouncer.authorize` perché
 * sulle richieste POST l'eccezione di Bouncer risponde con una redirezione (302).
 */
export async function soloAdmin(ctx: HttpContext) {
  if (!(await ctx.bouncer.allows(admin))) {
    return ctx.response.abort(NEGATO_ADMIN, 403)
  }
  return ctx.auth.getUserOrFail()
}

/** Dati comuni delle pagine admin */
export function datiPagina(sezione: SezioneAdmin) {
  return { voceAttiva: 'admin', sezioni: SEZIONI_ADMIN, sezione }
}

/**
 * Risposta dopo la modifica di una riga: frammento per HTMX (con toast),
 * redirezione alla sezione senza JavaScript; con errori, frammento o pagina (422).
 */
export async function rispondiRiga(
  ctx: HttpContext,
  opz: {
    parziale: string
    dati: Record<string, unknown>
    sezione: SezioneAdmin
    status?: number
    messaggio?: string
    pagina?: () => Promise<string>
  }
) {
  const status = opz.status ?? 200
  if (ctx.request.header('hx-request') === 'true') {
    ctx.response.status(status)
    if (status === 200 && opz.messaggio) {
      ctx.response.header('HX-Trigger', JSON.stringify({ toast: opz.messaggio }))
    }
    return ctx.view.render(opz.parziale, opz.dati)
  }
  if (status === 200) {
    if (opz.messaggio) ctx.session.flash('messaggio', opz.messaggio)
    const percorso = SEZIONI_ADMIN.find((s) => s.id === opz.sezione)!.percorso
    return ctx.response.redirect(percorso)
  }
  ctx.response.status(status)
  if (opz.pagina) return opz.pagina()
  return ctx.view.render(opz.parziale, opz.dati)
}

/**
 * Avvisa le pagine aperte delle commesse non chiuse che la configurazione è
 * cambiata (i frammenti si ricaricano). Da chiamare dopo il commit.
 */
export async function pubblicaConfigurazione(cosa: string) {
  for (const id of await commesseAperte()) {
    pubblica(id, 'impostazioni.aggiornate', { cosa })
  }
}
