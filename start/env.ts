/*
|--------------------------------------------------------------------------
| Variabili d'ambiente
|--------------------------------------------------------------------------
|
| Env.create valida e converte le variabili. Dopo la validazione si
| eseguono i controlli di avvio: il server rifiuta di partire con
| NODE_ENV=production e AUTH_MODE=dev.
|
*/

import { Env } from '@adonisjs/core/env'
import { controllaConfigurazioneAvvio } from '../app/shared/avvio.js'

const env = await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),
  TZ: Env.schema.string.optional(),

  // App
  APP_NAME: Env.schema.string.optional(),
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Sessione
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Database PostgreSQL
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  // Login
  AUTH_MODE: Env.schema.enum(['oidc', 'dev'] as const),
  OIDC_ISSUER: Env.schema.string.optional(),
  OIDC_CLIENT_ID: Env.schema.string.optional(),
  OIDC_CLIENT_SECRET: Env.schema.secret.optional(),
  OIDC_REDIRECT_URI: Env.schema.string.optional(),
  OIDC_POST_LOGOUT_REDIRECT_URI: Env.schema.string.optional(),
  OIDC_SCOPES: Env.schema.string.optional(),
  ADMIN_EMAILS: Env.schema.string.optional(),

  // Job pianificati (snapshot settimanali). Disattivati nei test.
  SCHEDULER_ATTIVO: Env.schema.boolean.optional(),
})

controllaConfigurazioneAvvio({
  NODE_ENV: env.get('NODE_ENV'),
  AUTH_MODE: env.get('AUTH_MODE'),
  OIDC_ISSUER: env.get('OIDC_ISSUER'),
  OIDC_CLIENT_ID: env.get('OIDC_CLIENT_ID'),
  OIDC_REDIRECT_URI: env.get('OIDC_REDIRECT_URI'),
})

export default env
