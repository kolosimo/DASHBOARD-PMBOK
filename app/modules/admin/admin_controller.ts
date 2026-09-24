import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Impostazione from '#models/impostazione'
import { admin } from '#abilities/main'
import { elencoImpostazioni } from './queries.js'
import { aggiornaImpostazione, IMPOSTAZIONI_DEFAULT, valoreValido } from '#shared/impostazioni'
import type { ChiaveImpostazione } from '#shared/impostazioni'

const validatoreModifica = vine.create(
  vine.object({
    version: vine.number().withoutDecimals().min(1),
    valore: vine.string().trim().optional(),
    verde: vine.string().trim().optional(),
    giallo: vine.string().trim().optional(),
    attivo: vine.string().optional(),
  })
)

/** "0,95" → 0.95; null se non è un numero */
function numeroItaliano(valore: string | undefined): number | null {
  if (valore === undefined || valore === '') return null
  const n = Number(valore.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Pannello di amministrazione. In Fase 0 solo le impostazioni (con
 * optimistic locking); il resto del pannello è dell'agente A1.
 */
export default class AdminController {
  async index({ view, bouncer }: HttpContext) {
    await bouncer.authorize(admin)
    const impostazioni = await elencoImpostazioni()
    return view.render('modules/admin/index', { impostazioni, voceAttiva: 'admin' })
  }

  async aggiornaImpostazione(ctx: HttpContext) {
    const { request, response, view, bouncer, auth, params } = ctx
    await bouncer.authorize(admin)
    const utente = auth.getUserOrFail()
    const riga = await Impostazione.findOrFail(params.id)
    const dati = await request.validateUsing(validatoreModifica)

    const esempio = IMPOSTAZIONI_DEFAULT[riga.chiave as ChiaveImpostazione]?.valore
    let valore: unknown
    if (typeof esempio === 'boolean') {
      valore = dati.attivo === 'on' || dati.attivo === 'true'
    } else if (typeof esempio === 'number') {
      valore = numeroItaliano(dati.valore)
    } else {
      valore = {
        verde: numeroItaliano(dati.verde),
        giallo: numeroItaliano(dati.giallo),
        verso: (riga.valore as { verso?: string } | null)?.verso ?? 'alto',
      }
    }

    if (!valoreValido(riga.chiave, valore)) {
      response.status(422)
      return view.render('modules/admin/_impostazione', {
        imp: riga,
        errore: 'Valore non valido: controlla i numeri inseriti.',
      })
    }

    const aggiornata = await aggiornaImpostazione(
      riga.id,
      dati.version,
      valore,
      utente.id,
      (attuale, messaggio) =>
        view.render('modules/admin/_impostazione', { imp: attuale, conflitto: messaggio })
    )

    response.header('HX-Trigger', JSON.stringify({ toast: 'Impostazione salvata' }))
    return view.render('modules/admin/_impostazione', { imp: aggiornata, salvata: true })
  }
}
