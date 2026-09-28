/// <reference lib="dom" />
/**
 * Screenshot di pagine × ruoli in screenshots/<ruolo>/<pagina>-<tema>.png
 */
import { test } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const RUOLI = ['pm1', 'mec1', 'direzione', 'admin'] as const
const PAGINE: { nome: string; percorso: string; soloAdmin?: boolean }[] = [
  { nome: 'home', percorso: '/' },
  { nome: 'commessa', percorso: '/commesse/1' },
  { nome: 'kanban', percorso: '/commesse/1/flusso' },
  { nome: 'portafoglio', percorso: '/portafoglio' },
  { nome: 'anagrafica', percorso: '/commesse/1/anagrafica' },
  { nome: 'lookahead', percorso: '/commesse/1/lps/lookahead' },
  { nome: 'settimana', percorso: '/commesse/1/lps/settimana' },
  { nome: 'evm', percorso: '/commesse/1/evm' },
  { nome: 'ore', percorso: '/ore' },
  { nome: 'admin', percorso: '/admin', soloAdmin: true },
]

test.describe.configure({ mode: 'serial' })

test('pagina di accesso', async ({ page }) => {
  mkdirSync('screenshots', { recursive: true })
  await page.goto('/accesso')
  await page.screenshot({ path: 'screenshots/accesso-chiaro.png', fullPage: true })
})

for (const ruolo of RUOLI) {
  test(`pagine per ${ruolo}`, async ({ page }) => {
    mkdirSync(`screenshots/${ruolo}`, { recursive: true })
    await page.goto(`/dev/login?come=${ruolo}`)
    for (const p of PAGINE) {
      if (p.soloAdmin && ruolo !== 'admin') continue
      for (const tema of ['chiaro', 'scuro'] as const) {
        await page.emulateMedia({ colorScheme: tema === 'scuro' ? 'dark' : 'light' })
        await page.goto(p.percorso)
        await page.evaluate(() => document.fonts.ready)
        await page.screenshot({
          path: `screenshots/${ruolo}/${p.nome}-${tema}.png`,
          fullPage: true,
        })
      }
    }
  })
}
