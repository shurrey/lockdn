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

test.describe('Courses Management', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page)
  })

  test('should navigate to courses page', async ({ page }) => {
    await page.getByRole('link', { name: 'Courses', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible()
  })

  test('should show empty state with mascot when no courses', async ({ page }) => {
    await page.getByRole('link', { name: 'Courses', exact: true }).click()

    // Should see the mascot and empty state message
    await expect(page.getByAltText(/lockdn mascot/i)).toBeVisible()
    await expect(page.getByText(/no courses yet/i)).toBeVisible()
  })

  test('should open add course dialog', async ({ page }) => {
    await page.getByRole('link', { name: 'Courses', exact: true }).click()
    await page.getByRole('button', { name: /add course/i }).first().click()

    // Dialog should be visible
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel(/course code/i)).toBeVisible()
  })

  test('should add a new course manually', async ({ page }) => {
    await page.getByRole('link', { name: 'Courses', exact: true }).click()
    await page.getByRole('button', { name: /add course/i }).first().click()

    // Fill in course details
    await page.getByLabel(/course code/i).fill('CS101')
    await page.getByLabel(/course name/i).fill('Introduction to Computer Science')
    await page.getByLabel(/instructor/i).fill('Dr. Smith')

    // Save the course
    await page.getByRole('button', { name: 'Create Course' }).click()

    // Course should appear in the list - use exact match to avoid toast conflict
    await expect(page.getByText('CS101', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Introduction to Computer Science')).toBeVisible()
  })

  test('should add assignment to course', async ({ page }) => {
    // First add a course
    await page.getByRole('link', { name: 'Courses', exact: true }).click()
    await page.getByRole('button', { name: /add course/i }).first().click()
    await page.getByLabel(/course code/i).fill('CS101')
    await page.getByLabel(/course name/i).fill('Intro to CS')
    await page.getByRole('button', { name: 'Create Course' }).click()

    // Wait for toast to disappear to avoid click interception
    await page.waitForTimeout(1500)

    // Click on the course card to expand it
    await page.locator('[data-slot="card"]').filter({ hasText: 'CS101' }).click()

    // Add an assignment - button says "Add" with plus icon in the Assignments section
    await page.getByRole('button', { name: /^add$/i }).click()
    await page.getByLabel(/title/i).fill('Homework 1')
    // Also need to set a due date as it's required
    await page.getByLabel(/due date/i).fill('2025-12-31')
    await page.getByRole('button', { name: /add assignment/i }).click()

    // Assignment should appear in the course card
    await expect(page.getByText('Homework 1')).toBeVisible()
  })

  test('should delete a course', async ({ page }) => {
    // First add a course
    await page.getByRole('link', { name: 'Courses', exact: true }).click()
    await page.getByRole('button', { name: /add course/i }).first().click()
    await page.getByLabel(/course code/i).fill('CS101')
    await page.getByLabel(/course name/i).fill('Intro to CS')
    await page.getByRole('button', { name: 'Create Course' }).click()

    // Wait for toast to disappear
    await page.waitForTimeout(1500)

    // Click on the course card to expand it
    await page.locator('[data-slot="card"]').filter({ hasText: 'CS101' }).click()

    // Archive the course - find archive button with title attribute
    await page.getByRole('button', { name: /archive course/i }).click()

    // Confirm archive in dialog - button is just "Archive"
    await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click()

    // Course should be gone
    await expect(page.getByText(/no courses yet/i)).toBeVisible({ timeout: 5000 })
  })
})
