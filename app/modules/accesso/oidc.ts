/**
 * Login Microsoft 365 (Entra ID) con OpenID Connect lato server.
 *
 * Flusso: authorization code + PKCE (S256), con state e nonce salvati nella
 * sessione (cookie httpOnly). Il token non arriva mai al browser: il server
 * legge i claim dell'ID token e crea la sessione applicativa.
 *
 * Libreria: openid-client v6 (API a funzioni: discovery, buildAuthorizationUrl,
 * authorizationCodeGrant).
 */
import * as client from 'openid-client'
import env from '#start/env'

export interface ConfigurazioneOidc {
  issuer: string
  clientId: string
  clientSecret?: string
  redirectUri: string
  postLogoutRedirectUri?: string
  scopes: string
}

/** Dati temporanei salvati in sessione tra /auth/login e /auth/callback */
export interface RichiestaOidc {
  state: string
  nonce: string
  codeVerifier: string
  ritorno: string
}

export interface ClaimsUtente {
  issuer: string
  sub: string
  email: string | null
  nome: string | null
}

let sovrascrittura: ConfigurazioneOidc | null = null
let cache: { chiave: string; config: client.Configuration } | null = null

/** Configurazione da env (o quella impostata dai test) */
export function configurazioneOidc(): ConfigurazioneOidc {
  if (sovrascrittura) return sovrascrittura
  return {
    issuer: env.get('OIDC_ISSUER') ?? '',
    clientId: env.get('OIDC_CLIENT_ID') ?? '',
    clientSecret: env.get('OIDC_CLIENT_SECRET')?.release(),
    redirectUri: env.get('OIDC_REDIRECT_URI') ?? '',
    postLogoutRedirectUri: env.get('OIDC_POST_LOGOUT_REDIRECT_URI'),
    scopes: env.get('OIDC_SCOPES') ?? 'openid profile email',
  }
}

/** Solo per i test: punta il client a un provider finto */
export function impostaConfigurazioneOidcPerTest(config: ConfigurazioneOidc | null) {
  sovrascrittura = config
  cache = null
}

export function oidcConfigurato(): boolean {
  const c = configurazioneOidc()
  return Boolean(c.issuer && c.clientId && c.redirectUri)
}

/** Discovery del provider (in cache finché la configurazione non cambia) */
async function configurazioneClient(): Promise<client.Configuration> {
  const c = configurazioneOidc()
  const chiave = `${c.issuer}|${c.clientId}`
  if (cache && cache.chiave === chiave) return cache.config

  const insicuro = c.issuer.startsWith('http://') && env.get('NODE_ENV') !== 'production'
  const config = await client.discovery(
    new URL(c.issuer),
    c.clientId,
    c.clientSecret,
    undefined,
    insicuro ? { execute: [client.allowInsecureRequests] } : undefined
  )
  cache = { chiave, config }
  return config
}

/** Prepara la redirezione verso il provider */
export async function iniziaLogin(
  ritorno: string
): Promise<{ url: string; richiesta: RichiestaOidc }> {
  const c = configurazioneOidc()
  const config = await configurazioneClient()
  const codeVerifier = client.randomPKCECodeVerifier()
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
  const state = client.randomState()
  const nonce = client.randomNonce()
  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: c.redirectUri,
    scope: c.scopes,
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  })
  return { url: url.href, richiesta: { state, nonce, codeVerifier, ritorno } }
}

/**
 * Completa il login: scambia il codice, verifica state, nonce e PKCE,
 * valida l'ID token e restituisce i claim utili.
 */
export async function completaLogin(
  urlCallback: URL,
  richiesta: RichiestaOidc
): Promise<ClaimsUtente> {
  const config = await configurazioneClient()
  const tokens = await client.authorizationCodeGrant(config, urlCallback, {
    pkceCodeVerifier: richiesta.codeVerifier,
    expectedState: richiesta.state,
    expectedNonce: richiesta.nonce,
    idTokenExpected: true,
  })
  const claims = tokens.claims()
  if (!claims) throw new Error('ID token assente nella risposta del provider')

  // Entra ID: "email" può mancare; "preferred_username" è l'UPN (di solito l'email)
  const candidati = [claims.email, claims.preferred_username, claims.upn]
  const email = candidati.find((v): v is string => typeof v === 'string' && v.includes('@')) ?? null
  const nome = typeof claims.name === 'string' ? claims.name : null

  return {
    issuer: String(claims.iss),
    sub: String(claims.sub),
    email: email ? email.toLowerCase() : null,
    nome,
  }
}

/** URL di logout del provider, se disponibile */
export async function urlLogoutProvider(): Promise<string | null> {
  if (!oidcConfigurato()) return null
  try {
    const c = configurazioneOidc()
    const config = await configurazioneClient()
    if (!config.serverMetadata().end_session_endpoint) return null
    const parametri: Record<string, string> = { client_id: c.clientId }
    if (c.postLogoutRedirectUri) parametri.post_logout_redirect_uri = c.postLogoutRedirectUri
    return client.buildEndSessionUrl(config, parametri).href
  } catch {
    return null
  }
}
