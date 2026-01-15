import { test, expect } from '@playwright/test'

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear IndexedDB before each test to start fresh
    await page.goto('/')
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('lockdn-db')
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    })
    await page.reload()
  })

  test('should show onboarding wizard for new users', async ({ page }) => {
    await page.goto('/')

    // Should see the welcome step with Lockdn branding and privacy message
    await expect(page.getByAltText(/lockdn/i).first()).toBeVisible()
    await expect(page.getByText(/your data stays with you/i)).toBeVisible()
  })

  test('should navigate through onboarding steps', async ({ page }) => {
    await page.goto('/')

    // Step 1: Welcome - look for Lockdn logo and Get Started button
    await expect(page.getByAltText(/lockdn/i).first()).toBeVisible()
    await page.getByRole('button', { name: /get started/i }).click()

    // Step 2: API Key Setup
    await expect(page.getByText(/ai setup/i)).toBeVisible()
    // Skip API key for now
    await page.getByRole('button', { name: /skip|next|continue/i }).click()

    // Step 3: Schedule Upload
    await expect(page.getByText(/schedule/i)).toBeVisible()
    // Skip schedule upload
    await page.getByRole('button', { name: /skip/i }).click()

    // Step 4: Preferences (syllabus step is skipped if no schedule)
    await expect(page.getByText(/preferences/i)).toBeVisible()
    await page.getByRole('button', { name: /next|continue/i }).click()

    // Step 5: Complete - look for the heading specifically
    await expect(page.getByRole('heading', { name: /all set/i })).toBeVisible()
  })

  test('should allow skipping to end', async ({ page }) => {
    await page.goto('/')

    // Start onboarding
    await page.getByRole('button', { name: /get started/i }).click()

    // Click skip setup
    await page.getByRole('button', { name: /skip setup/i }).click()

    // Should be at completion step - look for the heading specifically
    await expect(page.getByRole('heading', { name: /all set/i })).toBeVisible()
  })

  test('should complete onboarding and show main app', async ({ page }) => {
    await page.goto('/')

    // Go through onboarding quickly
    await page.getByRole('button', { name: /get started/i }).click()
    await page.getByRole('button', { name: /skip setup/i }).click()

    // Complete onboarding
    await page.getByRole('button', { name: /go to dashboard|finish|complete/i }).click()

    // Should see main dashboard
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 })
  })

  test('should persist onboarding completion', async ({ page }) => {
    await page.goto('/')

    // Complete onboarding
    await page.getByRole('button', { name: /get started/i }).click()
    await page.getByRole('button', { name: /skip setup/i }).click()
    await page.getByRole('button', { name: /go to dashboard|finish|complete/i }).click()

    // Wait for dashboard
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 })

    // Reload and verify we're still on dashboard (not onboarding)
    await page.reload()
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 })
  })
})
