/**
 * Permesso di spostare le schede del Kanban. Proprietario: agente A3.
 *
 * Chi può: admin, PM della commessa, membri con ruolo di commessa
 * "progettista" o "verificatore". Non possono: direzione, osservatori,
 * non membri (vedono la board in sola lettura, se `vedeCommessa` lo consente).
 *
 * Proposta all'orchestratore: spostare questa abilità in app/abilities/main.ts
 * (con la riga nella matrice di docs/sviluppo/permessi.md).
 */
import { Bouncer } from '@adonisjs/bouncer'
import type Utente from '#models/utente'
import type Commessa from '#models/commessa'
import { ruoloNellaCommessa } from '#shared/appartenenza'

export const spostaElaborati = Bouncer.ability(async (utente: Utente, commessa: Commessa) => {
  if (!utente.attivo) return false
  if (utente.ruolo === 'admin') return true
  if (utente.ruolo === 'direzione') return false
  if (commessa.pmId === utente.id) return true
  const ruolo = await ruoloNellaCommessa(utente.id, commessa.id)
  return ruolo === 'pm' || ruolo === 'progettista' || ruolo === 'verificatore'
})
