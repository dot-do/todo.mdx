import { test as base, chromium } from '@playwright/test'
import { copyProfileToTemp, getChromeProfilePath, getChromeProfileDir } from '../helpers/browser'

/**
 * Quick auth diagnostic - just checks if we can load pages with cookies
 */
base.describe('Quick Auth Check', () => {
  base('check GitHub auth via copied profile', async () => {
    let tempPath: string | null = null
    const profileDir = getChromeProfileDir()

    try {
      // Copy profile to temp
      console.log(`Copying Chrome profile "${profileDir}"...`)
      const result = await copyProfileToTemp()
      tempPath = result.tempPath
      console.log('Profile copied to:', tempPath)

      // Launch with copied profile
      const context = await chromium.launchPersistentContext(tempPath, {
        channel: 'chrome',
        headless: false,
        args: [`--profile-directory=${profileDir}`],
      })

      const page = await context.newPage()

      // Quick check - just load GitHub
      console.log('Loading GitHub...')
      await page.goto('https://github.com', { timeout: 15000 })

      // Check if logged in (look for avatar or sign in button)
      const signInVisible = await page.locator('a[href="/login"]').isVisible({ timeout: 3000 }).catch(() => false)
      const avatarVisible = await page.locator('[data-login]').isVisible({ timeout: 3000 }).catch(() => false)

      console.log('Sign in button visible:', signInVisible)
      console.log('Avatar visible:', avatarVisible)
      console.log('Authenticated:', avatarVisible && !signInVisible)

      await context.close()
    } finally {
      // Cleanup
      if (tempPath) {
        const fs = await import('fs/promises')
        await fs.rm(tempPath, { recursive: true, force: true }).catch(() => {})
      }
    }
  })
})
