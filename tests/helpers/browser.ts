import { test as base, chromium, webkit, type BrowserContext, type Page, type Cookie } from '@playwright/test'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

/**
 * Chrome profile paths by platform
 */
const CHROME_PROFILES = {
  darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome'),
  win32: path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
  linux: path.join(os.homedir(), '.config', 'google-chrome'),
} as const

/**
 * Get Chrome profile path for current platform
 */
export function getChromeProfilePath(): string {
  const platform = os.platform() as keyof typeof CHROME_PROFILES
  return process.env.CHROME_PROFILE_PATH || CHROME_PROFILES[platform] || CHROME_PROFILES.linux
}

/**
 * Get which profile directory to use (e.g., "Default", "Profile 1", "Profile 6")
 * Set CHROME_PROFILE_DIR env var to override (default: "Default")
 */
export function getChromeProfileDir(): string {
  return process.env.CHROME_PROFILE_DIR || 'Default'
}

/**
 * Check if Chrome profile exists
 */
export async function chromeProfileExists(): Promise<boolean> {
  const fs = await import('fs/promises')
  try {
    await fs.access(getChromeProfilePath())
    return true
  } catch {
    return false
  }
}

/**
 * Copy Chrome profile to temp directory to avoid singleton lock
 * This allows testing while Chrome is still running
 */
export async function copyProfileToTemp(): Promise<{ tempPath: string; profileDir: string }> {
  const fs = await import('fs/promises')
  const sourcePath = getChromeProfilePath()
  const profileDir = getChromeProfileDir()
  const tempPath = path.join(os.tmpdir(), `chrome-profile-test-${Date.now()}`)

  // Copy only essential files (cookies, local storage, etc.)
  // Full profile copy would be too slow
  await fs.mkdir(tempPath, { recursive: true })
  await fs.mkdir(path.join(tempPath, profileDir), { recursive: true })

  const filesToCopy = [
    `${profileDir}/Cookies`,
    `${profileDir}/Login Data`,
    `${profileDir}/Web Data`,
    `${profileDir}/Preferences`,
    `${profileDir}/Network/Cookies`, // Newer Chrome versions
    'Local State',
  ]

  for (const file of filesToCopy) {
    try {
      const src = path.join(sourcePath, file)
      const dest = path.join(tempPath, file)
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.copyFile(src, dest)
    } catch {
      // File may not exist, skip
    }
  }

  return { tempPath, profileDir }
}

/**
 * Get Safari cookies for specific domains using macOS keychain
 * Requires: pip install browser-cookie3 (or manual cookie export)
 */
export async function getSafariCookies(domains: string[]): Promise<Cookie[]> {
  // Safari cookies are in ~/Library/Cookies/Cookies.binarycookies
  // We'll use a Python script to extract them since the format is binary
  const cookies: Cookie[] = []

  try {
    // Try using browser-cookie3 if available
    const script = `
import browser_cookie3
import json

cj = browser_cookie3.safari(domain_name=None)
cookies = []
for c in cj:
    cookies.append({
        'name': c.name,
        'value': c.value,
        'domain': c.domain,
        'path': c.path,
        'expires': c.expires or -1,
        'httpOnly': bool(c.get_nonstandard_attr('HttpOnly')),
        'secure': c.secure,
        'sameSite': 'Lax'
    })
print(json.dumps(cookies))
`
    const result = execSync(`python3 -c "${script}"`, { encoding: 'utf-8' })
    const allCookies = JSON.parse(result) as Cookie[]

    // Filter to requested domains
    for (const cookie of allCookies) {
      if (domains.some(d => cookie.domain?.includes(d))) {
        cookies.push(cookie)
      }
    }
  } catch (e) {
    console.log('Could not extract Safari cookies. Install browser-cookie3: pip install browser-cookie3')
    console.log('Error:', e)
  }

  return cookies
}

/**
 * Export cookies from Safari using AppleScript (simpler approach)
 */
export async function exportSafariSession(): Promise<string | null> {
  // This creates a Safari state file that can be used
  // Note: This is a placeholder - Safari doesn't easily export sessions
  console.log('Safari session export not yet implemented')
  console.log('For now, close Chrome and use Chrome profile, or manually export cookies')
  return null
}

/**
 * Known service URLs for auth checking
 */
