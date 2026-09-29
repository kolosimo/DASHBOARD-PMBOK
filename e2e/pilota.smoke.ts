/// <reference lib="dom" />
/**
 * Scenario del pilota (Fase 2): l'admin crea un PM con account locale; il PM
 * entra, cambia la password, apre una commessa vuota, aggiunge due elaborati,
 * apre l'Obeya (stato vuoto), registra 2 ore e sposta un elaborato nel Kanban.
 *
 * Il server e2e gira con AUTH_MODE=dev: l'accesso a password è attivo insieme
 * al login di sviluppo, che qui serve solo per l'admin.
 */
import { test, expect, type Page } from '@playwright/test'

const EMAIL = 'pm.pilota@climosfera.example'
const NUOVA_PASSWORD = 'una frase lunga per il pilota'
const CODICE = 'CL-2026-950'

async function aggiungiElaborato(page: Page, commessaId: string, codice: string, titolo: string) {
  await page.goto(`/commesse/${commessaId}/elaborati/nuovo`)
  const form = page.getByTestId('form-elaborato')
  await form.locator('input[name="codice"]').fill(codice)
  await form.locator('input[name="titolo"]').fill(titolo)
  const disciplina = form.locator('select[name="disciplina_id"]')
  const valore = await disciplina.locator('option:not([value=""])').first().getAttribute('value')
  await disciplina.selectOption(valore!)
  await form.locator('input[name="budget_ore"]').fill('10')
  await form.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(new RegExp(`/commesse/${commessaId}/anagrafica`))
  await expect(page.getByTestId(`elaborato-${codice}`)).toBeVisible()
}

test('pilota: admin crea il PM, il PM avvia una commessa da zero', async ({ page }) => {
  // 1. L'admin crea l'utente PM con password temporanea
  await page.goto('/dev/login?come=admin')
  await page.goto('/admin/utenti')
  const nuovo = page.getByTestId('nuovo-utente')
  await nuovo.locator('input[name="email"]').fill(EMAIL)
  await nuovo.locator('input[name="nome"]').fill('PM Pilota')
  await nuovo.locator('select[name="ruolo"]').selectOption('pm')
  await nuovo.getByRole('button', { name: 'Crea utente' }).click()
  const temporanea = (await page.getByTestId('password-temporanea').textContent())!.trim()
  expect(temporanea.length).toBeGreaterThanOrEqual(12)
  await page.getByRole('button', { name: 'Esci' }).click()
  await expect(page).toHaveURL(/\/accesso/)

  // 2. Il PM entra con la password temporanea e deve cambiarla
  const accesso = page.getByTestId('form-accesso-locale')
  await accesso.locator('input[name="email"]').fill(EMAIL)
  await accesso.locator('input[name="password"]').fill(temporanea)
  await accesso.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/accesso\/cambia-password/)
  const cambio = page.getByTestId('form-cambia-password')
  await expect(cambio.locator('input[name="password_attuale"]')).toHaveCount(0)
  await cambio.locator('input[name="nuova_password"]').fill(NUOVA_PASSWORD)
  await cambio.locator('input[name="conferma_password"]').fill(NUOVA_PASSWORD)
  await cambio.getByRole('button', { name: 'Salva la nuova password' }).click()
  await page.goto('/')
  await expect(page.getByTestId('utente-nome')).toHaveText('PM Pilota')
  await expect(page.getByTestId('cambia-password')).toBeVisible()

  // 3. Commessa vuota aperta dal PM
  await page.getByTestId('apri-nuova-commessa').click()
  const form = page.getByTestId('nuova-commessa')
  await form.locator('input[name="codice"]').fill(CODICE)
  await form.locator('input[name="nome"]').fill('Commessa del pilota')
  await form.locator('input[name="cliente"]').fill('Cliente di prova')
  await form.getByRole('button', { name: 'Crea commessa' }).click()
  await expect(page).toHaveURL(/\/commesse\/\d+\/anagrafica$/)
  const commessaId = page.url().match(/\/commesse\/(\d+)\//)![1]

  // 4. Due elaborati
  await aggiungiElaborato(page, commessaId, 'MEC-01', 'Relazione tecnica impianti meccanici')
  await aggiungiElaborato(page, commessaId, 'MEC-02', 'Schema funzionale centrale termica')

  // 5. Obeya: stato vuoto con i passi mancanti, senza errori
  const errori: string[] = []
  page.on('pageerror', (e) => errori.push(e.message))
  const risposta = await page.goto(`/commesse/${commessaId}`)
  expect(risposta?.status()).toBe(200)
  await expect(page.getByTestId('obeya')).toBeVisible()
  await expect(page.getByTestId('kpi-obeya')).toBeVisible()
  await expect(page.getByTestId('passi-mancanti')).toBeVisible()
  expect(errori).toEqual([])

  // 6. 2 ore sul primo elaborato, nella settimana corrente
  await page.goto('/ore')
  const riga = page.getByTestId('riga-MEC-01')
  const cella = riga.locator('input[data-testid^="cella-"]:not([disabled])').first()
  await cella.fill('2')
  const salvataggio = page.waitForResponse(
    (r) => r.url().endsWith('/ore/celle') && r.request().method() === 'POST'
  )
  await cella.press('Tab')
  expect((await salvataggio).status()).toBe(200)
  await expect(page.getByTestId('totale-riga-MEC-01')).toContainText('2 h', { timeout: 10_000 })
  await page.reload()
  await expect(page.getByTestId('totale-riga-MEC-01')).toContainText('2')

  // 7. Kanban: MEC-02 allo stato successivo
  await page.goto(`/commesse/${commessaId}/flusso`)
  const scheda = page.getByTestId('scheda-MEC-02')
  const colonnaPrima = await scheda
    .locator('xpath=ancestor::*[starts-with(@data-testid, "colonna-")][1]')
    .getAttribute('data-testid')
  await scheda.getByRole('button', { name: 'Porta MEC-02 allo stato successivo' }).click()
  await expect
    .poll(async () =>
      page
        .getByTestId('scheda-MEC-02')
        .locator('xpath=ancestor::*[starts-with(@data-testid, "colonna-")][1]')
        .getAttribute('data-testid')
    )
    .not.toBe(colonnaPrima)
  await page.reload()
  await expect(page.getByTestId('scheda-MEC-02')).toBeVisible()
  expect(errori).toEqual([])
})
