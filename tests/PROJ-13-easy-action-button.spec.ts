import { test, expect } from '@playwright/test'

/**
 * PROJ-13: Easy Action Button – Ressource auf Vakanz spielen aus Vakanz-Ansicht
 *
 * Tests requiring real credentials are skipped when env vars are absent:
 *   TEST_AGENTUR_EMAIL, TEST_AGENTUR_PASSWORD
 *   TEST_MANAGER_EMAIL, TEST_MANAGER_PASSWORD
 */

const AGENTUR_EMAIL = process.env.TEST_AGENTUR_EMAIL ?? ''
const AGENTUR_PASSWORD = process.env.TEST_AGENTUR_PASSWORD ?? ''
const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL ?? ''
const MANAGER_PASSWORD = process.env.TEST_MANAGER_PASSWORD ?? ''

const hasAgenturCreds = !!(AGENTUR_EMAIL && AGENTUR_PASSWORD)
const hasManagerCreds = !!(MANAGER_EMAIL && MANAGER_PASSWORD)

const FAKE_UUID = '00000000-0000-0000-0000-000000000001'

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

// ── API: Security (no auth) ───────────────────────────────────────────────────

test.describe('API: Authentifizierungsschutz PROJ-13', () => {
  test('GET /api/ressourcen?vakanz_id blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.get(`/api/ressourcen?vakanz_id=${FAKE_UUID}`, {
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('POST /api/ressourcen/[id]/spielen blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.post(`/api/ressourcen/${FAKE_UUID}/spielen`, {
      data: { vakanz_id: FAKE_UUID },
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })
})

// ── API: Authorization ────────────────────────────────────────────────────────

test.describe('API: Authorization PROJ-13', () => {
  test('POST /api/ressourcen/[id]/spielen gibt 403 für fremde Ressource', async ({ request }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    // Authenticate first
    const context = await request.newContext()
    await context.post('/api/auth/login', {
      data: { email: AGENTUR_EMAIL, password: AGENTUR_PASSWORD },
    }).catch(() => {})

    // Try to play a fake UUID (won't belong to this agentur)
    const res = await context.post(`/api/ressourcen/${FAKE_UUID}/spielen`, {
      data: { vakanz_id: FAKE_UUID },
    })
    // Should be 404 (resource not found) or 403 (no permission)
    expect([403, 404]).toContain(res.status())
  })
})

// ── UI: Agentur sieht "Ressource einsetzen" in Vakanz-Tabelle ─────────────────

test.describe('AC-1 + AC-7: Button Sichtbarkeit', () => {
  test('Agentur sieht "Ressource einsetzen" in der Vakanzliste', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForSelector('table', { timeout: 8000 })

    // Click the three-dot menu on the first row
    const firstDotsBtn = page.locator('button[aria-label="Aktionen"]').first()
    await firstDotsBtn.click()

    // "Ressource einsetzen" should appear in dropdown
    await expect(page.getByRole('menuitem', { name: /ressource einsetzen/i })).toBeVisible()
  })

  test('Manager sieht KEIN "Ressource einsetzen" in der Vakanzliste', async ({ page }) => {
    test.skip(!hasManagerCreds, 'TEST_MANAGER_EMAIL/PASSWORD nicht gesetzt')

    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForSelector('table', { timeout: 8000 })

    const firstDotsBtn = page.locator('button[aria-label="Aktionen"]').first()
    await firstDotsBtn.click()

    await expect(page.getByRole('menuitem', { name: /ressource einsetzen/i })).not.toBeVisible()
  })
})

// ── UI: Dialog öffnet sich mit zwei Tabs ─────────────────────────────────────

test.describe('AC-2: Dialog mit zwei Tabs', () => {
  test('Klick auf "Ressource einsetzen" öffnet Dialog mit Tabs', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForSelector('table', { timeout: 8000 })

    // Find an open vacancy and open its dropdown
    const firstDotsBtn = page.locator('button[aria-label="Aktionen"]').first()
    await firstDotsBtn.click()

    const einsetzenItem = page.getByRole('menuitem', { name: /ressource einsetzen/i })
    if (await einsetzenItem.isDisabled()) {
      test.skip(true, 'Keine offene Vakanz vorhanden')
    }
    await einsetzenItem.click()

    // Dialog should open with two tabs
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('tab', { name: /aus pool auswählen/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /neu anlegen/i })).toBeVisible()
  })
})

