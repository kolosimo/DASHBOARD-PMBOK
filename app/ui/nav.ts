/**
 * Navigazione dell'app. File dell'orchestratore: i moduli non lo modificano,
 * chiedono l'aggiunta di una voce nel loro handoff.
 *
 * - `vociGlobali`: testata, sempre visibili (salvo `soloAdmin`).
 * - `vociCommessa`: schede dentro una commessa; `percorso` riceve l'id.
 */

export interface VoceGlobale {
  id: string
  etichetta: string
  percorso: string
  soloAdmin?: boolean
}

export interface VoceCommessa {
  id: string
  etichetta: string
  percorso: (commessaId: number) => string
}

export const vociGlobali: VoceGlobale[] = [
  { id: 'home', etichetta: 'Le mie commesse', percorso: '/' },
  { id: 'portafoglio', etichetta: 'Portafoglio', percorso: '/portafoglio' },
  { id: 'ore', etichetta: 'Le mie ore', percorso: '/ore' },
  { id: 'admin', etichetta: 'Amministrazione', percorso: '/admin', soloAdmin: true },
]

export const vociCommessa: VoceCommessa[] = [
  { id: 'obeya', etichetta: 'Commessa', percorso: (id) => `/commesse/${id}` },
  { id: 'settimana', etichetta: 'Piano settimanale', percorso: (id) => `/commesse/${id}/lps/settimana` },
  { id: 'lookahead', etichetta: 'Lookahead e vincoli', percorso: (id) => `/commesse/${id}/lps/lookahead` },
  { id: 'kanban', etichetta: 'Kanban', percorso: (id) => `/commesse/${id}/flusso` },
  { id: 'ore', etichetta: 'Ore', percorso: (id) => `/commesse/${id}/ore` },
  { id: 'evm', etichetta: 'Avanzamento EVM', percorso: (id) => `/commesse/${id}/evm` },
  { id: 'anagrafica', etichetta: 'Anagrafica', percorso: (id) => `/commesse/${id}/anagrafica` },
]
