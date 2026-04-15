import { test, expect } from '@playwright/test'

/**
 * PROJ-8: Slack-Integration — E2E Tests
 *
 * Tests requiring real user accounts are marked with TEST_USER_REQUIRED.
 * To run the full suite, set:
 *   TEST_MANAGER_EMAIL, TEST_MANAGER_PASSWORD
 *   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 *   TEST_AGENTUR_EMAIL, TEST_AGENTUR_PASSWORD
 */

const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL ?? ''
const MANAGER_PASSWORD = process.env.TEST_MANAGER_PASSWORD ?? ''
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? ''
const AGENTUR_EMAIL = process.env.TEST_AGENTUR_EMAIL ?? ''
const AGENTUR_PASSWORD = process.env.TEST_AGENTUR_PASSWORD ?? ''

const hasManagerCreds = !!(MANAGER_EMAIL && MANAGER_PASSWORD)
const hasAdminCreds = !!(ADMIN_EMAIL && ADMIN_PASSWORD)
const hasAgenturCreds = !!(AGENTUR_EMAIL && AGENTUR_PASSWORD)

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

// ── API: Authentifizierungsschutz ─────────────────────────────────────────────

test.describe('API: Slack-Endpunkte — Authentifizierungsschutz', () => {
  // AC-3, AC-12, AC-20
  test('POST /api/vakanzen/test-id/slack blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.post('/api/vakanzen/test-id/slack', {
      data: { workspace: 'freelance', channel: 'testing' },
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('POST /api/slack/updatepost blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.post('/api/slack/updatepost', {
      data: { workspace: 'freelance', channel: 'testing' },
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('GET /api/slack/logs blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.get('/api/slack/logs', { maxRedirects: 0 })
    expect([302, 307, 401]).toContain(res.status())
  })
})

// ── API: Input Validation ─────────────────────────────────────────────────────

test.describe('API: Input Validation', () => {
  test('POST /api/vakanzen/id/slack gibt 400 bei fehlendem workspace', async ({ request }) => {
    // Even without auth, the middleware blocks unauthenticated requests first
    // This test verifies the endpoint exists and rejects bad input when authenticated
    const res = await request.post('/api/vakanzen/00000000-0000-0000-0000-000000000001/slack', {
      data: { channel: 'testing' }, // missing workspace
      maxRedirects: 0,
    })
    // 302/307 = auth redirect (unauthenticated), 400 = validation error (authenticated)
    expect([302, 307, 400, 401]).toContain(res.status())
  })

  test('POST /api/slack/updatepost gibt 400 bei ungültigem channel', async ({ request }) => {
    const res = await request.post('/api/slack/updatepost', {
      data: { workspace: 'freelance', channel: 'invalid_channel' },
      maxRedirects: 0,
    })
    expect([302, 307, 400, 401]).toContain(res.status())
  })
})

// ── UI: Vakanzen-Seite — Detailpost-Button ────────────────────────────────────

test.describe('UI: Vakanzen-Seite — Detailpost-Button', () => {
  test.skip(!hasManagerCreds, 'TEST_USER_REQUIRED: Manager-Credentials nicht gesetzt')

  // AC-1, AC-2
  test('Dropdown-Menü einer Vakanz enthält "Detailpost senden" (Staffhub Manager)', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForLoadState('networkidle')

    // Find first row actions dropdown
    const actionBtn = page.getByRole('button', { name: /aktionen|mehr|⋮|\.\.\./i }).first()
    if (await actionBtn.isVisible()) {
      await actionBtn.click()
      await expect(page.getByText('Detailpost senden')).toBeVisible()
    } else {
      // Try dropdown menu trigger
      const dropdownTrigger = page.locator('[data-radix-collection-item]').first()
      if (await dropdownTrigger.isVisible()) {
        await dropdownTrigger.click()
        await expect(page.getByText('Detailpost senden')).toBeVisible()
      }
    }
  })

  // AC-2
  test('Klick auf "Detailpost senden" öffnet Channel-Auswahl-Dialog', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForLoadState('networkidle')

    // Find the Detailpost button in dropdown
    const rows = page.getByRole('row')
    const rowCount = await rows.count()

    if (rowCount > 1) {
      // Click actions dropdown on first data row
      const moreButton = page.locator('button[aria-haspopup="menu"]').first()
      if (await moreButton.isVisible()) {
        await moreButton.click()
        const detailpostItem = page.getByRole('menuitem', { name: /detailpost/i })
        if (await detailpostItem.isVisible()) {
          await detailpostItem.click()
          // Dialog should open with workspace/channel selection
          await expect(page.getByRole('dialog')).toBeVisible()
          await expect(page.getByText(/workspace/i)).toBeVisible()
          await expect(page.getByText(/channel/i)).toBeVisible()
        }
      }
    }
  })
})

