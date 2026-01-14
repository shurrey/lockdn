import { test, expect } from '@playwright/test'

test.describe('Courses Management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear IndexedDB and complete onboarding
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
    await page.getByRole('button', { name: /skip setup/i }).click()
    await page.getByRole('button', { name: /go to dashboard|finish|complete/i }).click()
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 })
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

    // Course should appear in the list
    await expect(page.getByText('CS101')).toBeVisible()
    await expect(page.getByText('Introduction to Computer Science')).toBeVisible()
  })

  test('should add assignment to course', async ({ page }) => {
    // First add a course
    await page.getByRole('link', { name: 'Courses', exact: true }).click()
    await page.getByRole('button', { name: /add course/i }).first().click()
    await page.getByLabel(/course code/i).fill('CS101')
    await page.getByLabel(/course name/i).fill('Intro to CS')
    await page.getByRole('button', { name: 'Create Course' }).click()

    // Click on the course to view details
    await page.getByText('CS101').click()

    // Add an assignment
    await page.getByRole('button', { name: /add assignment/i }).click()
    await page.getByLabel(/title/i).fill('Homework 1')
    await page.getByRole('button', { name: /save|add|create/i }).click()

    // Assignment should appear
    await expect(page.getByText('Homework 1')).toBeVisible()
  })

  test('should delete a course', async ({ page }) => {
    // First add a course
    await page.getByRole('link', { name: 'Courses', exact: true }).click()
    await page.getByRole('button', { name: /add course/i }).first().click()
    await page.getByLabel(/course code/i).fill('CS101')
    await page.getByLabel(/course name/i).fill('Intro to CS')
    await page.getByRole('button', { name: 'Create Course' }).click()

    // Click on the course
    await page.getByText('CS101').click()

    // Archive the course
    await page.getByRole('button', { name: /archive/i }).click()

    // Confirm if there's a dialog
    const confirmButton = page.getByRole('button', { name: /confirm|yes|archive/i })
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click()
    }

    // Course should be gone
    await expect(page.getByText(/no courses yet/i)).toBeVisible({ timeout: 5000 })
  })
})
