import type { HttpContext } from '@adonisjs/core/http'
import { admin } from '#abilities/main'
import { SEZIONI_ADMIN } from '#modules/admin/comune'
import {
  entitaPresenti,
  giornoValido,
  utentiPerFiltro,
  vociRegistro,
  type FiltriRegistro,
} from './queries.js'

const NEGATO = 'Il registro attività è riservato agli amministratori.'

/** Voce del sottomenu dell'amministrazione per questa pagina */
export const SEZIONE_REGISTRO = {
  id: 'registro',
  etichetta: 'Registro attività',
  percorso: '/admin/registro',
} as const

/** Sottomenu dell'amministrazione con il registro (se il modulo admin non lo elenca già) */
function sezioni() {
  const elenco: { id: string; etichetta: string; percorso: string }[] = [...SEZIONI_ADMIN]
  if (!elenco.some((s) => s.id === SEZIONE_REGISTRO.id)) elenco.push(SEZIONE_REGISTRO)
  return elenco
}

function intero(valore: unknown): number | null {
  const n = Number(valore)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Registro attività: le voci di audit_log con filtri per data, utente ed
 * entità e paginazione. Sola lettura, solo amministratori.
 */
export default class RegistroController {
  async index(ctx: HttpContext) {
    if (!(await ctx.bouncer.allows(admin))) {
      return ctx.response.abort(NEGATO, 403)
    }
    const q = ctx.request.qs()
    const entita = typeof q.entita === 'string' && q.entita.trim() ? q.entita.trim() : null
    const filtri: FiltriRegistro = {
      dal: giornoValido(q.dal),
      al: giornoValido(q.al),
      utenteId: intero(q.utente),
      entita,
      pagina: intero(q.pagina) ?? 1,
    }
    const errori: string[] = []
    if (q.dal && !filtri.dal) errori.push('Data “dal” non valida.')
    if (q.al && !filtri.al) errori.push('Data “al” non valida.')
    if (filtri.dal && filtri.al && filtri.dal > filtri.al) {
      errori.push('La data “dal” è successiva alla data “al”: nessuna voce nel periodo.')
    }

    const elenco = await vociRegistro(filtri)
    const parametri = (pagina: number) => {
      const p = new URLSearchParams()
      if (filtri.dal) p.set('dal', filtri.dal)
      if (filtri.al) p.set('al', filtri.al)
      if (filtri.utenteId) p.set('utente', String(filtri.utenteId))
      if (filtri.entita) p.set('entita', filtri.entita)
      if (pagina > 1) p.set('pagina', String(pagina))
      const s = p.toString()
      return `/admin/registro${s ? `?${s}` : ''}`
    }

    return ctx.view.render('modules/audit/registro', {
      voceAttiva: 'admin',
      sezioni: sezioni(),
      sezione: SEZIONE_REGISTRO.id,
      intestazione: 'Registro attività',
      descrizione:
        'Chi ha cambiato cosa e quando: modifiche ai dati delle commesse, cambi di stato, configurazione, accessi. Il registro accetta solo aggiunte, nessuno può modificarlo o cancellarlo. È in ordine di tempo, dalla voce più recente.',
      messaggio: null,
      filtri,
      errori,
      utenti: await utentiPerFiltro(),
      entita: await entitaPresenti(),
      ...elenco,
      precedente: elenco.pagina > 1 ? parametri(elenco.pagina - 1) : null,
      successiva: elenco.pagina < elenco.ultimaPagina ? parametri(elenco.pagina + 1) : null,
    })
  }
}
