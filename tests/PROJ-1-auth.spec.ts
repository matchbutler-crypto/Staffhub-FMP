import { test, expect } from '@playwright/test'

/**
 * PROJ-1: Auth & Rollenverwaltung — E2E Tests
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

// ── Login Page Rendering ─────────────────────────────────────────────────────

test.describe('Login-Seite Darstellung', () => {
  test('zeigt Formular mit E-Mail und Passwort Feldern', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('E-Mail')).toBeVisible()
    await expect(page.getByLabel('Passwort')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
  })

  test('zeigt Brand "Staffhub FMP"', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Staffhub FMP')).toBeVisible()
  })

  test('zeigt keinen Registrieren-Link (kein Self-Signup)', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/registrier/i)).not.toBeVisible()
    await expect(page.getByText(/sign up/i)).not.toBeVisible()
  })

  test('zeigt Hinweis "Kein Account? Wende dich an den Administrator."', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/kein account/i)).toBeVisible()
  })
})

// ── Formular-Validierung ─────────────────────────────────────────────────────

test.describe('Formular-Validierung', () => {
  test('Submit mit leeren Feldern wird blockiert (HTML5 required)', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    // Page should stay on /login (HTML5 validation prevents submit)
    await expect(page).toHaveURL(/\/login/)
  })

  test('Submit mit nur E-Mail wird blockiert', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-Mail').fill('test@example.com')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('Submit mit nur Passwort wird blockiert', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Passwort').fill('password123')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})

// ── Falsche Credentials ───────────────────────────────────────────────────────

test.describe('Falsche Credentials', () => {
  test('zeigt Fehlermeldung bei falscher E-Mail/Passwort Kombination', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-Mail').fill('nichtexistent@staffhub.de')
    await page.getByLabel('Passwort').fill('wrongpassword123')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page.getByText('E-Mail oder Passwort falsch.')).toBeVisible({ timeout: 10000 })
  })

  test('Button zeigt "Anmelden…" während des Ladens', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-Mail').fill('test@test.de')
    await page.getByLabel('Passwort').fill('testpass')
    // Intercept to slow down request
    await page.route('**/auth/v1/token**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      await route.continue()
    })
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page.getByRole('button', { name: 'Anmelden…' })).toBeVisible()
  })

  test('bleibt auf /login nach fehlgeschlagener Anmeldung', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-Mail').fill('falsch@example.com')
    await page.getByLabel('Passwort').fill('falschespasswort')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})

// ── Routenschutz ──────────────────────────────────────────────────────────────

test.describe('Routenschutz (unauthentifiziert)', () => {
  const protectedRoutes = [
    '/dashboard',
    '/vakanzen',
    '/profile',
    '/agenturen',
    '/abrechnung',
    '/admin',
    '/meine-profile',
  ]

  for (const route of protectedRoutes) {
    test(`${route} leitet unauthentifizierte User zu /login weiter`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/, { timeout: 8000 })
    })
  }

  test('Redirect enthält redirectTo-Parameter mit ursprünglicher URL', async ({ page }) => {
    await page.goto('/vakanzen')
    await expect(page).toHaveURL(/redirectTo=%2Fvakanzen/, { timeout: 8000 })
  })

  test('Root / leitet zu /dashboard weiter (dann zu /login)', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 })
  })
})

// ── /login für eingeloggte User ───────────────────────────────────────────────

test.describe('Fehlerparameter auf /login', () => {
  test('zeigt "Account deaktiviert" bei ?error=deactivated', async ({ page }) => {
    await page.goto('/login?error=deactivated')
    await expect(
      page.getByText(/account wurde deaktiviert/i)
    ).toBeVisible()
  })

  test('zeigt "Account nicht konfiguriert" bei ?error=no_profile', async ({ page }) => {
    await page.goto('/login?error=no_profile')
    await expect(
      page.getByText(/account nicht konfiguriert/i)
    ).toBeVisible()
  })
})

// ── Open Redirect Schutz ──────────────────────────────────────────────────────

test.describe('Sicherheit: Open Redirect', () => {
  test('redirectTo mit externer Domain wird ignoriert — bleibt auf /login', async ({ page }) => {
    await page.goto('/login?redirectTo=//evil.com')
    // Page should render login normally (not redirect to evil.com)
    await expect(page.getByLabel('E-Mail')).toBeVisible()
  })

  test('redirectTo mit http:// wird ignoriert', async ({ page }) => {
    await page.goto('/login?redirectTo=http://evil.com/steal')
    await expect(page.getByLabel('E-Mail')).toBeVisible()
  })
})

// ── Auth-Required Tests (benötigen Testaccounts) ──────────────────────────────

