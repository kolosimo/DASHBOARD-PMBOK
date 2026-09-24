/**
 * npm run screenshot: pagine × ruoli, tema chiaro e scuro, in screenshots/
 * (cartella ignorata da git).
 */
import { defineConfig } from '@playwright/test'
import base from './playwright.config.js'

export default defineConfig({
  ...base,
  testMatch: /screenshot\.ts$/,
  outputDir: 'test-results/screenshot',
})
