/**
 * Creazione di una commessa nuova, condivisa fra la pagina dell'admin
 * (/admin/commesse) e quella del PM (/commesse/nuova).
 *
 * Valida i campi, crea commessa e riga del PM nel team in una transazione,
 * registra l'audit e pubblica l'evento. Restituisce la commessa creata oppure
 * gli errori per campo.
 */
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Commessa from '#models/commessa'
import MembroCommessa from '#models/membro_commessa'
import type Utente from '#models/utente'
import { istantaneaPerAudit, registraAudit } from '#shared/audit'
import { pubblica } from '#shared/eventi'
import { Campi, eViolazioneUnicita } from '#modules/anagrafiche/validazione'
import type { Errori } from '#modules/anagrafiche/validazione'

export type EsitoCreazione = { commessa: Commessa } | { errori: Errori }

/**
 * @param pmForzato id del PM da usare al posto del campo `pm_id` (il PM che apre
 *   la commessa ne diventa il PM); null = si legge `pm_id` dal form.
 */
export async function creaCommessaDaForm(
  ctx: HttpContext,
  io: Utente,
  pmForzato: number | null = null
): Promise<EsitoCreazione> {
  const campi = new Campi(ctx.request.all())
  const codice = campi.testo('codice', 'Codice', { obbligatorio: true, max: 30 })
  const nome = campi.testo('nome', 'Nome', { obbligatorio: true, max: 300 })
  const cliente = campi.testo('cliente', 'Cliente', { max: 300 })
  const pmId = pmForzato ?? campi.id('pm_id', 'PM')
  const dataInizio = campi.data('data_inizio', 'Data di inizio')
  const dataFine = campi.data('data_fine_prevista', 'Fine prevista')
  if (dataInizio && dataFine && dataFine < dataInizio) {
    campi.errore('data_fine_prevista', 'Fine prevista: non può precedere la data di inizio.')
  }
  if (pmId !== null && pmForzato === null) {
    const pm = await db.from('utenti').where('id', pmId).where('attivo', true).first()
    if (!pm) campi.errore('pm_id', 'PM: utente inesistente o disattivato.')
  }
  if (codice && (await db.from('commesse').where('codice', codice).first())) {
    campi.errore('codice', `Codice: esiste già una commessa ${codice}.`)
  }
  if (!campi.valido) return { errori: campi.errori }

  let commessa: Commessa
  try {
    commessa = await db.transaction(async (trx) => {
      const c = await Commessa.create(
        {
          codice: codice!,
          nome: nome!,
          cliente,
          pmId,
          stato: 'attiva',
          dataInizio,
          dataFinePrevista: dataFine,
        },
        { client: trx }
      )
      await registraAudit(
        {
          utenteId: io.id,
          azione: 'commessa.creata',
          entita: 'commesse',
          entitaId: c.id,
          commessaId: c.id,
          dopo: istantaneaPerAudit(c),
          ip: ctx.request.ip(),
        },
        trx
      )
      if (pmId !== null) {
        const m = await MembroCommessa.create(
          { commessaId: c.id, utenteId: pmId, ruoloCommessa: 'pm' },
          { client: trx }
        )
        await registraAudit(
          {
            utenteId: io.id,
            azione: 'membro.aggiunto',
            entita: 'membri_commessa',
            entitaId: m.id,
            commessaId: c.id,
            dopo: istantaneaPerAudit(m),
            ip: ctx.request.ip(),
          },
          trx
        )
      }
      return c
    })
  } catch (errore) {
    if (!eViolazioneUnicita(errore)) throw errore
    return { errori: { codice: `Codice: esiste già una commessa ${codice}.` } }
  }
  pubblica(commessa.id, 'commessa.aggiornata')
  return { commessa }
}