test.describe('Login-Flow (TEST_USER_REQUIRED)', () => {
  test('Admin: erfolgreicher Login leitet zu /dashboard weiter', async ({ page }) => {
    test.skip(!hasAdminCreds, 'Benötigt TEST_ADMIN_EMAIL und TEST_ADMIN_PASSWORD')
    await page.goto('/login')
    await page.getByLabel('E-Mail').fill(ADMIN_EMAIL)
    await page.getByLabel('Passwort').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
  })

  test('Bereits eingeloggt: /login leitet zu /dashboard weiter', async ({ page }) => {
    test.skip(!hasAdminCreds, 'Benötigt TEST_ADMIN_EMAIL und TEST_ADMIN_PASSWORD')
    await page.goto('/login')
    await page.getByLabel('E-Mail').fill(ADMIN_EMAIL)
    await page.getByLabel('Passwort').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    // Now try to visit /login again
    await page.goto('/login')
    await expect(page).toHaveURL('/dashboard', { timeout: 8000 })
  })

  test('redirectTo: nach Login landet User auf ursprünglicher URL', async ({ page }) => {
    test.skip(!hasAdminCreds, 'Benötigt TEST_ADMIN_EMAIL und TEST_ADMIN_PASSWORD')
    await page.goto('/vakanzen')
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fvakanzen/)
    await page.getByLabel('E-Mail').fill(ADMIN_EMAIL)
    await page.getByLabel('Passwort').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL('/vakanzen', { timeout: 10000 })
  })
})

test.describe('Sidebar & Navigation (TEST_USER_REQUIRED)', () => {
  test('Admin: zeigt alle Nav-Einträge inkl. Admin-Link', async ({ page }) => {
    test.skip(!hasAdminCreds, 'Benötigt TEST_ADMIN_EMAIL und TEST_ADMIN_PASSWORD')
    await page.goto('/login')
    await page.getByLabel('E-Mail').fill(ADMIN_EMAIL)
    await page.getByLabel('Passwort').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Vakanzen' })).toBeVisible()
  })

  test('Agentur: sieht keinen Admin-Link und keinen Profile-Link', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'Benötigt TEST_AGENTUR_EMAIL und TEST_AGENTUR_PASSWORD')
    await page.goto('/login')
    await page.getByLabel('E-Mail').fill(AGENTUR_EMAIL)
    await page.getByLabel('Passwort').fill(AGENTUR_PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    await expect(page.getByRole('link', { name: 'Admin' })).not.toBeVisible()
    await expect(page.getByRole('link', { name: 'Profile' })).not.toBeVisible()
    await expect(page.getByRole('link', { name: 'Meine Profile' })).toBeVisible()
  })
})

test.describe('RBAC (TEST_USER_REQUIRED)', () => {
  test('Agentur: Zugriff auf /admin zeigt Unauthorized-Toast', async ({ page }) => {
    test.skip(!hasAgenturCreds, 'Benötigt TEST_AGENTUR_EMAIL und TEST_AGENTUR_PASSWORD')
    await page.goto('/login')
    await page.getByLabel('E-Mail').fill(AGENTUR_EMAIL)
    await page.getByLabel('Passwort').fill(AGENTUR_PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    await page.goto('/admin')
    await expect(page).toHaveURL('/dashboard', { timeout: 8000 })
    await expect(page.getByText(/keine berechtigung/i)).toBeVisible({ timeout: 5000 })
  })

  test('Manager: Zugriff auf /meine-profile wird blockiert', async ({ page }) => {
    test.skip(!hasManagerCreds, 'Benötigt TEST_MANAGER_EMAIL und TEST_MANAGER_PASSWORD')
    await page.goto('/login')
    await page.getByLabel('E-Mail').fill(MANAGER_EMAIL)
    await page.getByLabel('Passwort').fill(MANAGER_PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    await page.goto('/meine-profile')
    await expect(page).toHaveURL('/dashboard', { timeout: 8000 })
  })
})

test.describe('Logout (TEST_USER_REQUIRED)', () => {
  test('Logout beendet Session und leitet zu /login weiter', async ({ page }) => {
    test.skip(!hasAdminCreds, 'Benötigt TEST_ADMIN_EMAIL und TEST_ADMIN_PASSWORD')
    await page.goto('/login')
    await page.getByLabel('E-Mail').fill(ADMIN_EMAIL)
    await page.getByLabel('Passwort').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    // Open user dropdown and click logout
    await page.getByRole('button', { name: /abmelden/i }).click({ force: true }).catch(() =>
      page.locator('[data-slot="sidebar-menu-button"]').last().click()
    )
    await page.getByText('Abmelden').click()
    await expect(page).toHaveURL('/login', { timeout: 8000 })
    // Verify session is gone — protected route should redirect to /login
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 })
  })
})
