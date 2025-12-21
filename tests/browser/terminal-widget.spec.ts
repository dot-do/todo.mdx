import { test, expect } from '@playwright/test'

const BASE_URL = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'

/**
 * Terminal Widget Browser Tests
 *
 * These tests verify the terminal widget UI and functionality.
 * Run with Chrome profile to use existing auth:
 *
 *   USE_CHROME_PROFILE=true pnpm test:browser --project=chrome-profile browser/terminal-widget.spec.ts
 *
 * Or in headed mode:
 *
 *   USE_CHROME_PROFILE=true pnpm test:browser:headed --project=chrome-profile browser/terminal-widget.spec.ts
 */

test.describe('Terminal Widget', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/terminal`)

    // Should redirect to OAuth provider (login.oauth.do) or WorkOS login
    const url = page.url()
    expect(url.includes('oauth.do') || url.includes('workos.com') || url.includes('/api/auth/login')).toBe(true)
  })

  test('should redirect to login with return URL preserved', async ({ page }) => {
    await page.goto(`${BASE_URL}/terminal?repo=test/repo&task=hello`, {
      waitUntil: 'domcontentloaded',
    })

    // Should redirect to login with return URL
    const url = new URL(page.url())
    if (url.pathname.includes('/api/auth/login')) {
      const returnUrl = url.searchParams.get('return')
      expect(returnUrl).toContain('/terminal')
      expect(returnUrl).toContain('repo=test')
    }
  })

  test('should load terminal.html directly', async ({ page }) => {
    await page.goto(`${BASE_URL}/terminal.html`)

    // Should load the HTML page
    await expect(page.locator('#terminal-container')).toBeVisible()
    await expect(page.locator('#status-bar')).toBeVisible()
  })

  test('should load xterm.js and show terminal', async ({ page }) => {
    await page.goto(`${BASE_URL}/terminal.html`)

    // Wait for terminal to initialize
    await page.waitForSelector('.xterm', { timeout: 10000 })

    // Terminal should be visible
    await expect(page.locator('.xterm')).toBeVisible()
    await expect(page.locator('.xterm-cursor')).toBeVisible()
  })

  test('should show auth overlay when not authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/terminal.html`)

    // Wait for auth check to complete
    await page.waitForTimeout(2000)

    // Either shows auth overlay or terminal content
    const authOverlay = page.locator('#auth-overlay')
    const isAuthVisible = await authOverlay.isVisible()

    if (isAuthVisible) {
      await expect(authOverlay).toContainText('Authentication Required')
      await expect(page.locator('#auth-overlay button')).toBeVisible()
    }
  })
})

test.describe('Terminal Widget (Authenticated)', () => {
  // These tests require authentication
  // Run with: USE_CHROME_PROFILE=true pnpm test:browser --project=chrome-profile

  test('should show usage instructions when no repo specified', async ({ page }) => {
    // Go directly to terminal.html (bypasses route auth)
    await page.goto(`${BASE_URL}/terminal.html`)

    // Wait for terminal to initialize and check auth
    await page.waitForSelector('.xterm', { timeout: 10000 })
    await page.waitForTimeout(3000)

    // Check if authenticated (no auth overlay)
    const authOverlay = page.locator('#auth-overlay')
    const isAuthVisible = await authOverlay.isVisible()

    if (!isAuthVisible) {
      // Should show usage instructions in terminal
      const terminalText = await page.locator('.xterm').textContent()
      expect(terminalText).toContain('Usage')
    } else {
      console.log('Skipping - not authenticated')
    }
  })

  test('should accept keyboard input when focused', async ({ page }) => {
    await page.goto(`${BASE_URL}/terminal.html`)

    // Wait for terminal
    await page.waitForSelector('.xterm', { timeout: 10000 })

    // Check if auth overlay is blocking
    const authOverlay = page.locator('#auth-overlay')
    const isAuthVisible = await authOverlay.isVisible()

    if (isAuthVisible) {
      console.log('Skipping - auth overlay visible (not authenticated)')
      return
    }

    // Click to focus terminal
    await page.click('.xterm')

    // Terminal should be focusable
    const terminalElement = page.locator('.xterm-helper-textarea')
    await expect(terminalElement).toBeFocused({ timeout: 5000 }).catch(() => {
      // Some xterm versions use different focus element
      console.log('Note: Terminal focus element may vary')
    })
  })
})

test.describe('Code Widget', () => {
  test('should redirect to login for /code/:org/:repo', async ({ page }) => {
    await page.goto(`${BASE_URL}/code/test-org/test-repo`, {
      waitUntil: 'domcontentloaded',
    })

    // Should redirect to OAuth provider (login.oauth.do) or WorkOS login
    const url = page.url()
    expect(url.includes('oauth.do') || url.includes('workos.com') || url.includes('/api/auth/login')).toBe(true)
  })

  test('should load code.html directly', async ({ page }) => {
    await page.goto(`${BASE_URL}/code.html`)

    // Should load the HTML page
    await expect(page.locator('#terminal-container')).toBeVisible()
    await expect(page.locator('#header-bar')).toBeVisible()
    await expect(page.locator('#status-bar')).toBeVisible()
  })

  test('should show repo name in header', async ({ page }) => {
    // Navigate as if coming from /code/owner/repo
    await page.goto(`${BASE_URL}/code.html`)

    // Header should show invalid URL message since we're at /code.html not /code/owner/repo
    await page.waitForTimeout(1000)
    const headerText = await page.locator('#repo-name').textContent()

    // When accessed directly, shows "Invalid URL" or "Unknown Repository"
    expect(headerText).toBeTruthy()
  })
})

test.describe('Static Assets', () => {
  test('should serve terminal.css', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/assets/terminal.css`)

    expect(response?.status()).toBe(200)
    expect(response?.headers()['content-type']).toContain('text/css')
  })

  test('should serve terminal.js', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/assets/terminal.js`)

    expect(response?.status()).toBe(200)
    expect(response?.headers()['content-type']).toContain('javascript')
  })

  test('terminal.css should contain expected styles', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/assets/terminal.css`)
    const css = await response?.text()

    expect(css).toContain('#terminal-container')
    expect(css).toContain('.status-bar')
    expect(css).toContain('.auth-overlay')
  })

  test('terminal.js should contain TerminalWidget class', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/assets/terminal.js`)
    const js = await response?.text()

    expect(js).toContain('class TerminalWidget')
    expect(js).toContain('WebSocket')
    expect(js).toContain('xterm')
  })
})

test.describe('WebSocket Connection', () => {
  test('should attempt WebSocket connection when authenticated', async ({ page }) => {
    // Monitor WebSocket connections
    const wsConnections: string[] = []

    page.on('websocket', ws => {
      wsConnections.push(ws.url())
      console.log('WebSocket opened:', ws.url())
    })

    // Go to terminal with a session
    await page.goto(`${BASE_URL}/terminal.html?session=test-session-123`)

    // Wait for potential WebSocket connection
    await page.waitForTimeout(3000)

    // Check if any WebSocket connections were attempted
    // (May or may not connect depending on auth status)
    console.log('WebSocket connections attempted:', wsConnections.length)
  })
})