export const AUTH_SERVICES = {
  github: {
    url: 'https://github.com',
    checkUrl: 'https://github.com/settings/profile',
    signedInSelector: '[data-login]',
  },
  chatgpt: {
    url: 'https://chatgpt.com',
    checkUrl: 'https://chatgpt.com',
    signedInSelector: '[data-testid="profile-button"]',
  },
  claude: {
    url: 'https://claude.ai',
    checkUrl: 'https://claude.ai',
    signedInSelector: '[data-testid="user-menu"]',
  },
} as const

export type AuthService = keyof typeof AUTH_SERVICES

/**
 * Check if user is authenticated to a service
 */
export async function isAuthenticated(page: Page, service: AuthService): Promise<boolean> {
  const config = AUTH_SERVICES[service]
  try {
    await page.goto(config.checkUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    // Wait briefly for dynamic content
    await page.waitForTimeout(2000)
    const signedIn = await page.locator(config.signedInSelector).isVisible({ timeout: 5000 }).catch(() => false)
    return signedIn
  } catch {
    return false
  }
}

/**
 * Extended test fixture with persistent Chrome context
 *
 * Usage:
 *   import { test, expect } from '../helpers/browser'
 *
 *   test('can access GitHub when authenticated', async ({ authenticatedPage }) => {
 *     await authenticatedPage.goto('https://github.com')
 *     // ... test with real auth
 *   })
 *
 * For Safari cookies (WebKit):
 *   test('with safari cookies', async ({ safariPage }) => {
 *     await safariPage.goto('https://github.com')
 *   })
 */
export const test = base.extend<{
  authenticatedContext: BrowserContext
  authenticatedPage: Page
  safariContext: BrowserContext
  safariPage: Page
}>({
  // Chrome with copied profile (works even when Chrome is running)
  authenticatedContext: async ({}, use) => {
    const fs = await import('fs/promises')
    let tempProfilePath: string | null = null
    let context: BrowserContext
    const profileDir = getChromeProfileDir()

    try {
      // Copy profile to temp to avoid singleton lock
      const { tempPath } = await copyProfileToTemp()
      tempProfilePath = tempPath
      console.log(`Using Chrome profile: ${profileDir} (copied to ${tempPath})`)
      context = await chromium.launchPersistentContext(tempPath, {
        channel: 'chrome',
        headless: false,
        args: [
          `--profile-directory=${profileDir}`,
          '--disable-blink-features=AutomationControlled',
        ],
      })
    } catch (e) {
      // Fallback: try original path (Chrome must be closed)
      console.log('Could not copy profile, trying original (close Chrome if running)')
      const profilePath = getChromeProfilePath()
      context = await chromium.launchPersistentContext(profilePath, {
        channel: 'chrome',
        headless: false,
        args: [
          `--profile-directory=${profileDir}`,
          '--disable-blink-features=AutomationControlled',
        ],
      })
    }

    await use(context)
    await context.close()

    // Cleanup temp profile
    if (tempProfilePath) {
      try {
        await fs.rm(tempProfilePath, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  },

  authenticatedPage: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage()
    await use(page)
    await page.close()
  },

  // WebKit with Safari cookies injected
  safariContext: async ({}, use) => {
    const context = await webkit.launch({ headless: false })
    const browserContext = await context.newContext()

    // Try to inject Safari cookies
    const cookies = await getSafariCookies(['github.com', 'openai.com', 'claude.ai', 'anthropic.com'])
    if (cookies.length > 0) {
      await browserContext.addCookies(cookies)
      console.log(`Injected ${cookies.length} Safari cookies`)
    }

    await use(browserContext)
    await browserContext.close()
    await context.close()
  },

  safariPage: async ({ safariContext }, use) => {
    const page = await safariContext.newPage()
    await use(page)
    await page.close()
  },
})

export { expect } from '@playwright/test'

/**
 * Helper to skip test if not authenticated
 */
export function skipIfNotAuthenticated(service: AuthService) {
  return async ({ authenticatedPage }: { authenticatedPage: Page }) => {
    const authenticated = await isAuthenticated(authenticatedPage, service)
    if (!authenticated) {
      test.skip(true, `Not authenticated to ${service}. Sign in via Chrome first.`)
    }
  }
}
