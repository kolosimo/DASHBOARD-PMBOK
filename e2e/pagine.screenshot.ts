/// <reference lib="dom" />
/**
 * Screenshot di pagine × ruoli in screenshots/<ruolo>/<pagina>-<tema>.png
 */
import { test } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const RUOLI = ['pm1', 'mec1', 'direzione', 'admin'] as const
interface Pagina {
  nome: string
  /** Percorso fisso, oppure link da seguire su un'altra pagina (id non noti a priori) */
  percorso: string
  link?: string
  soloAdmin?: boolean
  soloRuoli?: readonly string[]
}

const PAGINE: Pagina[] = [
  { nome: 'home', percorso: '/' },
  { nome: 'commessa', percorso: '/commesse/1' },
  { nome: 'kanban', percorso: '/commesse/1/flusso' },
  {
    nome: 'scheda-elaborato',
    percorso: '/commesse/1/flusso',
    link: 'link-scheda-ELE-SC-201',
  },
  { nome: 'portafoglio', percorso: '/portafoglio' },
  { nome: 'anagrafica', percorso: '/commesse/1/anagrafica' },
  { nome: 'lookahead', percorso: '/commesse/1/lps/lookahead' },
  { nome: 'settimana', percorso: '/commesse/1/lps/settimana' },
  { nome: 'evm', percorso: '/commesse/1/evm' },
  { nome: 'ore', percorso: '/ore' },
  { nome: 'nuova-commessa', percorso: '/commesse/nuova', soloRuoli: ['pm1', 'admin'] },
  { nome: 'admin', percorso: '/admin', soloAdmin: true },
  { nome: 'admin-utenti', percorso: '/admin/utenti', soloAdmin: true },
  { nome: 'registro', percorso: '/admin/registro', soloAdmin: true },
]

test.describe.configure({ mode: 'serial' })

test('pagina di accesso', async ({ page }) => {
  mkdirSync('screenshots', { recursive: true })
  await page.goto('/accesso')
  await page.screenshot({ path: 'screenshots/accesso-chiaro.png', fullPage: true })
})

test('cambio password al primo accesso (account locale)', async ({ page }) => {
  await page.goto('/dev/login?come=admin')
  await page.goto('/admin/utenti')
  const nuovo = page.getByTestId('nuovo-utente')
  await nuovo.locator('input[name="email"]').fill('pm.screenshot@climosfera.example')
  await nuovo.locator('input[name="nome"]').fill('PM Screenshot')
  await nuovo.getByRole('button', { name: 'Crea utente' }).click()
  await page.screenshot({ path: 'screenshots/admin/utente-creato-chiaro.png', fullPage: true })
  const temporanea = (await page.getByTestId('password-temporanea').textContent())!.trim()
  await page.getByRole('button', { name: 'Esci' }).click()
  const accesso = page.getByTestId('form-accesso-locale')
  await accesso.locator('input[name="email"]').fill('pm.screenshot@climosfera.example')
  await accesso.locator('input[name="password"]').fill(temporanea)
  await accesso.getByRole('button', { name: 'Accedi' }).click()
  await page.waitForURL(/cambia-password/)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'screenshots/cambia-password-chiaro.png', fullPage: true })
})

for (const ruolo of RUOLI) {
  test(`pagine per ${ruolo}`, async ({ page }) => {
    mkdirSync(`screenshots/${ruolo}`, { recursive: true })
    await page.goto(`/dev/login?come=${ruolo}`)
    for (const p of PAGINE) {
      if (p.soloAdmin && ruolo !== 'admin') continue
      if (p.soloRuoli && !p.soloRuoli.includes(ruolo)) continue
      for (const tema of ['chiaro', 'scuro'] as const) {
        await page.emulateMedia({ colorScheme: tema === 'scuro' ? 'dark' : 'light' })
        await page.goto(p.percorso)
        if (p.link) {
          const href = await page.getByTestId(p.link).getAttribute('href')
          await page.goto(href!)
        }
        await page.evaluate(() => document.fonts.ready)
        await page.screenshot({
          path: `screenshots/${ruolo}/${p.nome}-${tema}.png`,
          fullPage: true,
        })
      }
    }
  })
}
