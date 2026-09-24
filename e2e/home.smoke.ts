/// <reference lib="dom" />
import { test, expect } from '@playwright/test'

test('login di sviluppo → home con le commesse del seed', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/accesso$/)
  await expect(page.getByRole('heading', { name: 'Login di sviluppo' })).toBeVisible()

  await page.getByTestId('dev-pm1').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('utente-nome')).toHaveText('PM 1')

  const elenco = page.getByTestId('elenco-commesse')
  await expect(elenco).toContainText('CL-2026-031')
  await expect(elenco).toContainText('Scuola primaria – impianti meccanici ed elettrici')
  await expect(elenco).toContainText('CL-2025-077')
  await expect(elenco).not.toContainText('CL-2026-018')

  // Apertura della commessa: schede del modulo e canale in tempo reale
  await page.getByRole('link', { name: 'CL-2026-031' }).click()
  await expect(page.getByRole('navigation', { name: 'Schede della commessa' })).toBeVisible()
  await expect(page.getByTestId('segnaposto')).toBeVisible()
  await expect(page.locator('#stato-connessione')).toHaveText(/tempo reale|30 s/, {
    timeout: 10_000,
  })

  // Uscita
  await page.getByRole('button', { name: 'Esci' }).click()
  await expect(page).toHaveURL(/\/accesso\?uscito=1$/)
})

test('la direzione vede tutte e tre le commesse', async ({ page }) => {
  await page.goto('/dev/login?come=direzione')
  const elenco = page.getByTestId('elenco-commesse')
  for (const codice of ['CL-2026-031', 'CL-2026-018', 'CL-2025-077']) {
    await expect(elenco).toContainText(codice)
  }
})

test('font e CSS del prototipo caricati', async ({ page }) => {
  await page.goto('/dev/login?come=mec1')
  const famiglia = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  expect(famiglia).toContain('IBM Plex Sans')
  await page.evaluate(() => document.fonts.ready)
  const caricato = await page.evaluate(() => document.fonts.check('14px "IBM Plex Sans"'))
  expect(caricato).toBe(true)
})
