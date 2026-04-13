import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

/**
 * PROJ-3: Profil-Einreichung + CV-Upload — E2E Tests
 *
 * Tests that require real user accounts are marked with TEST_USER_REQUIRED.
 * To run the full suite, set these env vars:
 *   TEST_AGENTUR_EMAIL, TEST_AGENTUR_PASSWORD
 *   TEST_MANAGER_EMAIL, TEST_MANAGER_PASSWORD
 *
 * The API auth tests run without credentials and test middleware protection.
 */

const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL ?? ''
const MANAGER_PASSWORD = process.env.TEST_MANAGER_PASSWORD ?? ''
const AGENTUR_EMAIL = process.env.TEST_AGENTUR_EMAIL ?? ''
const AGENTUR_PASSWORD = process.env.TEST_AGENTUR_PASSWORD ?? ''

const hasManagerCreds = !!(MANAGER_EMAIL && MANAGER_PASSWORD)
const hasAgenturCreds = !!(AGENTUR_EMAIL && AGENTUR_PASSWORD)

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

/** Erzeugt eine minimale gültige PDF-Testdatei im Temp-Verzeichnis */
function createTestPdf(filename = 'test-cv.pdf'): string {
  const tmpDir = os.tmpdir()
  const filePath = path.join(tmpDir, filename)
  // Minimales gültiges PDF (kann von Supabase gespeichert werden)
  const pdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'
  fs.writeFileSync(filePath, pdfContent)
  return filePath
}

// ── API: Authentifizierungsschutz ─────────────────────────────────────────────

test.describe('API: Authentifizierungsschutz', () => {
  test('GET /api/profile blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.get('/api/profile', { maxRedirects: 0 })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('POST /api/profile blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.post('/api/profile', {
      multipart: { kandidatenname: 'Test' },
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('DELETE /api/profile/[id] blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.delete(
      '/api/profile/00000000-0000-0000-0000-000000000000',
      { maxRedirects: 0 }
    )
    expect([302, 307, 401]).toContain(res.status())
  })

  test('GET /api/profile/[id]/cv blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.get(
      '/api/profile/00000000-0000-0000-0000-000000000000/cv',
      { maxRedirects: 0 }
    )
    expect([302, 307, 401]).toContain(res.status())
  })

  test('GET /api/profile/duplicate-check blockiert unauthentifizierten Zugriff', async ({
    request,
  }) => {
    const res = await request.get('/api/profile/duplicate-check?vakanz_id=x&kandidatenname=y', {
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })
})

// ── Routing: Sichtbarkeit nach Rolle ─────────────────────────────────────────

test.describe('Routing: Seitenaufrufe', () => {
  test('TEST_USER_REQUIRED: /meine-profile lädt für Agentur-User', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/meine-profile')
    await expect(page.getByRole('heading', { name: 'Meine Profile' })).toBeVisible()
  })

  test('TEST_USER_REQUIRED: /profile lädt für Manager', async ({ page }) => {
    test.skip(!hasManagerCreds, 'TEST_MANAGER_EMAIL/PASSWORD nicht gesetzt')
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Alle Profile' })).toBeVisible()
  })
})

// ── AC: Profil einreichen (Formular) ─────────────────────────────────────────

