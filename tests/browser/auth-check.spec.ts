import { test, expect, isAuthenticated, AUTH_SERVICES, type AuthService } from '../helpers/browser'

/**
 * Auth Check Tests
 *
 * These tests verify authentication status for various services.
 * Run with Chrome profile to use existing auth tokens:
 *
 *   USE_CHROME_PROFILE=true pnpm test:browser --project=chrome-profile
 *
 * Or in headed mode to see what's happening:
 *
 *   USE_CHROME_PROFILE=true pnpm test:browser:headed --project=chrome-profile
 */

test.describe('Authentication Status', () => {
  test('should detect GitHub authentication', async ({ authenticatedPage }) => {
    const isLoggedIn = await isAuthenticated(authenticatedPage, 'github')
    console.log(`GitHub authenticated: ${isLoggedIn}`)

    if (isLoggedIn) {
      // Verify we can access authenticated endpoints
      await authenticatedPage.goto('https://github.com/settings/profile')
      await expect(authenticatedPage.locator('h1')).toContainText('Public profile')
    } else {
      console.log('Skipping GitHub authenticated tests - not logged in')
    }
  })

  test('should detect ChatGPT authentication', async ({ authenticatedPage }) => {
    const isLoggedIn = await isAuthenticated(authenticatedPage, 'chatgpt')
    console.log(`ChatGPT authenticated: ${isLoggedIn}`)

    if (isLoggedIn) {
      // Verify we can access the chat interface
      await authenticatedPage.goto('https://chatgpt.com')
      // ChatGPT should show the chat input when logged in
      await expect(authenticatedPage.locator('textarea')).toBeVisible({ timeout: 10000 })
    } else {
      console.log('Skipping ChatGPT authenticated tests - not logged in')
    }
  })

  test('should detect Claude.ai authentication', async ({ authenticatedPage }) => {
    const isLoggedIn = await isAuthenticated(authenticatedPage, 'claude')
    console.log(`Claude.ai authenticated: ${isLoggedIn}`)

    if (isLoggedIn) {
      // Verify we can access the Claude interface
      await authenticatedPage.goto('https://claude.ai')
      // Should show the chat interface when logged in
      await expect(authenticatedPage.locator('[contenteditable="true"]')).toBeVisible({ timeout: 10000 })
    } else {
      console.log('Skipping Claude.ai authenticated tests - not logged in')
    }
  })

  test('should report all auth statuses', async ({ authenticatedPage }) => {
    const statuses: Record<AuthService, boolean> = {
      github: false,
      chatgpt: false,
      claude: false,
    }

    for (const service of Object.keys(AUTH_SERVICES) as AuthService[]) {
      statuses[service] = await isAuthenticated(authenticatedPage, service)
    }

    console.log('\n=== Auth Status Report ===')
    for (const [service, status] of Object.entries(statuses)) {
      console.log(`${service}: ${status ? '✓ authenticated' : '✗ not authenticated'}`)
    }
    console.log('==========================\n')

    // This test always passes - it's just for reporting
    expect(true).toBe(true)
  })
})
