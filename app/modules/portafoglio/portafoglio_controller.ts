import type { HttpContext } from '@adonisjs/core/http'
import { leggiTutteLeImpostazioni } from '#shared/impostazioni'
import { lunediDellaSettimana, oggiRoma } from '#shared/calendario'
import { righePortafoglio, SETTIMANE_PPC_PORTAFOGLIO, totaliPortafoglio } from './queries.js'

/**
 * Portafoglio: il PM vede le sue commesse, direzione e admin tutte con i
 * totali di portafoglio. Solo indicatori per commessa, nessun dato per persona.
 */
export default class PortafoglioController {
  async index({ auth, view }: HttpContext) {
    const utente = auth.getUserOrFail()
    const oggi = oggiRoma()
    const [righe, imp] = await Promise.all([
      righePortafoglio(utente, oggi),
      leggiTutteLeImpostazioni(),
    ])
    const vistaDirezione = utente.ruolo === 'direzione' || utente.ruolo === 'admin'
    return view.render('modules/portafoglio/index', {
      voceAttiva: 'portafoglio',
      oggi,
      settimana: lunediDellaSettimana(oggi),
      righe,
      totali: vistaDirezione ? totaliPortafoglio(righe) : null,
      vistaDirezione,
      settimanePpc: SETTIMANE_PPC_PORTAFOGLIO,
      soglie: {
        spi: imp['soglie.spi'],
        cpi: imp['soglie.cpi'],
        ppc: imp['soglie.ppc'],
      },
    })
  }
}
