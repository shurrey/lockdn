import { test, expect, Page } from '@playwright/test'

// Helper function to complete onboarding quickly
async function completeOnboarding(page: Page) {
  // Clear IndexedDB
  await page.goto('/')
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('lockdn-db')
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

test.describe('App Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page)
  })

  test('should display sidebar with all navigation items', async ({ page }) => {
    // Check all nav items are present in sidebar
    const sidebar = page.locator('aside')
    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Calendar' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Study', exact: true })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Courses' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Tutor' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Notes' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Study Materials' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Analytics' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Settings' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Archive' })).toBeVisible()
  })

  test('should display Lockdn logo in sidebar', async ({ page }) => {
    // Check logo is visible
    await expect(page.getByAltText(/lockdn/i).first()).toBeVisible()
  })

  test('should navigate to all main pages', async ({ page }) => {
    const sidebar = page.locator('aside')

    // Calendar
    await sidebar.getByRole('link', { name: 'Calendar' }).click()
    await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible()

    // Study
    await sidebar.getByRole('link', { name: 'Study', exact: true }).click()
    await expect(page.getByRole('heading', { name: /study planner/i })).toBeVisible()

    // Courses
    await sidebar.getByRole('link', { name: 'Courses' }).click()
    await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible()

    // Notes
    await sidebar.getByRole('link', { name: 'Notes' }).click()
    await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible()

    // Analytics
    await sidebar.getByRole('link', { name: 'Analytics' }).click()
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible()

    // Settings
    await sidebar.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()

    // Archive
    await sidebar.getByRole('link', { name: 'Archive' }).click()
    await expect(page.getByRole('heading', { name: 'Archive', exact: true })).toBeVisible()

    // Back to Dashboard
    await sidebar.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  })
})

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page)
  })

  test('should display dashboard widgets', async ({ page }) => {
    // Check for key widgets - new users see Getting Started instead of full dashboard
    // Look for Quick Actions card title
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Quick Actions' })).toBeVisible()
    // Getting Started section should be visible for new users
    await expect(page.getByText(/getting started/i)).toBeVisible()
  })

  test('should show getting started for new users without courses', async ({ page }) => {
    // New users should see getting started section
    await expect(page.getByText(/getting started/i)).toBeVisible()
    await expect(page.getByText(/configure ai provider/i)).toBeVisible()
  })

  test('should have working quick action buttons', async ({ page }) => {
    // Test Add Course link in quick actions
    await page.getByRole('link', { name: 'Add Course' }).click()
    await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible()
  })
})
