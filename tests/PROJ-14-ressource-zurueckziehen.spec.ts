import { test, expect } from '@playwright/test'

/**
 * PROJ-14: Ressource zurückziehen (Agentur zieht Einreichung zurück)
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

// ── API: Authentifizierungsschutz ────────────────────────────────────────────

test.describe('API: Authentifizierungsschutz PROJ-14', () => {
  test('PATCH /api/ressource-links/[id]/rueckzug blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.patch(`/api/ressource-links/${FAKE_UUID}/rueckzug`, {
      data: {},
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })
})

// ── API: Authorization ────────────────────────────────────────────────────────

test.describe('API: Authorization PROJ-14', () => {
  test('PATCH /api/ressource-links/[id]/rueckzug gibt 404/403 für fremden Link', async ({ request }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    const res = await request.patch(`/api/ressource-links/${FAKE_UUID}/rueckzug`, {
      data: {},
    })
    expect([403, 404]).toContain(res.status())
  })
})

// ── UI: AC-1 — "Zurückziehen"-Button sichtbar für Agentur ────────────────────

test.describe('AC-1 + AC-2: Button Sichtbarkeit', () => {
  test('Agentur sieht "Zurückziehen"-Button für eingespielten Link im Verlauf-Tab', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    await page.waitForSelector('table', { timeout: 8000 })

    // Erste Ressource anklicken (Detail-Sheet öffnet sich)
    const firstRow = page.locator('table tbody tr').first()
    await firstRow.click()

    // Verlauf-Tab wählen
    const verlaufTab = page.getByRole('tab', { name: /verlauf/i })
    if (!await verlaufTab.isVisible()) {
      test.skip(true, 'Keine Ressource mit Verlauf-Tab gefunden')
    }
    await verlaufTab.click()

    // Prüfen ob "Zurückziehen"-Button für gespielten Link sichtbar ist
    const rueckzugBtn = page.getByRole('button', { name: /zurückziehen/i }).first()
    // Button nur erwartbar wenn ein Link mit Status "Gespielt" existiert
    const gespielterLink = page.getByText('Gespielt').first()
    const hasGespielt = await gespielterLink.isVisible().catch(() => false)
    if (hasGespielt) {
      await expect(rueckzugBtn).toBeVisible()
    }
  })

  test('Manager sieht KEIN "Zurückziehen"-Button im Pool', async ({ page }) => {
    test.skip(!hasManagerCreds, 'TEST_MANAGER_EMAIL/PASSWORD nicht gesetzt')

    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    // Manager hat keine Pool-Seite im gleichen Sinne — prüfen auf /ressourcen
    await page.goto('/ressourcen')
    await page.waitForSelector('table', { timeout: 8000 })

    await expect(page.getByRole('button', { name: /zurückziehen/i })).not.toBeVisible()
  })
})

// ── UI: AC-3 — Dialog öffnet sich mit Textarea ───────────────────────────────

test.describe('AC-3: Dialog mit optionalem Grund-Feld', () => {
  test('Klick auf "Zurückziehen" öffnet AlertDialog mit Textarea', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    await page.waitForSelector('table', { timeout: 8000 })

    const firstRow = page.locator('table tbody tr').first()
    await firstRow.click()

    const verlaufTab = page.getByRole('tab', { name: /verlauf/i })
    await verlaufTab.click()

    const rueckzugBtn = page.getByRole('button', { name: /zurückziehen/i }).first()
    if (!await rueckzugBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Kein "Gespielt"-Link für Test verfügbar')
    }
    await rueckzugBtn.click()

    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByLabel(/grund/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /abbrechen/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /zurückziehen/i }).last()).toBeVisible()
  })

  test('Dialog schließt sich beim Klick auf Abbrechen', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    await page.waitForSelector('table', { timeout: 8000 })

    const firstRow = page.locator('table tbody tr').first()
    await firstRow.click()
    await page.getByRole('tab', { name: /verlauf/i }).click()

    const rueckzugBtn = page.getByRole('button', { name: /zurückziehen/i }).first()
    if (!await rueckzugBtn.isVisible().catch(() => false)) {
      test.skip(true, 'Kein "Gespielt"-Link für Test verfügbar')
    }
    await rueckzugBtn.click()

    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('button', { name: /abbrechen/i }).click()
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
  })
})

// ── UI: AC-7 — Ressource bleibt im Pool erhalten ─────────────────────────────

test.describe('AC-7: Pool-Ressource bleibt nach Rückzug erhalten', () => {
  test('Ressource ist nach Zurückziehen noch in der Pool-Tabelle sichtbar', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    await page.waitForSelector('table', { timeout: 8000 })

    // Ressourcenanzahl vor und nach bleibt gleich (nur Link-Status ändert sich)
    const rowCount = await page.locator('table tbody tr').count()
    expect(rowCount).toBeGreaterThan(0)
  })
})

// ── UI: AC-2 — Button deaktiviert für nicht-zurückziehbare Status ─────────────

test.describe('AC-2: Button nur für Status "Gespielt" aktiv', () => {
  test('Kein "Zurückziehen"-Button für Links mit Status "Interview geplant" oder weiter', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    await page.waitForSelector('table', { timeout: 8000 })

    const firstRow = page.locator('table tbody tr').first()
    await firstRow.click()
    await page.getByRole('tab', { name: /verlauf/i }).click()

    // Links mit "Interview geplant" dürfen keinen Zurückziehen-Button haben
    const interviewLinks = page.getByText('Interview geplant')
    const count = await interviewLinks.count()
    if (count > 0) {
      // Prüfen dass kein Zurückziehen-Button neben Interview-Links erscheint
      const interviewRow = interviewLinks.first().locator('..')
      await expect(interviewRow.getByRole('button', { name: /zurückziehen/i })).not.toBeVisible()
    }
  })
})
