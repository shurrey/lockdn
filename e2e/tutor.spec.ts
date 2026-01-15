import { test, expect, Page } from '@playwright/test'

// Helper function to complete onboarding quickly
async function completeOnboarding(page: Page) {
  // Clear IndexedDB and localStorage
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('StudentToolsDB')
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })
  await page.reload()

  // Complete onboarding quickly
  await page.getByRole('button', { name: /get started/i }).click()
  // Wait for API Key step to load, then click Skip Setup in header
  await expect(page.getByRole('heading', { name: /configure ai provider/i })).toBeVisible()
  await page.getByRole('button', { name: /skip setup/i }).click()
  // Wait for completion step, then go to dashboard
  await expect(page.getByRole('heading', { name: /all set/i })).toBeVisible()
  await page.getByRole('button', { name: /go to dashboard/i }).click()
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 })
}

test.describe('AI Tutor', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page)
  })

  test('should navigate to tutor page', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByRole('link', { name: 'Tutor' }).click()
    await expect(page.getByRole('heading', { name: /ai tutor/i })).toBeVisible()
  })

  test('should show API key required message when no key configured', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByRole('link', { name: 'Tutor' }).click()

    // Should see mascot and configure API key message
    await expect(page.getByAltText(/lockdn mascot/i)).toBeVisible()
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Configure API Key' })).toBeVisible()
    await expect(page.getByRole('link', { name: /configure api key/i })).toBeVisible()
  })

  test('should link to settings from API key message', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByRole('link', { name: 'Tutor' }).click()
    await page.getByRole('link', { name: /configure api key/i }).click()

    // Should navigate to settings
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
  })
})

// Note: AI Tutor with API Key tests require complex setup and are skipped for now
// These would need proper API key injection or mocking to work reliably
test.describe.skip('AI Tutor with API Key', () => {
  test('should show chat interface when API key is configured', async ({ page }) => {
    // This test requires API key setup which is complex to automate
  })

  test('should show mascot in empty chat state', async ({ page }) => {
    // This test requires API key setup which is complex to automate
  })

  test('should create new conversation', async ({ page }) => {
    // This test requires API key setup which is complex to automate
  })
})