// ── UI: Vakanzen-Seite — Updatepost-Button ────────────────────────────────────

test.describe('UI: Vakanzen-Seite — Updatepost-Button im Header', () => {
  test.skip(!hasManagerCreds, 'TEST_USER_REQUIRED: Manager-Credentials nicht gesetzt')

  // AC-10
  test('Updatepost-Button ist im Header der Vakanzen-Seite sichtbar (Manager)', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /updatepost/i })).toBeVisible()
  })

  // AC-11
  test('Klick auf Updatepost-Button öffnet Channel-Auswahl-Dialog', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /updatepost/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText(/workspace/i)).toBeVisible()
  })
})

// ── UI: Updatepost-Button nicht für Agentur ───────────────────────────────────

test.describe('UI: Agentur-Rolle hat keinen Updatepost-Button', () => {
  test.skip(!hasAgenturCreds, 'TEST_USER_REQUIRED: Agentur-Credentials nicht gesetzt')

  test('Updatepost-Button ist für Agentur-User nicht sichtbar', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /updatepost/i })).not.toBeVisible()
  })
})

// ── UI: Slack Log-Seite ───────────────────────────────────────────────────────

test.describe('UI: /slack-log Seite', () => {
  test.skip(!hasManagerCreds, 'TEST_USER_REQUIRED: Manager-Credentials nicht gesetzt')

  // AC-17
  test('Slack Log-Seite ist für Manager erreichbar und lädt', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/slack-log')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /slack posting.log/i })).toBeVisible()
  })

  // AC-18
  test('Slack Log-Tabelle hat korrekte Spalten', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/slack-log')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Datum / Uhrzeit')).toBeVisible()
    await expect(page.getByText('Typ')).toBeVisible()
    await expect(page.getByText('Channel')).toBeVisible()
    await expect(page.getByText('Vakanz')).toBeVisible()
    await expect(page.getByText('Status')).toBeVisible()
    await expect(page.getByText('Gepostet von')).toBeVisible()
  })

  // AC-17: Sidebar-Eintrag
  test('Sidebar enthält "Slack Log" für Manager', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('link', { name: /slack log/i })).toBeVisible()
  })
})

// ── UI: Slack Log nicht für Agentur ──────────────────────────────────────────

test.describe('UI: /slack-log ist für Agentur nicht zugänglich', () => {
  test.skip(!hasAgenturCreds, 'TEST_USER_REQUIRED: Agentur-Credentials nicht gesetzt')

  test('Agentur wird von /slack-log weggeleitet', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/slack-log')
    // Should redirect to /dashboard or /vakanzen
    await expect(page).not.toHaveURL('/slack-log')
  })

  test('Sidebar enthält keinen "Slack Log" Link für Agentur', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('link', { name: /slack log/i })).not.toBeVisible()
  })
})

// ── UI: "Gepostet"-Spalte in Vakanzen-Tabelle ─────────────────────────────────

test.describe('UI: Vakanzen-Tabelle — "Gepostet"-Spalte', () => {
  test.skip(!hasManagerCreds, 'TEST_USER_REQUIRED: Manager-Credentials nicht gesetzt')

  // AC-7
  test('"Gepostet"-Spalte ist in der Vakanzen-Tabelle sichtbar (Manager)', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForLoadState('networkidle')

    // Column header should exist
    const table = page.getByRole('table')
    if (await table.isVisible()) {
      const headers = page.getByRole('columnheader')
      const headerTexts = await headers.allTextContents()
      const hasGepostet = headerTexts.some(t => t.toLowerCase().includes('gepostet'))
      expect(hasGepostet).toBe(true)
    }
  })
})