test.describe('AC: Profil einreichen', () => {
  test('TEST_USER_REQUIRED: Agentur sieht "Profil einreichen"-Button auf Vakanz-Seite', async ({
    page,
  }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    await expect(page.getByRole('heading', { name: 'Vakanzen' })).toBeVisible()
    // Mindestens eine offene Vakanz muss existieren
    const profilButton = page.getByText('Profil einreichen').first()
    await expect(profilButton).toBeVisible()
  })

  test('TEST_USER_REQUIRED: Formular öffnet sich als Sheet-Panel', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    // Klick auf Dropdown-Menü einer Vakanz
    const moreButton = page.getByRole('button', { name: /mehr|more|actions/i }).first()
    await moreButton.click()
    await page.getByText('Profil einreichen').click()
    // Sheet öffnet sich
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('Kandidatenname')).toBeVisible()
    await expect(page.getByText('Lebenslauf')).toBeVisible()
  })

  test('TEST_USER_REQUIRED: Formular-Pflichtfeldvalidierung verhindert leere Einreichung', async ({
    page,
  }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    const moreButton = page.getByRole('button', { name: /mehr|more|actions/i }).first()
    await moreButton.click()
    await page.getByText('Profil einreichen').click()
    await page.getByRole('dialog').waitFor()
    // Direkt auf "Profil einreichen" klicken ohne Felder
    await page.getByRole('button', { name: 'Profil einreichen' }).click()
    // Fehlermeldungen erscheinen
    await expect(page.getByText(/erforderlich/i)).toBeVisible()
  })

  test('TEST_USER_REQUIRED: Vollständige Profileinreichung mit PDF', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')
    const pdfPath = createTestPdf()

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    const moreButton = page.getByRole('button', { name: /mehr|more|actions/i }).first()
    await moreButton.click()
    await page.getByText('Profil einreichen').click()
    await page.getByRole('dialog').waitFor()

    // Formular ausfüllen
    await page.getByLabel('Kandidatenname').fill('E2E Testkandidat')
    await page.getByLabel(/Verfügbarkeit/i).fill('40')
    await page.getByLabel(/Verfügbar ab/i).fill('2026-06-01')
    await page.getByLabel(/Tagessatz/i).fill('900')

    // Skill hinzufügen
    const skillInput = page.getByPlaceholder(/Skill eingeben/i)
    await skillInput.fill('TypeScript')
    await skillInput.press('Enter')

    // Erfahrungslevel
    await page.getByText('Level wählen').click()
    await page.getByRole('option', { name: 'Senior' }).click()

    // Profiltext
    await page.getByPlaceholder(/Erfahrungen/i).fill('Erfahrener Entwickler für E2E-Test.')

    // CV Upload
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(pdfPath)
    await expect(page.getByText('test-cv.pdf')).toBeVisible({ timeout: 3000 })

    // Einreichen
    await page.getByRole('button', { name: 'Profil einreichen' }).click()

    // Erfolgsmeldung
    await expect(page.getByText(/eingereicht/i)).toBeVisible({ timeout: 10000 })

    // Cleanup
    fs.unlinkSync(pdfPath)
  })
})

// ── AC: Meine Profile — Agentur-Sicht ────────────────────────────────────────

test.describe('AC: Meine Profile', () => {
  test('TEST_USER_REQUIRED: Leerer Zustand wenn keine Profile vorhanden', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/meine-profile')
    // Entweder Profile oder Leer-Zustand
    const hasEmpty = await page.getByText(/noch keine Profile eingereicht/i).isVisible()
    const hasTable = await page.locator('table').isVisible()
    expect(hasEmpty || hasTable).toBe(true)
  })

  test('TEST_USER_REQUIRED: Bearbeiten-Button deaktiviert wenn Status ≠ Eingereicht', async ({
    page,
  }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/meine-profile')
    // Falls Profile mit Status "In Prüfung" existieren → Button disabled
    const pruefungBadge = page.getByText('In Prüfung').first()
    if (await pruefungBadge.isVisible()) {
      const row = pruefungBadge.locator('..').locator('..')
      const editBtn = row.getByRole('button').first()
      await expect(editBtn).toBeDisabled()
    }
  })

  test('TEST_USER_REQUIRED: Zurückziehen-Button öffnet Bestätigungs-Dialog', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/meine-profile')
    // Falls ein eingereicht-Profil existiert
    const eingereichtBadge = page.getByText('Eingereicht').first()
    if (await eingereichtBadge.isVisible()) {
      const row = eingereichtBadge.locator('..').locator('..')
      // Trash-Button (zweiter Button in der Zeile)
      const deleteBtn = row.getByRole('button').nth(1)
      await deleteBtn.click()
      await expect(page.getByText('Profil zurückziehen?')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible()
      // Dialog schließen ohne zu löschen
      await page.getByRole('button', { name: 'Abbrechen' }).click()
    }
  })
})

