import { test as base, chromium, expect } from '@playwright/test'

const DEBUG_PORT = process.env.CHROME_DEBUG_PORT || '9222'

/**
 * CDP Connection Test
 *
 * This connects to a running Chrome instance via Chrome DevTools Protocol.
 * The Chrome must be started with --remote-debugging-port=9222
 *
 * Start Chrome first:
 *   ./scripts/start-chrome-debug.sh "Profile 6"
 *
 * Then run:
 *   CHROME_DEBUG_PORT=9222 npx playwright test browser/cdp-auth-test.spec.ts
 */
base.describe('CDP Auth Check', () => {
  base('connect to running Chrome and check GitHub auth', async () => {
    let browser

    try {
      // Connect to running Chrome
      console.log(`Connecting to Chrome on port ${DEBUG_PORT}...`)
      browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`)
      console.log('Connected!')

      // Get existing contexts
      const contexts = browser.contexts()
      console.log(`Found ${contexts.length} browser contexts`)

      if (contexts.length === 0) {
        console.log('No contexts found, creating new one')
        const context = await browser.newContext()
        const page = await context.newPage()
        await page.goto('https://github.com')

        const signedIn = await page.locator('[data-login]').isVisible({ timeout: 5000 }).catch(() => false)
        console.log('GitHub authenticated:', signedIn)
      } else {
        // Use existing context
        const context = contexts[0]
        const pages = context.pages()
        console.log(`Found ${pages.length} existing pages`)

        // Create new page in existing context
        const page = await context.newPage()
        await page.goto('https://github.com')

        const signedIn = await page.locator('[data-login]').isVisible({ timeout: 5000 }).catch(() => false)
        console.log('GitHub authenticated:', signedIn)

        if (signedIn) {
          // Get username
          const username = await page.locator('[data-login]').getAttribute('data-login')
          console.log('Logged in as:', username)
        }

        await page.close()
      }
    } catch (e: any) {
      if (e.message?.includes('ECONNREFUSED')) {
        console.log('Could not connect to Chrome. Start it first:')
        console.log('  ./scripts/start-chrome-debug.sh "Profile 6"')
      } else {
        throw e
      }
    } finally {
      // Don't close the browser - we're just connected to it
    }
  })

  base('check ChatGPT auth via CDP', async () => {
    let browser

    try {
      browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`)
      const context = browser.contexts()[0] || await browser.newContext()
      const page = await context.newPage()

      await page.goto('https://chatgpt.com')
      await page.waitForTimeout(2000)

      // Check for profile button (logged in) or sign in button
      const profileBtn = await page.locator('[data-testid="profile-button"]').isVisible({ timeout: 5000 }).catch(() => false)
      console.log('ChatGPT authenticated:', profileBtn)

      await page.close()
    } catch (e: any) {
      if (e.message?.includes('ECONNREFUSED')) {
        base.skip(true, 'Chrome not running with debug port')
      } else {
        throw e
      }
    }
  })

  base('check Claude.ai auth via CDP', async () => {
    let browser

    try {
      browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`)
      const context = browser.contexts()[0] || await browser.newContext()
      const page = await context.newPage()

      await page.goto('https://claude.ai')
      await page.waitForTimeout(2000)

      // Check for chat input (logged in)
      const chatInput = await page.locator('[contenteditable="true"]').isVisible({ timeout: 5000 }).catch(() => false)
      console.log('Claude.ai authenticated:', chatInput)

      await page.close()
    } catch (e: any) {
      if (e.message?.includes('ECONNREFUSED')) {
        base.skip(true, 'Chrome not running with debug port')
      } else {
        throw e
      }
    }
  })
})
