import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Impostazione from '#models/impostazione'
import { elencoImpostazioni } from './queries.js'
import { aggiornaImpostazione, IMPOSTAZIONI_DEFAULT, valoreValido } from '#shared/impostazioni'
import type { ChiaveImpostazione } from '#shared/impostazioni'
import { numeroItaliano } from '#modules/anagrafiche/validazione'
import { datiPagina, pubblicaConfigurazione, soloAdmin } from './comune.js'

const validatoreModifica = vine.create(
  vine.object({
    version: vine.number().withoutDecimals().min(1),
    valore: vine.string().trim().optional(),
    verde: vine.string().trim().optional(),
    giallo: vine.string().trim().optional(),
    attivo: vine.string().optional(),
  })
)

/**
 * Pannello di amministrazione: pagina iniziale con impostazioni e soglie
 * (optimistic locking, audit). Le altre sezioni hanno i propri controller.
 */
export default class AdminController {
  async index(ctx: HttpContext) {
    await soloAdmin(ctx)
    const impostazioni = await elencoImpostazioni()
    return ctx.view.render('modules/admin/index', {
      impostazioni,
      ...datiPagina('impostazioni'),
      messaggio: ctx.session.flashMessages.get('messaggio') ?? null,
    })
  }

  async aggiornaImpostazione(ctx: HttpContext) {
    const { request, response, view, params } = ctx
    const utente = await soloAdmin(ctx)
    const riga = await Impostazione.findOrFail(params.id)
    const dati = await request.validateUsing(validatoreModifica)

    const esempio = IMPOSTAZIONI_DEFAULT[riga.chiave as ChiaveImpostazione]?.valore
    let valore: unknown
    if (typeof esempio === 'boolean') {
      valore = dati.attivo === 'on' || dati.attivo === 'true'
    } else if (typeof esempio === 'number') {
      valore = numeroItaliano(dati.valore)
    } else {
      const verde = numeroItaliano(dati.verde)
      const giallo = numeroItaliano(dati.giallo)
      const verso = (riga.valore as { verso?: string } | null)?.verso ?? 'alto'
      valore = { verde, giallo, verso }
      // Soglie coerenti: con "più alto è meglio" il verde parte sopra il giallo
      if (
        verde !== null &&
        giallo !== null &&
        ((verso === 'alto' && verde < giallo) || (verso === 'basso' && verde > giallo))
      ) {
        response.status(422)
        return view.render('modules/admin/_impostazione', {
          imp: riga,
          errore:
            verso === 'alto'
              ? 'La soglia del verde deve essere uguale o maggiore di quella del giallo.'
              : 'La soglia del verde deve essere uguale o minore di quella del giallo.',
        })
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
    await pubblicaConfigurazione('impostazioni')

    response.header('HX-Trigger', JSON.stringify({ toast: 'Impostazione salvata' }))
    return view.render('modules/admin/_impostazione', { imp: aggiornata, salvata: true })
  }
}
