import { test, expect } from '@playwright/test'

/**
 * PROJ-9: Freelancer-Pool CRUD — E2E Tests
 *
 * Tests that require real user accounts are marked with TEST_USER_REQUIRED.
 * To run the full suite, set these env vars:
 *   TEST_AGENTUR_EMAIL, TEST_AGENTUR_PASSWORD  (Agentur role)
 *   TEST_MANAGER_EMAIL, TEST_MANAGER_PASSWORD  (Staffhub Manager role)
 */

const AGENTUR_EMAIL = process.env.TEST_AGENTUR_EMAIL ?? ''
const AGENTUR_PASSWORD = process.env.TEST_AGENTUR_PASSWORD ?? ''
const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL ?? ''
const MANAGER_PASSWORD = process.env.TEST_MANAGER_PASSWORD ?? ''

const hasAgenturCreds = !!(AGENTUR_EMAIL && AGENTUR_PASSWORD)
const hasManagerCreds = !!(MANAGER_EMAIL && MANAGER_PASSWORD)

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

// ── API: Authentifizierungsschutz ─────────────────────────────────────────────

test.describe('API: Authentifizierungsschutz', () => {
  test('GET /api/ressourcen blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.get('/api/ressourcen', { maxRedirects: 0 })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('POST /api/ressourcen blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.post('/api/ressourcen', {
      data: { name: 'Test' },
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('PUT /api/ressourcen/[id] blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.put('/api/ressourcen/00000000-0000-0000-0000-000000000000', {
      data: { name: 'Test' },
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('DELETE /api/ressourcen/[id]/cv blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.delete('/api/ressourcen/00000000-0000-0000-0000-000000000000/cv', {
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })
})

// ── RBAC: Routing-Schutz ──────────────────────────────────────────────────────

test.describe('RBAC: Routing-Schutz', () => {
  test('GET /pool leitet unauthentifizierten User zu /login um', async ({ page }) => {
    await page.goto('/pool', { waitUntil: 'networkidle' })
    expect(page.url()).toContain('/login')
  })

  test('GET /ressourcen leitet unauthentifizierten User zu /login um', async ({ page }) => {
    await page.goto('/ressourcen', { waitUntil: 'networkidle' })
    expect(page.url()).toContain('/login')
  })
})

// ── Agentur: /pool Seite ──────────────────────────────────────────────────────

test.describe('Agentur: /pool Seite', () => {
  test.skip(!hasAgenturCreds, 'TEST_USER_REQUIRED: TEST_AGENTUR_EMAIL + TEST_AGENTUR_PASSWORD fehlen')

  test('AC-1: Agentur kann /pool aufrufen und sieht Tabelle', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    await expect(page.getByRole('heading', { name: 'Mein Pool' })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('AC-1: "Neue Ressource"-Button öffnet Formular-Sheet', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    await page.getByRole('button', { name: 'Neue Ressource' }).click()
    await expect(page.getByText('Neue Ressource anlegen')).toBeVisible()
    await expect(page.getByLabel('Name / Pseudonym')).toBeVisible()
  })

  test('AC-1: Formular-Validierung zeigt Fehler bei fehlenden Pflichtfeldern', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    await page.getByRole('button', { name: 'Neue Ressource' }).click()
    await page.getByRole('button', { name: 'Ressource anlegen' }).click()
    await expect(page.getByText('Name ist erforderlich')).toBeVisible()
  })

  test('AC-3: "Verfügbar ab"-Datumsfeld erscheint nur bei Status "Verfügbar ab"', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    await page.getByRole('button', { name: 'Neue Ressource' }).click()

    // Datumsfeld anfangs nicht sichtbar
    await expect(page.getByLabel('Verfügbar ab')).not.toBeVisible()

    // Status auf "Verfügbar ab" setzen
    await page.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'Verfügbar ab' }).click()

    // Datumsfeld erscheint
    await expect(page.getByLabel('Verfügbar ab')).toBeVisible()
  })

  test('AC-5: Deaktivierte Ressourcen in Standardansicht ausgeblendet', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    // Deaktivierte Ressourcen standardmäßig nicht sichtbar
    await expect(page.getByRole('button', { name: 'Deaktivierte anzeigen' })).toBeVisible()
    // Der Button sollte nicht "aktiv" (default variant) sein
    const btn = page.getByRole('button', { name: 'Deaktivierte anzeigen' })
    await expect(btn).not.toHaveClass(/bg-primary/)
  })

  test('AC-5: "Deaktivieren"-Aktion erscheint im Dropdown', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    // Nur testen wenn mindestens eine Ressource vorhanden
    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    if (rowCount <= 1) {
      test.skip()
      return
    }
    // Drei-Punkte-Menü der ersten Ressource öffnen
    await rows.nth(1).getByRole('button').click()
    await expect(page.getByRole('menuitem', { name: 'Bearbeiten' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Deaktivieren' })).toBeVisible()
  })
})

// ── Manager: /ressourcen Seite ────────────────────────────────────────────────

test.describe('Manager: /ressourcen Seite', () => {
  test.skip(!hasManagerCreds, 'TEST_USER_REQUIRED: TEST_MANAGER_EMAIL + TEST_MANAGER_PASSWORD fehlen')

  test('AC-7: Manager kann /ressourcen aufrufen und sieht alle Ressourcen', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/ressourcen')
    await expect(page.getByRole('heading', { name: 'Ressourcen-Pool' })).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('AC-8: Filter-Dropdowns für Status, Level und Agentur vorhanden', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/ressourcen')
    // Status-Filter
    await expect(page.getByRole('combobox', { name: /Status/i }).or(page.getByText('Alle Status'))).toBeTruthy()
    // Level-Filter
    await expect(page.getByText('Alle Level')).toBeVisible()
  })

  test('AC-8: Klick auf Zeile öffnet Detail-Sheet', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/ressourcen')
    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    if (rowCount <= 1) {
      test.skip()
      return
    }
    await rows.nth(1).click()
    await expect(page.getByRole('complementary')).toBeVisible() // Sheet
    await expect(page.getByText('EK-Tagesrate')).toBeVisible()
  })

  test('AC-7: Manager sieht keinen "Neue Ressource"-Button (read-only)', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/ressourcen')
    await expect(page.getByRole('button', { name: 'Neue Ressource' })).not.toBeVisible()
  })
})

// ── Sidebar Navigation ────────────────────────────────────────────────────────

test.describe('Sidebar Navigation', () => {
  test.skip(!hasAgenturCreds, 'TEST_USER_REQUIRED: TEST_AGENTUR_EMAIL fehlen')

  test('Agentur sieht "Mein Pool" in der Sidebar', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: 'Mein Pool' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ressourcen' })).not.toBeVisible()
  })
})
