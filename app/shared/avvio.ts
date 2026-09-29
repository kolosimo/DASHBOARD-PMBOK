/**
 * Controlli eseguiti all'avvio, prima che l'app accetti richieste.
 * Funzioni pure: si possono testare senza avviare il server.
 */

/** oidc = Microsoft 365; locale = email e password gestite dall'admin; dev = sviluppo */
export type ModalitaAuth = 'oidc' | 'locale' | 'dev'

export class ConfigurazioneNonValida extends Error {
  constructor(messaggio: string) {
    super(messaggio)
    this.name = 'ConfigurazioneNonValida'
  }
}

/**
 * Rifiuta le combinazioni pericolose di variabili d'ambiente.
 *
 * - `NODE_ENV=production` con `AUTH_MODE=dev`: vietato, perché il login di
 *   sviluppo permette di entrare come chiunque senza password.
 * - `AUTH_MODE=oidc` senza issuer, client id o redirect: vietato.
 * - `AUTH_MODE=locale`: nessuna variabile OIDC richiesta.
 */
export function controllaConfigurazioneAvvio(valori: {
  NODE_ENV: string
  AUTH_MODE: ModalitaAuth
  OIDC_ISSUER?: string
  OIDC_CLIENT_ID?: string
  OIDC_REDIRECT_URI?: string
}): void {
  if (valori.NODE_ENV === 'production' && valori.AUTH_MODE === 'dev') {
    throw new ConfigurazioneNonValida(
      'Avvio rifiutato: AUTH_MODE=dev non è ammesso con NODE_ENV=production. ' +
        'Imposta AUTH_MODE=oidc e configura il login Microsoft 365.'
    )
  }
  if (valori.AUTH_MODE === 'oidc') {
    const mancanti = (['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_REDIRECT_URI'] as const).filter(
      (k) => !valori[k]
    )
    if (mancanti.length > 0) {
      throw new ConfigurazioneNonValida(
        `Avvio rifiutato: con AUTH_MODE=oidc servono ${mancanti.join(', ')}.`
      )
    }
  }
}

/** Legge ADMIN_EMAILS (separati da virgola o punto e virgola) in minuscolo. */
export function elencoEmailAdmin(valore: string | undefined): string[] {
  if (!valore) return []
  return valore
    .split(/[,;]/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
}
