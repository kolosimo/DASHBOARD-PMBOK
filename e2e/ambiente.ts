/**
 * Ambiente del server usato da Playwright (smoke e screenshot).
 * Database dedicato, ricreato con i dati di esempio a ogni esecuzione:
 *   E2E_DB_DATABASE (default cruscotto_e2e), E2E_PORT (default 3334).
 */
import { randomBytes } from 'node:crypto'

export const PORTA = Number(process.env.E2E_PORT ?? 3334)
export const BASE_URL = `http://localhost:${PORTA}`

export const AMBIENTE_SERVER: Record<string, string> = {
  NODE_ENV: 'development',
  DEV_MODE: 'true',
  TZ: 'UTC',
  HOST: 'localhost',
  PORT: String(PORTA),
  LOG_LEVEL: 'warn',
  APP_NAME: 'cruscotto-commesse',
  APP_KEY: process.env.APP_KEY ?? randomBytes(32).toString('base64url'),
  APP_URL: BASE_URL,
  SESSION_DRIVER: 'cookie',
  DB_HOST: process.env.DB_HOST ?? '127.0.0.1',
  DB_PORT: process.env.DB_PORT ?? '5432',
  DB_USER: process.env.DB_USER ?? 'cruscotto',
  DB_PASSWORD: process.env.DB_PASSWORD ?? 'cruscotto',
  DB_DATABASE: process.env.E2E_DB_DATABASE ?? 'cruscotto_e2e',
  AUTH_MODE: 'dev',
  SCHEDULER_ATTIVO: 'false',
}

/** Chromium già presente nel container (non si esegue "playwright install") */
export function percorsoChromium(): string | undefined {
  return process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined
}
