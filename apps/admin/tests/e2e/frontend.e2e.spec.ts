import { test, expect } from '@playwright/test'

/**
 * TDD E2E Tests for TODO.mdx Admin
 *
 * These tests define the DESIRED behavior (RED phase).
 * We then implement the features to make them pass (GREEN phase).
 */
test.describe('TODO.mdx Admin', () => {
  test('homepage displays TODO.mdx branding', async ({ page }) => {
    await page.goto('/')

    // Title should be TODO.mdx, not "Payload Blank Template"
    await expect(page).toHaveTitle(/TODO\.mdx/)

    // Should have proper welcome heading
    const heading = page.locator('h1').first()
    await expect(heading).toHaveText('TODO.mdx Admin')
  })

  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/admin')

    // Should redirect to login page
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})
