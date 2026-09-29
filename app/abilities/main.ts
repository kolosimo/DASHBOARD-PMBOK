/*
|--------------------------------------------------------------------------
| Abilità Bouncer
|--------------------------------------------------------------------------
|
| Permessi di base, fondati sul ruolo globale dell'utente e sull'appartenenza
| alla commessa. La matrice completa è in docs/sviluppo/permessi.md.
|
| Uso nei controller:  await bouncer.authorize(vedeCommessa, commessa)
| Uso nei template:    @can('vedeCommessa', commessa) ... @end
|
*/

import { Bouncer } from '@adonisjs/bouncer'
import type Utente from '#models/utente'
import type Commessa from '#models/commessa'
import { leggiImpostazione } from '#shared/impostazioni'
import { ePmDellaCommessa, ruoloNellaCommessa } from '#shared/appartenenza'

/** Solo amministratori */
export const admin = Bouncer.ability((utente: Utente) => {
  return utente.attivo && utente.ruolo === 'admin'
})

/**
 * Vedere la commessa: admin e direzione sempre (la direzione vede i totali),
 * gli altri solo se membri o PM della commessa.
 */
export const vedeCommessa = Bouncer.ability(async (utente: Utente, commessa: Commessa) => {
  if (!utente.attivo) return false
  if (utente.ruolo === 'admin' || utente.ruolo === 'direzione') return true
  if (commessa.pmId === utente.id) return true
  return (await ruoloNellaCommessa(utente.id, commessa.id)) !== null
})

/** Modificare anagrafica, team, milestone ed elaborati: admin o PM della commessa */
export const modificaCommessa = Bouncer.ability(async (utente: Utente, commessa: Commessa) => {
  if (!utente.attivo) return false
  if (utente.ruolo === 'admin') return true
  return ePmDellaCommessa(utente, commessa)
})

/**
 * Gestire il Last Planner (lookahead, vincoli, promessa e chiusura del piano):
 * admin o PM della commessa. Le singole righe del piano le aggiorna anche il
 * last planner assegnato: quella regola la aggiunge il modulo LPS.
 */
export const gestisceLps = Bouncer.ability(async (utente: Utente, commessa: Commessa) => {
  if (!utente.attivo) return false
  if (utente.ruolo === 'admin') return true
  return ePmDellaCommessa(utente, commessa)
})

/** Registrare ore: ognuno solo per sé, nessuna eccezione (nemmeno l'admin) */
export const registraOre = Bouncer.ability((utente: Utente, proprietarioId: number) => {
  return utente.attivo && utente.id === proprietarioId
})

/**
 * Vedere le ore per persona di una commessa: attivo di default (Gate 0, 28/09/2026),
 * disattivabile con l'impostazione `ore.per_persona_visibili` (art. 4 Statuto dei lavoratori).
 * Se attivato: solo admin e PM della commessa. La direzione mai.
 */
export const vedeOrePerPersona = Bouncer.ability(async (utente: Utente, commessa: Commessa) => {
  if (!utente.attivo) return false
  const attivo = await leggiImpostazione('ore.per_persona_visibili')
  if (!attivo) return false
  if (utente.ruolo === 'admin') return true
  return ePmDellaCommessa(utente, commessa)
})

/**
 * Spostare le schede del Kanban (cambio di stato degli elaborati): admin, PM
 * della commessa, membri con ruolo "pm", "progettista" o "verificatore".
 * Mai direzione, osservatori e non membri (vedono la board in sola lettura).
 */
export const spostaElaborati = Bouncer.ability(async (utente: Utente, commessa: Commessa) => {
  if (!utente.attivo) return false
  if (utente.ruolo === 'admin') return true
  if (utente.ruolo === 'direzione') return false
  if (commessa.pmId === utente.id) return true
  const ruolo = await ruoloNellaCommessa(utente.id, commessa.id)
  return ruolo === 'pm' || ruolo === 'progettista' || ruolo === 'verificatore'
})

/**
 * Aprire una commessa nuova: admin e utenti con ruolo globale "pm" (pilota di
 * Fase 2: i PM inseriscono da sé le proprie commesse). Il PM che la apre ne
 * diventa il PM; l'admin può indicarne un altro.
 */
export const creaCommessa = Bouncer.ability((utente: Utente) => {
  return utente.attivo && (utente.ruolo === 'admin' || utente.ruolo === 'pm')
})
