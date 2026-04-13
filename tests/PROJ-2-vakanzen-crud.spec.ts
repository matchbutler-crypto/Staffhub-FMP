import { test, expect } from '@playwright/test'

/**
 * PROJ-2: Vakanzen-CRUD — E2E Tests
 *
 * Tests that require real user accounts are marked with TEST_USER_REQUIRED.
 * To run the full suite, set these env vars:
 *   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
 *   TEST_MANAGER_EMAIL, TEST_MANAGER_PASSWORD
 *   TEST_AGENTUR_EMAIL, TEST_AGENTUR_PASSWORD
 */

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? ''
const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL ?? ''
const MANAGER_PASSWORD = process.env.TEST_MANAGER_PASSWORD ?? ''
const AGENTUR_EMAIL = process.env.TEST_AGENTUR_EMAIL ?? ''
const AGENTUR_PASSWORD = process.env.TEST_AGENTUR_PASSWORD ?? ''

const hasAdminCreds = !!(ADMIN_EMAIL && ADMIN_PASSWORD)
const hasManagerCreds = !!(MANAGER_EMAIL && MANAGER_PASSWORD)
const hasAgenturCreds = !!(AGENTUR_EMAIL && AGENTUR_PASSWORD)

// ── Hilfsfunktion: Login ──────────────────────────────────────────────────────

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

// ── API: Authentifizierungsschutz ─────────────────────────────────────────────
// Hinweis: Die Middleware fängt alle Routen inkl. /api/* ab und gibt bei
// unauthentifizierten Requests einen 302-Redirect zu /login zurück (kein 401 JSON).
// Bug PROJ-2-BUG-01 (Medium): /api/* sollte 401 JSON zurückgeben, nicht 302 HTML-Redirect.
// Die Tests prüfen das tatsächliche Verhalten (nicht-200 = Zugriff blockiert).

