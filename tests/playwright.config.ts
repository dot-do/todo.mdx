import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import os from 'os'

/**
 * Chrome profile paths by platform
 * These are the default Chrome user data directories
 */
const CHROME_PROFILES = {
  darwin: path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome'),
  win32: path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
  linux: path.join(os.homedir(), '.config', 'google-chrome'),
} as const

const platform = os.platform() as keyof typeof CHROME_PROFILES
const defaultChromeProfile = CHROME_PROFILES[platform] || CHROME_PROFILES.linux

/**
 * Get Chrome profile path from env or use default
 * Set CHROME_PROFILE_PATH env var to override
 */
const chromeProfilePath = process.env.CHROME_PROFILE_PATH || defaultChromeProfile

/**
 * Whether to use persistent Chrome profile (for auth testing)
 * Set USE_CHROME_PROFILE=true to enable
 */
const useChromeProfile = process.env.USE_CHROME_PROFILE === 'true'

/**
 * Playwright configuration for browser E2E tests
 *
 * For authenticated testing (GitHub, ChatGPT, Claude.ai), run with:
 *   USE_CHROME_PROFILE=true pnpm test:browser
 *
 * This uses your actual Chrome profile with existing auth tokens.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './browser',

  // Run tests in files in parallel (unless using persistent context)
  fullyParallel: !useChromeProfile,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Sequential when using profile to avoid conflicts
  workers: useChromeProfile ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Shared settings for all the projects below
  use: {
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects
  projects: [
    // Standard Chromium tests (isolated, no auth)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Chrome with persistent profile (for authenticated testing)
    {
      name: 'chrome-profile',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome', // Use actual Chrome, not Chromium
        launchOptions: {
          args: useChromeProfile ? [
            `--user-data-dir=${chromeProfilePath}`,
            '--profile-directory=Default',
            // Disable some features that cause issues with automation
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
          ] : [],
        },
      },
    },

    // Firefox (optional)
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // WebKit/Safari (optional)
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Output directory for test artifacts
  outputDir: 'test-results',
})
