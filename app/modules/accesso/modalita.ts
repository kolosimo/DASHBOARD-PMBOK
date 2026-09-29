/**
 * Modalità di accesso attiva (AUTH_MODE), con sovrascrittura per i test.
 *
 * Un solo valore alla volta:
 * - `oidc`: solo Microsoft 365;
 * - `locale`: solo email e password gestite dall'admin (pilota);
 * - `dev`: sviluppo e test; oltre al login senza password sono attivi anche
 *   Microsoft 365 (se configurato) e l'accesso con password, per poterli
 *   provare in locale. Il server rifiuta `dev` in produzione (start/env.ts).
 */
import env from '#start/env'

export type ModalitaAccesso = 'oidc' | 'locale' | 'dev'

let sovrascrittura: ModalitaAccesso | null = null

export function modalitaAccesso(): ModalitaAccesso {
  return sovrascrittura ?? env.get('AUTH_MODE')
}

/** Solo per i test: simula un'altra modalità (null = torna a AUTH_MODE) */
export function impostaModalitaPerTest(modalita: ModalitaAccesso | null) {
  sovrascrittura = modalita
}

/** Accesso con email e password */
export function accessoLocaleAttivo(): boolean {
  const m = modalitaAccesso()
  return m === 'locale' || m === 'dev'
}

/** Accesso con Microsoft 365 */
export function accessoOidcAttivo(): boolean {
  const m = modalitaAccesso()
  return m === 'oidc' || m === 'dev'
}
