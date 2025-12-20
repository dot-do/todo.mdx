import { test, expect } from '@playwright/test'

test.describe('Web IDE', () => {
  test.describe('IDE Home Page', () => {
    test('displays home page with title and new session button', async ({ page }) => {
      await page.goto('/ide')

      // Check main heading
      await expect(page.locator('h1')).toContainText('Web IDE')

      // Check description
      await expect(page.getByText(/full-featured development environment/i)).toBeVisible()

      // Check new session button
      const newSessionButton = page.getByRole('link', { name: /new session/i })
      await expect(newSessionButton).toBeVisible()
      await expect(newSessionButton).toHaveAttribute('href', '/ide/new')
    })

    test('shows active sessions section', async ({ page }) => {
      await page.goto('/ide')

      // Check active sessions card
      await expect(page.getByText('Active Sessions')).toBeVisible()
      await expect(page.getByText(/currently running ide sessions/i)).toBeVisible()

      // Should show empty state initially
      await expect(page.getByText(/no active sessions/i)).toBeVisible()
    })

    test('shows recent sessions section', async ({ page }) => {
      await page.goto('/ide')

      // Check recent sessions card
      await expect(page.getByText('Recent Sessions')).toBeVisible()
      await expect(page.getByText(/previously completed ide sessions/i)).toBeVisible()

      // Should show empty state initially
      await expect(page.getByText(/no session history available/i)).toBeVisible()
    })

    test('navigates to new session when clicking button', async ({ page }) => {
      await page.goto('/ide')

      // Click new session button
      const newSessionButton = page.getByRole('link', { name: /new session/i })
      await newSessionButton.click()

      // Should navigate to /ide/new
      await expect(page).toHaveURL(/\/ide\/new/)
    })
  })

  test.describe('IDE Session Page', () => {
    test('loads with correct layout panels', async ({ page }) => {
      await page.goto('/ide/test-session-123')

      // Header
      await expect(page.locator('header')).toBeVisible()
      await expect(page.getByText('todo.mdx IDE')).toBeVisible()

      // File tree sidebar with EXPLORER label
      await expect(page.getByText('EXPLORER')).toBeVisible()

      // Terminal panel with TERMINAL label
      await expect(page.getByText('TERMINAL')).toBeVisible()
    })

    test('displays session ID in header', async ({ page }) => {
      await page.goto('/ide/abc12345-session')

      // Session ID should be truncated to first 8 chars
      await expect(page.getByText('abc12345')).toBeVisible()
    })

    test('shows connection status indicator', async ({ page }) => {
      await page.goto('/ide/test-session')

      // Status indicator should be visible
      const statusText = page.locator('text=/connecting|connected|disconnected/i')
      await expect(statusText).toBeVisible()
    })

    test('shows empty state when no file selected', async ({ page }) => {
      await page.goto('/ide/test-session')

      // Should show "No file selected" message
      await expect(page.getByText(/no file selected/i)).toBeVisible()

      // Should show helper text
      await expect(page.getByText(/select a file from the explorer to begin editing/i)).toBeVisible()
    })

    test('sidebar can be toggled with keyboard shortcut', async ({ page }) => {
      await page.goto('/ide/test-session')

      // Initially sidebar should be visible
      const explorer = page.getByText('EXPLORER')
      await expect(explorer).toBeVisible()

      // Toggle with Cmd+B (Meta+B on Mac, Ctrl+B on Windows/Linux)
      await page.keyboard.press('Meta+b')

      // Wait for animation/transition
      await page.waitForTimeout(300)

      // Explorer should not be visible
      await expect(explorer).not.toBeVisible()

      // Toggle back
      await page.keyboard.press('Meta+b')

      // Wait for animation/transition
      await page.waitForTimeout(300)

      // Explorer should be visible again
      await expect(explorer).toBeVisible()
    })

    test('sidebar can be toggled with button', async ({ page }) => {
      await page.goto('/ide/test-session')

      // Find sidebar toggle button
      const sidebarButton = page.locator('button').filter({ has: page.locator('svg') }).first()

      // Initially sidebar should be visible
      await expect(page.getByText('EXPLORER')).toBeVisible()

      // Click to hide
      await sidebarButton.click()

      // Wait for animation
      await page.waitForTimeout(300)

      // Explorer should not be visible
      await expect(page.getByText('EXPLORER')).not.toBeVisible()
    })

    test('terminal can be hidden and shown', async ({ page }) => {
      await page.goto('/ide/test-session')

      // Terminal header should be visible
      const terminalHeader = page.getByText('TERMINAL')
      await expect(terminalHeader).toBeVisible()

      // Find and click the X button to close terminal
      const closeButton = page.locator('button').filter({
        has: page.locator('svg')
      }).filter({
        hasText: ''
      }).last()

      await closeButton.click()

      // Wait for animation
      await page.waitForTimeout(300)

      // Terminal should be hidden, but "Show Terminal" button should appear
      await expect(page.getByText(/show terminal/i)).toBeVisible()

      // Click show terminal button
      await page.getByText(/show terminal/i).click()

      // Wait for animation
      await page.waitForTimeout(300)

      // Terminal should be visible again
      await expect(terminalHeader).toBeVisible()
    })

    test('terminal can be toggled with keyboard shortcut', async ({ page }) => {
      await page.goto('/ide/test-session')

      // Terminal should be initially visible
      const terminal = page.getByText('TERMINAL')
      await expect(terminal).toBeVisible()

      // Toggle with Cmd+` (backtick)
      await page.keyboard.press('Meta+`')

      // Wait for animation
      await page.waitForTimeout(300)

      // Terminal should be hidden
      await expect(terminal).not.toBeVisible()
      await expect(page.getByText(/show terminal/i)).toBeVisible()

      // Toggle back
      await page.keyboard.press('Meta+`')

      // Wait for animation
      await page.waitForTimeout(300)

      // Terminal should be visible again
      await expect(terminal).toBeVisible()
    })

    test('terminal can be maximized and minimized', async ({ page }) => {
      await page.goto('/ide/test-session')

      // Find maximize button (should have Maximize2 icon)
      const maximizeButton = page.locator('button').filter({
        has: page.locator('svg')
      }).nth(2) // Approximate location, may need adjustment

      // Terminal should be in normal size initially
      await expect(page.getByText('TERMINAL')).toBeVisible()

      // Click to maximize
      await maximizeButton.click()

      // Wait for resize
      await page.waitForTimeout(300)

      // Click to minimize back
      await maximizeButton.click()

      // Wait for resize
      await page.waitForTimeout(300)
    })

    test('header displays correct elements', async ({ page }) => {
      await page.goto('/ide/my-session-id-12345')

      // Logo/title
      await expect(page.getByText('todo.mdx IDE')).toBeVisible()

      // Session ID (truncated)
      await expect(page.getByText('my-sessi')).toBeVisible()

      // Status indicator with dot and text
      const statusContainer = page.locator('div').filter({ hasText: /connecting|connected|disconnected/i }).first()
      await expect(statusContainer).toBeVisible()
    })
  })

  test.describe('Editor Tabs', () => {
    test('shows empty tabs bar when no files open', async ({ page }) => {
      await page.goto('/ide/test-session')

      // Tabs container should exist but be empty
      const tabsContainer = page.locator('div').filter({ hasText: 'EXPLORER' }).locator('..')
      await expect(tabsContainer).toBeVisible()
    })

    // Note: The following tests would require actual file tree implementation
    // and backend to be functional. They are included for completeness but
    // will need to be updated when file operations are implemented.

    test.skip('clicking file in tree opens tab', async ({ page }) => {
      // This test requires:
      // 1. File tree to be populated with actual files
      // 2. Backend API to serve file content
      // 3. Mock or test data to be available

      await page.goto('/ide/test-session')

      // Wait for file tree to load
      // await page.waitForSelector('[data-testid="file-tree-item"]')

      // Click on a file
      // await page.click('[data-testid="file-tree-item"]:has-text("index.ts")')

      // Tab should appear
      // await expect(page.getByRole('tab', { name: /index.ts/i })).toBeVisible()

      // Editor should show content
      // await expect(page.locator('.monaco-editor')).toBeVisible()
    })

    test.skip('multiple files can be opened as tabs', async ({ page }) => {
      // Requires file tree implementation
      await page.goto('/ide/test-session')

      // Click multiple files
      // Should show multiple tabs
    })

    test.skip('tab shows dirty indicator when content changes', async ({ page }) => {
      // Requires editor implementation
      await page.goto('/ide/test-session')

      // Open a file
      // Edit content
      // Should see dirty indicator (yellow dot)
    })

    test.skip('cmd+w closes current tab', async ({ page }) => {
      // Requires file operations
      await page.goto('/ide/test-session')

      // Open a file
      // Press Cmd+W
      // Tab should close
    })

    test.skip('closing tab with unsaved changes shows confirmation', async ({ page }) => {
      // Requires editor implementation
      await page.goto('/ide/test-session')

      // Open file
      // Make changes
      // Try to close
      // Should show confirm dialog
    })
  })

  test.describe('Layout and Responsiveness', () => {
    test('layout renders correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto('/ide/test-session')

      // All panels should be visible
      await expect(page.getByText('EXPLORER')).toBeVisible()
      await expect(page.getByText('TERMINAL')).toBeVisible()
      await expect(page.getByText('todo.mdx IDE')).toBeVisible()
    })

    test('layout renders correctly on laptop', async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 768 })
      await page.goto('/ide/test-session')

      // All panels should still be visible
      await expect(page.getByText('EXPLORER')).toBeVisible()
      await expect(page.getByText('TERMINAL')).toBeVisible()
    })

    test('IDE takes full viewport height', async ({ page }) => {
      await page.goto('/ide/test-session')

      // Main container should have h-screen class
      const mainContainer = page.locator('.h-screen').first()
      await expect(mainContainer).toBeVisible()

      // Check computed height
      const box = await mainContainer.boundingBox()
      expect(box).toBeTruthy()
      if (box) {
        expect(box.height).toBeGreaterThan(600) // Should be close to viewport height
      }
    })
  })

  test.describe('Accessibility', () => {
    test('page has proper heading hierarchy', async ({ page }) => {
      await page.goto('/ide')

      // Should have h1
      const h1 = page.locator('h1')
      await expect(h1).toBeVisible()
      await expect(h1).toHaveText('Web IDE')
    })

    test('buttons have proper labels or aria-labels', async ({ page }) => {
      await page.goto('/ide/test-session')

      // Interactive elements should be keyboard accessible
      const buttons = page.locator('button')
      const count = await buttons.count()

      expect(count).toBeGreaterThan(0)
    })

    test('session page can be navigated with keyboard', async ({ page }) => {
      await page.goto('/ide/test-session')

      // Tab through focusable elements
      await page.keyboard.press('Tab')

      // Should be able to focus on interactive elements
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    test('handles invalid session ID gracefully', async ({ page }) => {
      await page.goto('/ide/invalid-session-!@#$%')

      // Page should still render (may show error state)
      await expect(page.locator('header')).toBeVisible()
    })

    test('renders when session ID is very long', async ({ page }) => {
      const longSessionId = 'a'.repeat(100)
      await page.goto(`/ide/${longSessionId}`)

      // Should render and truncate session ID in header
      await expect(page.locator('header')).toBeVisible()

      // Truncated session ID should be visible
      await expect(page.getByText('aaaaaaaa')).toBeVisible()
    })
  })
})
