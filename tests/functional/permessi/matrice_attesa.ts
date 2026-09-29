/**
 * Matrice attesa "rotte × ruoli", allineata a docs/sviluppo/permessi.md.
 *
 * Ogni rotta registrata nel router di Adonis deve comparire qui (per nome) oppure
 * fra le ESCLUSE con il motivo: una rotta nuova senza riga fa fallire il test,
 * così nessuna rotta entra nell'app senza che qualcuno ne abbia deciso i permessi.
 *
 * I ruoli sono provati sulla commessa di esempio CL-2026-031 (scuola):
 * - anonimo      nessun login
 * - esterno      progettista che non è membro della commessa (creato nel test)
 * - osservatore  pm2, membro con ruolo di commessa "osservatore"
 * - progettista  mec1, membro con ruolo di commessa "progettista"
 * - direzione    ruolo globale direzione
 * - pm           pm1, PM della commessa
 * - admin        ruolo globale admin
 *
 * Esiti:
 * - 'ok'       GET: 200. POST: la richiesta passa i permessi (né 401/403 né 5xx né
 *              redirezione al login). Il corpo è vuoto, quindi di solito si ottiene
 *              422, 404 o una redirezione: conta che il permesso non neghi.
 * - 'negato'   403
 * - 'accesso'  302 verso /accesso (non autenticato)
 * - 'home'     302 verso una pagina diversa da /accesso
 * - numero     stato HTTP esatto
 */

export const RUOLI = [
  'anonimo',
  'esterno',
  'osservatore',
  'progettista',
  'direzione',
  'pm',
  'admin',
] as const
export type Ruolo = (typeof RUOLI)[number]

export type Esito = 'ok' | 'negato' | 'accesso' | 'home' | number
export type Riga = Record<Ruolo, Esito>

/** Utenti del seed per ruolo (l'esterno lo crea il test) */
export const UTENTE_PER_RUOLO: Record<Exclude<Ruolo, 'anonimo'>, string> = {
  esterno: 'esterno.b3',
  osservatore: 'pm2',
  progettista: 'mec1',
  direzione: 'direzione',
  pm: 'pm1',
  admin: 'admin',
}

function riga(
  anonimo: Esito,
  esterno: Esito,
  osservatore: Esito,
  progettista: Esito,
  direzione: Esito,
  pm: Esito,
  admin: Esito
): Riga {
  return { anonimo, esterno, osservatore, progettista, direzione, pm, admin }
}

