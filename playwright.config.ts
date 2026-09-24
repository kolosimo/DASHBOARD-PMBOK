/**
 * Playwright: smoke test end-to-end (npm run e2e).
 * I browser non si scaricano: si usa il Chromium già installato
 * (PLAYWRIGHT_BROWSERS_PATH, oppure PLAYWRIGHT_CHROMIUM_PATH per un binario preciso).
 * La versione di @playwright/test è fissata per combaciare con quel Chromium.
 * Il DB e2e (E2E_DB_DATABASE, default cruscotto_e2e) si ricrea a ogni esecuzione.
 */
import { defineConfig, devices } from '@playwright/test'
import { AMBIENTE_SERVER, BASE_URL, percorsoChromium } from './e2e/ambiente.js'

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.smoke\.ts$/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath: percorsoChromium() },
      },
    },
  ],
  webServer: {
    // Prima ricrea il DB e2e con i dati di esempio, poi avvia il server
    command: `"${process.execPath}" ace migration:fresh --force --seed && "${process.execPath}" --import=@poppinss/ts-exec bin/server.ts`,
    url: `${BASE_URL}/accesso`,
    env: AMBIENTE_SERVER,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