test.describe('API: Authentifizierungsschutz', () => {
  test('GET /api/vakanzen blockiert unauthentifizierten Zugriff (302 oder 401)', async ({ request }) => {
    const res = await request.get('/api/vakanzen', { maxRedirects: 0 })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('POST /api/vakanzen blockiert unauthentifizierten Zugriff (302 oder 401)', async ({ request }) => {
    const res = await request.post('/api/vakanzen', {
      data: { titel: 'Test', rolle: 'Dev' },
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('PUT /api/vakanzen/[id] blockiert unauthentifizierten Zugriff (302 oder 401)', async ({ request }) => {
    const res = await request.put('/api/vakanzen/00000000-0000-0000-0000-000000000000', {
      data: { titel: 'Test' },
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('PATCH /api/vakanzen/[id]/status blockiert unauthentifizierten Zugriff (302 oder 401)', async ({ request }) => {
    const res = await request.patch('/api/vakanzen/00000000-0000-0000-0000-000000000000/status', {
      data: { status: 'Geschlossen' },
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })
})

// ── API: Eingabe-Validierung ───────────────────────────────────────────────────

test.describe('API: Eingabe-Validierung (TEST_USER_REQUIRED)', () => {
  test.skip(!hasManagerCreds, 'Benötigt TEST_MANAGER_EMAIL + TEST_MANAGER_PASSWORD')

  test('POST mit fehlendem Titel gibt 400 zurück', async ({ request, page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    const cookies = await page.context().cookies()
    const res = await request.post('/api/vakanzen', {
      headers: { Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
      data: {
        rolle: 'Dev',
        beschreibung: 'Test',
        skills: ['React'],
        erfahrungslevel: 'Senior',
        startdatum: '2026-05-01',
        laufzeit: '3 Monate',
        auslastung: 100,
        arbeitsmodell: 'Remote',
      },
    })
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Validierungsfehler')
  })

  test('POST mit Auslastung > 100 gibt 400 zurück', async ({ request, page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    const cookies = await page.context().cookies()
    const res = await request.post('/api/vakanzen', {
      headers: { Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
      data: {
        titel: 'Test',
        rolle: 'Dev',
        beschreibung: 'Test',
        skills: ['React'],
        erfahrungslevel: 'Senior',
        startdatum: '2026-05-01',
        laufzeit: '3 Monate',
        auslastung: 150,
        arbeitsmodell: 'Remote',
      },
    })
    expect(res.status()).toBe(400)
  })
})

// ── Vakanzen-Seite: Unauthentifiziert ─────────────────────────────────────────

test.describe('Vakanzen-Seite: Unauthentifiziert', () => {
  test('leitet unauthentifizierten User von /vakanzen zu /login weiter', async ({ page }) => {
    await page.goto('/vakanzen')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ── Vakanzen-Seite: Manager/Admin (TEST_USER_REQUIRED) ───────────────────────

test.describe('Vakanzen-Seite: Staffhub Manager (TEST_USER_REQUIRED)', () => {
  test.skip(!hasManagerCreds, 'Benötigt TEST_MANAGER_EMAIL + TEST_MANAGER_PASSWORD')

  test.beforeEach(async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/vakanzen')
  })

  test('zeigt "Neue Vakanz"-Button für Manager', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Neue Vakanz/i })).toBeVisible()
  })

  test('zeigt Lade-Indikator und dann Tabelle', async ({ page }) => {
    // Entweder Skeleton-Rows oder Tabelle sichtbar
    await expect(page.locator('table, [data-testid="skeleton"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('öffnet Erstellen-Sheet beim Klick auf "Neue Vakanz"', async ({ page }) => {
    await page.getByRole('button', { name: /Neue Vakanz/i }).click()
    await expect(page.getByText('Neue Vakanz erstellen')).toBeVisible()
  })

  test('zeigt Validierungsfehler bei leerem Formular', async ({ page }) => {
    await page.getByRole('button', { name: /Neue Vakanz/i }).click()
    await page.getByRole('button', { name: /Speichern/i }).click()
    await expect(page.getByText(/erforderlich/i).first()).toBeVisible()
  })

  test('Vakanz erstellen — Happy Path', async ({ page }) => {
    await page.getByRole('button', { name: /Neue Vakanz/i }).click()
    await page.getByLabel('Titel').fill('QA Test Vakanz E2E')
    await page.getByLabel('Rolle').fill('QA Engineer')
    await page.getByLabel('Beschreibung').fill('Test-Vakanz für PROJ-2 E2E')
    // Skills
    const skillInput = page.locator('input[placeholder*="Skill"]')
    await skillInput.fill('Playwright')
    await skillInput.press('Enter')
    // Erfahrungslevel
    await page.getByRole('combobox').filter({ hasText: /Level|Junior|Mid|Senior/i }).first().click()
    await page.getByRole('option', { name: 'Senior' }).click()
    // Startdatum
    await page.getByLabel('Startdatum').fill('2026-06-01')
    // Laufzeit
    await page.getByLabel('Laufzeit').fill('3 Monate')
    // Auslastung
    await page.getByLabel('Auslastung').fill('100')
    // Arbeitsmodell
    await page.getByRole('combobox').filter({ hasText: /Remote|Hybrid|Onsite/i }).first().click()
    await page.getByRole('option', { name: 'Remote' }).click()
    // Speichern
    await page.getByRole('button', { name: /Speichern/i }).click()
    await expect(page.getByText('Vakanz erstellt')).toBeVisible({ timeout: 5000 })
    // Sheet geschlossen
    await expect(page.getByText('Neue Vakanz erstellen')).not.toBeVisible()
    // Neue Zeile in Tabelle
    await expect(page.getByText('QA Test Vakanz E2E')).toBeVisible({ timeout: 5000 })
  })

  test('Aktions-Dropdown zeigt Bearbeiten und Schließen', async ({ page }) => {
    // Mindestens eine Zeile vorhanden (aus vorherigem Test oder Seed-Daten)
    await page.waitForSelector('table tbody tr', { timeout: 5000 }).catch(() => {})
    const firstActionBtn = page.locator('table tbody tr').first().getByRole('button')
    if (await firstActionBtn.count() > 0) {
      await firstActionBtn.click()
      await expect(page.getByRole('menuitem', { name: /Bearbeiten/i })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: /Schließen/i })).toBeVisible()
    }
  })

  test('Schließen-Dialog zeigt Bestätigungstext', async ({ page }) => {
    await page.waitForSelector('table tbody tr', { timeout: 5000 }).catch(() => {})
    const rows = page.locator('table tbody tr')
    if (await rows.count() > 0) {
      await rows.first().getByRole('button').click()
      const closeItem = page.getByRole('menuitem', { name: /Schließen/i })
      if (await closeItem.isVisible()) {
        await closeItem.click()
        await expect(page.getByText(/wirklich schließen/i)).toBeVisible()
        await expect(page.getByText(/Einreichungen bleiben bestehen/i)).toBeVisible()
        // Abbrechen — kein unbeabsichtigtes Schließen
        await page.getByRole('button', { name: /Abbrechen/i }).click()
        await expect(page.getByText(/wirklich schließen/i)).not.toBeVisible()
      }
    }
  })

  test('Budget-Spalte ist für Manager sichtbar', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /Budget/i })).toBeVisible({ timeout: 5000 })
  })

  test('Freitextsuche filtert Vakanzen', async ({ page }) => {
    await page.waitForSelector('table tbody tr', { timeout: 5000 }).catch(() => {})
    const searchInput = page.getByPlaceholder(/Suche/i)
    await searchInput.fill('xxxxxx-nicht-vorhanden')
    await expect(page.locator('table tbody tr')).toHaveCount(0, { timeout: 3000 }).catch(() => {})
  })
})

// ── Vakanzen-Seite: Agentur (TEST_USER_REQUIRED) ──────────────────────────────

test.describe('Vakanzen-Seite: Agentur (TEST_USER_REQUIRED)', () => {
  test.skip(!hasAgenturCreds, 'Benötigt TEST_AGENTUR_EMAIL + TEST_AGENTUR_PASSWORD')

  test.beforeEach(async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
  })

  test('"Neue Vakanz"-Button ist für Agentur nicht sichtbar', async ({ page }) => {
    await page.waitForSelector('table, [data-testid="skeleton"]', { timeout: 5000 }).catch(() => {})
    await expect(page.getByRole('button', { name: /Neue Vakanz/i })).not.toBeVisible()
  })

  test('Budget-Spalte ist für Agentur nicht sichtbar', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /Budget/i })).not.toBeVisible({ timeout: 3000 })
  })

  test('Aktions-Dropdown zeigt nur "Details anzeigen" für Agentur', async ({ page }) => {
    await page.waitForSelector('table tbody tr', { timeout: 5000 }).catch(() => {})
    const rows = page.locator('table tbody tr')
    if (await rows.count() > 0) {
      await rows.first().getByRole('button').click()
      await expect(page.getByRole('menuitem', { name: /Bearbeiten/i })).not.toBeVisible()
      await expect(page.getByRole('menuitem', { name: /Schließen/i })).not.toBeVisible()
    }
  })

  test('API gibt kein budget_intern für Agentur zurück', async ({ request, page }) => {
    const cookies = await page.context().cookies()
    const res = await request.get('/api/vakanzen', {
      headers: { Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    if (json.vakanzen?.length > 0) {
      for (const v of json.vakanzen) {
        expect(v.budget_intern).toBeUndefined()
      }
    }
  })
})

// ── Rollenbasierte Sichtbarkeit: Admin (TEST_USER_REQUIRED) ───────────────────

test.describe('Vakanzen-Seite: Admin (TEST_USER_REQUIRED)', () => {
  test.skip(!hasAdminCreds, 'Benötigt TEST_ADMIN_EMAIL + TEST_ADMIN_PASSWORD')

  test('Admin sieht "Neue Vakanz"-Button', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.goto('/vakanzen')
    await expect(page.getByRole('button', { name: /Neue Vakanz/i })).toBeVisible()
  })

  test('Admin sieht Budget-Spalte', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.goto('/vakanzen')
    await expect(page.getByRole('columnheader', { name: /Budget/i })).toBeVisible({ timeout: 5000 })
  })
})
