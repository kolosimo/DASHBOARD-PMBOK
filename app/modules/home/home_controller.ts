import type { HttpContext } from '@adonisjs/core/http'
import { commesseVisibili } from '#modules/anagrafiche/queries'
import { oggiRoma, lunediDellaSettimana } from '#shared/calendario'

/** Home dopo il login: le commesse visibili all'utente */
export default class HomeController {
  async index({ auth, view }: HttpContext) {
    const utente = auth.getUserOrFail()
    const commesse = await commesseVisibili(utente)
    const oggi = oggiRoma()
    return view.render('modules/home/index', {
      commesse,
      oggi,
      settimana: lunediDellaSettimana(oggi),
      voceAttiva: 'home',
    })
  }
}
