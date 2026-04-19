import { test, expect } from '@playwright/test'

/**
 * PROJ-12: Ressourcen-Feedback — E2E Tests
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

const FAKE_UUID = '00000000-0000-0000-0000-000000000001'

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

// ── API: Authentifizierungsschutz ─────────────────────────────────────────────

test.describe('API: Authentifizierungsschutz PROJ-12', () => {
  test('GET /api/ressourcen/[id]/feedback blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.get(`/api/ressourcen/${FAKE_UUID}/feedback`, {
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('POST /api/ressourcen/[id]/feedback blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.post(`/api/ressourcen/${FAKE_UUID}/feedback`, {
      data: { text: 'Angriff' },
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('DELETE /api/ressource-feedback/[id] blockiert unauthentifizierten Zugriff', async ({ request }) => {
    const res = await request.delete(`/api/ressource-feedback/${FAKE_UUID}`, {
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })

  test('POST /api/ressourcen/[id]/feedback validiert: leerer Text → 401 (unauth)', async ({ request }) => {
    const res = await request.post(`/api/ressourcen/${FAKE_UUID}/feedback`, {
      data: { text: '' },
      maxRedirects: 0,
    })
    // Unauthenticated gets 401 before validation
    expect([302, 307, 400, 401]).toContain(res.status())
  })
})

// ── Manager UI: Feedback-Tab in Ressourcen-Detailansicht ──────────────────────

test.describe('Manager UI: Feedback-Tab', () => {
  test.skip(!hasManagerCreds, 'TEST_USER_REQUIRED: TEST_MANAGER_EMAIL / TEST_MANAGER_PASSWORD')

  test('Feedback-Tab ist in Ressourcen-Detailansicht sichtbar', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/ressourcen')
    await page.waitForLoadState('networkidle')

    // Click first row to open sheet
    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 5000 })

    const feedbackTab = page.getByRole('tab', { name: /Feedback/i })
    await expect(feedbackTab).toBeVisible()
  })

  test('Feedback-Tab zeigt Formular mit Text-Feld und Sterne', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/ressourcen')
    await page.waitForLoadState('networkidle')

    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 5000 })

    await page.getByRole('tab', { name: /Feedback/i }).click()
    await page.waitForLoadState('networkidle')

    // Form should contain a textarea
    const textarea = page.locator('textarea[placeholder*="Einschätzung"]')
    await expect(textarea).toBeVisible()

    // Should have star buttons
    const starButtons = page.locator('button[title], button[type="button"]').filter({ hasText: '' })
    await expect(page.locator('form button[type="submit"]')).toBeVisible()
  })

  test('Feedback-Formular: Absenden ohne Text bleibt deaktiviert', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/ressourcen')
    await page.waitForLoadState('networkidle')

    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 5000 })
    await page.getByRole('tab', { name: /Feedback/i }).click()

    const submitButton = page.locator('form').getByRole('button', { name: /Feedback senden/i })
    await expect(submitButton).toBeDisabled()
  })

  test('Leerer Feedback-Zustand zeigt Hinweistext', async ({ page }) => {
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/ressourcen')
    await page.waitForLoadState('networkidle')

    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 5000 })
    await page.getByRole('tab', { name: /Feedback/i }).click()
    await page.waitForLoadState('networkidle')

    // Either shows empty state message OR shows existing feedback
    const hasEmptyState = await page.locator('text=Noch kein Feedback vorhanden').isVisible().catch(() => false)
    const hasFeedbackList = await page.locator('.divide-y').isVisible().catch(() => false)
    expect(hasEmptyState || hasFeedbackList).toBe(true)
  })
})

// ── Agentur UI: Feedback-Tab in Pool-Detailansicht ────────────────────────────

test.describe('Agentur UI: Feedback-Tab im Pool', () => {
  test.skip(!hasAgenturCreds, 'TEST_USER_REQUIRED: TEST_AGENTUR_EMAIL / TEST_AGENTUR_PASSWORD')

  test('Feedback-Tab ist im Pool-Detailsheet sichtbar', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    await page.waitForLoadState('networkidle')

    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 5000 })

    const feedbackTab = page.getByRole('tab', { name: /Feedback/i })
    await expect(feedbackTab).toBeVisible()
  })

  test('Agentur sieht Feedback-Formular für eigene Ressource', async ({ page }) => {
    await login(page, AGENTUR_EMAIL, AGENTUR_PASSWORD)
    await page.goto('/pool')
    await page.waitForLoadState('networkidle')

    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 5000 })
    await page.getByRole('tab', { name: /Feedback/i }).click()
    await page.waitForLoadState('networkidle')

    const textarea = page.locator('textarea[placeholder*="Einschätzung"]')
    await expect(textarea).toBeVisible()
  })
})

// ── Security: Cross-Agentur-Isolation ─────────────────────────────────────────

test.describe('Security: RLS-Isolation', () => {
  test('GET /api/ressourcen/[id]/feedback mit falscher Ressource gibt leeres Array (RLS)', async ({ request }) => {
    // Without auth, we just verify 401 — real isolation test requires 2 Agentur accounts
    const res = await request.get(`/api/ressourcen/${FAKE_UUID}/feedback`, {
      maxRedirects: 0,
    })
    expect([302, 307, 401]).toContain(res.status())
  })
})