// Regole ricorrenti (colonne: anonimo, esterno, osservatore, progettista, direzione, pm, admin)
/** Autenticati */
const AUTENTICATI = riga('accesso', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok')
/** vedeCommessa */
const VEDE = riga('accesso', 'negato', 'ok', 'ok', 'ok', 'ok', 'ok')
/** modificaCommessa e gestisceLps: admin e PM della commessa */
const PM_ADMIN = riga('accesso', 'negato', 'negato', 'negato', 'negato', 'ok', 'ok')
/** spostaElaborati: mai direzione e osservatori */
const SPOSTA = riga('accesso', 'negato', 'negato', 'ok', 'negato', 'ok', 'ok')
/** admin */
const ADMIN = riga('accesso', 'negato', 'negato', 'negato', 'negato', 'negato', 'ok')

/** Esito atteso per nome di rotta */
export const MATRICE: Record<string, Riga> = {
  // Accesso (pubbliche). In AUTH_MODE=dev senza configurazione OIDC /auth/login
  // risponde 503 e /auth/callback 400 (richiesta non valida): mai 200.
  'accesso': riga(200, 'home', 'home', 'home', 'home', 'home', 'home'),
  'auth.login': riga(503, 503, 503, 503, 503, 503, 503),
  'auth.callback': riga(400, 400, 400, 400, 400, 400, 400),
  // Account locali (B6). Login a password: pubblico, a corpo vuoto 422. Cambio
  // password: solo per chi ha un account locale; gli utenti del login di sviluppo
  // (senza password) e gli anonimi tornano a /accesso.
  'accesso.locale': riga(422, 'home', 'home', 'home', 'home', 'home', 'home'),
  'accesso.cambia_password': riga(
    'accesso',
    'accesso',
    'accesso',
    'accesso',
    'accesso',
    'accesso',
    'accesso'
  ),
  'accesso.cambia_password.salva': riga(
    'accesso',
    'accesso',
    'accesso',
    'accesso',
    'accesso',
    'accesso',
    'accesso'
  ),

  // Pagine globali
  'home': AUTENTICATI,
  'portafoglio': AUTENTICATI,
  'ore.mie': AUTENTICATI,
  'ore.cella': AUTENTICATI, // registraOre solo per sé: il controllo è nel corpo
  'ore.correzione': ADMIN,
  'ore.correzione.cella': ADMIN,

  // Obeya, dettaglio elaborato, ore della commessa
  'obeya.show': VEDE,
  'obeya.contenuto': VEDE,
  'elaborato_dettaglio.show': VEDE,
  'elaborato_dettaglio.frammento': VEDE,
  'elaborato_dettaglio.stato': SPOSTA,
  'ore.commessa': VEDE,

  // Anagrafica (A1)
  'anagrafiche.show': VEDE,
  'anagrafiche.dati': PM_ADMIN,
  'anagrafiche.limiti_wip': PM_ADMIN,
  'anagrafiche.team.aggiungi': PM_ADMIN,
  'anagrafiche.team.aggiorna': PM_ADMIN,
  'anagrafiche.team.rimuovi': PM_ADMIN,
  'anagrafiche.milestone.crea': PM_ADMIN,
  'anagrafiche.milestone.aggiorna': PM_ADMIN,
  'anagrafiche.milestone.elimina': PM_ADMIN,
  'anagrafiche.elaborati.nuovo': PM_ADMIN,
  'anagrafiche.elaborati.crea': PM_ADMIN,
  'anagrafiche.elaborati.import': PM_ADMIN,
  'anagrafiche.elaborati.import.anteprima': PM_ADMIN,
  'anagrafiche.elaborati.import.conferma': PM_ADMIN,
  'anagrafiche.elaborati.modifica': PM_ADMIN,
  'anagrafiche.elaborati.aggiorna': PM_ADMIN,
  'anagrafiche.elaborati.elimina': PM_ADMIN,

  // Last Planner (A2): letture con vedeCommessa, scritture e form con gestisceLps
  'lps.settimana': VEDE,
  'lps.settimana.frammento': VEDE,
  'lps.lookahead': VEDE,
  'lps.lookahead.frammento': VEDE,
  'lps.piano.crea': PM_ADMIN,
  'lps.impegni.aggiungi': PM_ADMIN,
  'lps.piano.prometti': PM_ADMIN,
  'lps.piano.chiudi': PM_ADMIN,
  // Esito: gestisceLps oppure last planner della riga. La riga usata nel test NON è
  // di mec1, quindi il progettista riceve 403 (il caso "propria riga" è nei test LPS).
  'lps.impegni.esito': PM_ADMIN,
  'lps.impegni.elimina': PM_ADMIN,
  'lps.attivita.nuova': PM_ADMIN,
  'lps.attivita.crea': PM_ADMIN,
  'lps.attivita.modifica': PM_ADMIN,
  'lps.attivita.aggiorna': PM_ADMIN,
  'lps.attivita.elimina': PM_ADMIN,
  'lps.vincoli.nuovo': PM_ADMIN,
  'lps.vincoli.crea': PM_ADMIN,
  'lps.vincoli.modifica': PM_ADMIN,
  'lps.vincoli.aggiorna': PM_ADMIN,
  'lps.vincoli.stato': PM_ADMIN,

  // Kanban (A3)
  'flusso.kanban': VEDE,
  'flusso.frammento': VEDE,
  'flusso.sposta': SPOSTA,

  // EVM (A5)
  'evm.show': VEDE,
  'evm.contenuto': VEDE,
  'evm.baseline': PM_ADMIN, // editor della baseline: modificaCommessa anche in lettura
  'evm.baseline.crea': PM_ADMIN,
  'evm.baseline.riga': PM_ADMIN,
  'evm.baseline.mancanti': PM_ADMIN,
  'evm.baseline.approva': PM_ADMIN,
  'evm.baseline.scarta': PM_ADMIN,

  // Amministrazione (A6) e registro attività (B3)
  'admin.index': ADMIN,
  'admin.impostazioni.aggiorna': ADMIN,
  'admin.commesse': ADMIN,
  'admin.commesse.crea': ADMIN,
  'admin.utenti': ADMIN,
  'admin.utenti.aggiorna': ADMIN,
  'admin.utenti.crea': ADMIN,
  'admin.utenti.password': ADMIN,
  'admin.utenti.sblocca': ADMIN,
  'admin.stati': ADMIN,
  'admin.stati.aggiorna': ADMIN,
  'admin.colonne': ADMIN,
  'admin.colonne.aggiorna': ADMIN,
  'admin.voci': ADMIN,
  'admin.voci.crea': ADMIN,
  'admin.voci.aggiorna': ADMIN,
  'audit.registro': ADMIN,
}

/**
 * Rotte non provate dalla matrice, con il motivo. Restano comunque elencate:
 * se sparissero dal router il test lo segnala.
 */
export const ESCLUSE: Record<string, string> = {
  'dev.login':
    'cambia la sessione di chi la chiama; provata in accesso_sviluppo.spec.ts (404 fuori da AUTH_MODE=dev)',
  'auth.logout': 'chiude la sessione; provata a parte in matrice.spec.ts',
  'event_stream':
    'SSE (risposta senza fine); canali autorizzati con vedeCommessa in start/transmit.ts',
  'subscribe': 'Transmit: iscrizione ai canali, provata a parte in matrice.spec.ts',
  'unsubscribe': 'Transmit: disiscrizione, nessun dato restituito',
}

/**
 * Rotte che, su richiesta di un ruolo con il permesso, possono rispondere con una
 * redirezione (form senza JavaScript) invece di 200. Solo GET.
 */
export const GET_CON_REDIREZIONE_AMMESSA = new Set<string>([])

/**
 * Corpo dei POST per le rotte che, a corpo vuoto, non arrivano al controllo dei
 * permessi in modo pulito. `p` sono gli identificativi reali usati nel test.
 */
export const CORPI_DI_PROVA: Record<string, (p: Record<string, string>) => Record<string, string>> =
  {}

/**
 * Rotte escluse dal test "dato figlio di un'altra commessa", con il motivo.
 * Da togliere appena la rotta legge il dato filtrando per commessa (404).
 */
export const FIGLI_NON_CONTROLLATI: Record<string, string> = {}