// ── AC: Manager-Ansicht ───────────────────────────────────────────────────────

test.describe('AC: Profile (Manager-Sicht)', () => {
  test('TEST_USER_REQUIRED: Manager sieht "Agentur"-Spalte in der Profiltabelle', async ({
    page,
  }) => {
    test.skip(!hasManagerCreds, 'TEST_MANAGER_EMAIL/PASSWORD nicht gesetzt')
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/profile')
    await expect(page.getByRole('columnheader', { name: 'Agentur' })).toBeVisible()
  })

  test('TEST_USER_REQUIRED: Manager sieht Download-Button für CV', async ({ page }) => {
    test.skip(!hasManagerCreds, 'TEST_MANAGER_EMAIL/PASSWORD nicht gesetzt')
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/profile')
    await page.waitForTimeout(1000) // Tabelle lädt
    const downloadBtn = page.getByTitle('Lebenslauf herunterladen').first()
    if (await downloadBtn.isVisible()) {
      await expect(downloadBtn).toBeEnabled()
    }
  })

  test('TEST_USER_REQUIRED: Manager kann nach Status filtern', async ({ page }) => {
    test.skip(!hasManagerCreds, 'TEST_MANAGER_EMAIL/PASSWORD nicht gesetzt')
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/profile')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Eingereicht' }).click()
    await page.waitForTimeout(500)
    // Prüfen dass kein anderer Status sichtbar ist
    await expect(page.getByText('In Prüfung')).not.toBeVisible()
  })
})

// ── AC: CV-Upload Validierung ─────────────────────────────────────────────────

test.describe('AC: CV-Upload Validierung', () => {
  test('TEST_USER_REQUIRED: Nicht-PDF Datei wird abgelehnt', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')

    // Erstelle Testdatei mit .txt
    const tmpPath = path.join(os.tmpdir(), 'test.txt')
    fs.writeFileSync(tmpPath, 'Das ist kein PDF')

    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/vakanzen')
    const moreButton = page.getByRole('button', { name: /mehr|more|actions/i }).first()
    await moreButton.click()
    await page.getByText('Profil einreichen').click()
    await page.getByRole('dialog').waitFor()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(tmpPath)
    // Dropzone sollte Fehler zeigen
    await expect(page.getByText(/PDF/i)).toBeVisible()

    fs.unlinkSync(tmpPath)
  })
})

// ── Security: Autorisierungsschutz ───────────────────────────────────────────

test.describe('Security: Autorisierungsschutz', () => {
  test('POST /api/profile gibt 403 für Manager-User', async ({ request, browser }) => {
    test.skip(!hasManagerCreds, 'TEST_MANAGER_EMAIL/PASSWORD nicht gesetzt')
    // Manuell mit Manager einloggen und Cookie holen
    const context = await browser.newContext()
    const page = await context.newPage()
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)

    const cookies = await context.cookies()
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    const res = await request.post('/api/profile', {
      headers: { Cookie: cookieStr },
      multipart: { kandidatenname: 'Hack', vakanz_id: '00000000-0000-0000-0000-000000000001' },
      maxRedirects: 0,
    })
    expect([400, 403]).toContain(res.status())
    await context.close()
  })

  test('DELETE /api/profile/[id] kann nicht fremde Profile löschen (404 via RLS)', async ({
    request,
    browser,
  }) => {
    test.skip(!hasAgenturCreds, 'TEST_AGENTUR_EMAIL/PASSWORD nicht gesetzt')
    const context = await browser.newContext()
    const page = await context.newPage()
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)

    const cookies = await context.cookies()
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    // Nicht existierende ID → RLS oder 404
    const res = await request.delete(
      '/api/profile/00000000-0000-0000-0000-000000000000',
      {
        headers: { Cookie: cookieStr },
        maxRedirects: 0,
      }
    )
    expect([403, 404]).toContain(res.status())
    await context.close()
  })
})