// ── UI: Tab "Aus Pool auswählen" ──────────────────────────────────────────────

test.describe('AC-3: Tab "Aus Pool auswählen"', () => {
  test('Pool-Tab zeigt Suchfeld und Ressourcen-Liste', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForSelector('table', { timeout: 8000 })

    const firstDotsBtn = page.locator('button[aria-label="Aktionen"]').first()
    await firstDotsBtn.click()

    const einsetzenItem = page.getByRole('menuitem', { name: /ressource einsetzen/i })
    if (await einsetzenItem.isDisabled()) {
      test.skip(true, 'Keine offene Vakanz vorhanden')
    }
    await einsetzenItem.click()

    await expect(page.getByRole('dialog')).toBeVisible()
    // Pool tab is active by default
    await expect(page.getByPlaceholder(/name oder skill suchen/i)).toBeVisible()
  })
})

// ── UI: Tab "Neu anlegen" ─────────────────────────────────────────────────────

test.describe('AC-4: Tab "Neu anlegen"', () => {
  test('"Neu anlegen"-Tab zeigt Ressource-Formular', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForSelector('table', { timeout: 8000 })

    const firstDotsBtn = page.locator('button[aria-label="Aktionen"]').first()
    await firstDotsBtn.click()

    const einsetzenItem = page.getByRole('menuitem', { name: /ressource einsetzen/i })
    if (await einsetzenItem.isDisabled()) {
      test.skip(true, 'Keine offene Vakanz vorhanden')
    }
    await einsetzenItem.click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('tab', { name: /neu anlegen/i }).click()

    await expect(page.getByLabel(/name/i)).toBeVisible()
    await expect(page.getByLabel(/skills/i)).toBeVisible()
    await expect(page.getByLabel(/erfahrungslevel/i)).toBeVisible()
    await expect(page.getByLabel(/verfügbarkeit/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /anlegen & einsetzen/i })).toBeVisible()
  })

  test('"Neu anlegen" validiert leere Felder', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForSelector('table', { timeout: 8000 })

    const firstDotsBtn = page.locator('button[aria-label="Aktionen"]').first()
    await firstDotsBtn.click()

    const einsetzenItem = page.getByRole('menuitem', { name: /ressource einsetzen/i })
    if (await einsetzenItem.isDisabled()) {
      test.skip(true, 'Keine offene Vakanz vorhanden')
    }
    await einsetzenItem.click()

    await page.getByRole('tab', { name: /neu anlegen/i }).click()
    await page.getByRole('button', { name: /anlegen & einsetzen/i }).click()

    // Should show validation error
    await expect(page.getByText(/name ist erforderlich/i)).toBeVisible()
  })
})

// ── UI: Dialog schließt bei Abbrechen ─────────────────────────────────────────

test.describe('AC-6: Dialog Abbrechen', () => {
  test('Dialog schließt sich beim Klick auf Abbrechen', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForSelector('table', { timeout: 8000 })

    const firstDotsBtn = page.locator('button[aria-label="Aktionen"]').first()
    await firstDotsBtn.click()

    const einsetzenItem = page.getByRole('menuitem', { name: /ressource einsetzen/i })
    if (await einsetzenItem.isDisabled()) {
      test.skip(true, 'Keine offene Vakanz vorhanden')
    }
    await einsetzenItem.click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /abbrechen/i }).first().click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})

// ── UI: Leer-Zustand ──────────────────────────────────────────────────────────

test.describe('Edge Case: Leerer Pool', () => {
  test('Dialog zeigt Leer-Zustand mit CTA wenn kein Pool vorhanden', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    await page.waitForSelector('table', { timeout: 8000 })

    const firstDotsBtn = page.locator('button[aria-label="Aktionen"]').first()
    await firstDotsBtn.click()

    const einsetzenItem = page.getByRole('menuitem', { name: /ressource einsetzen/i })
    if (await einsetzenItem.isDisabled()) {
      test.skip(true, 'Keine offene Vakanz vorhanden')
    }
    await einsetzenItem.click()

    await expect(page.getByRole('dialog')).toBeVisible()
    // If pool is empty, should show "Erste Ressource anlegen" CTA
    const leerText = page.getByText(/noch keine pool-ressourcen/i)
    const listItems = page.locator('[role="dialog"] button').filter({ hasText: /verfügbar/i })
    const hasItems = await listItems.count() > 0
    if (!hasItems) {
      await expect(leerText).toBeVisible()
    }
  })
})
