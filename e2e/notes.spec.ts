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

test.describe('Notes Management', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page)
  })

  test('should navigate to notes page', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByRole('link', { name: 'Notes' }).click()
    await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible()
  })

  test('should show empty state with mascot when no notes', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByRole('link', { name: 'Notes' }).click()

    // Should see the mascot and empty state message
    await expect(page.getByAltText(/lockdn mascot/i)).toBeVisible()
    await expect(page.getByText(/no notes yet/i)).toBeVisible()
  })

  test('should show upload area', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByRole('link', { name: 'Notes' }).click()

    // Should see upload button
    await expect(page.getByRole('button', { name: /upload notes/i }).first()).toBeVisible()
  })
})

test.describe('Study Materials', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page)
  })

  test('should navigate to study materials page', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByRole('link', { name: 'Study Materials' }).click()
    await expect(page.getByRole('heading', { name: /study materials/i })).toBeVisible()
  })

  test('should show tabs for guides and exams', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByRole('link', { name: 'Study Materials' }).click()

    await expect(page.getByRole('tab', { name: /study guides/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /practice exams/i })).toBeVisible()
  })

  test('should show empty state with mascot for guides', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByRole('link', { name: 'Study Materials' }).click()

    // Should see mascot in empty state
    await expect(page.getByAltText(/lockdn mascot/i)).toBeVisible()
    await expect(page.getByText(/no study guides yet/i)).toBeVisible()
  })

  test('should show empty state with mascot for exams', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByRole('link', { name: 'Study Materials' }).click()

    // Click on practice exams tab
    await page.getByRole('tab', { name: /practice exams/i }).click()

    // Should see mascot in empty state
    await expect(page.getByAltText(/lockdn mascot/i)).toBeVisible()
    await expect(page.getByText(/no practice exams yet/i)).toBeVisible()
  })
})
