# Web IDE E2E Tests

Playwright-based end-to-end tests for the todo.mdx Web IDE.

## Running Tests

```bash
# Run all tests in headless mode
pnpm test:e2e

# Run tests in UI mode (interactive)
pnpm test:e2e:ui

# Run tests in debug mode
pnpm test:e2e:debug

# Run specific test file
pnpm test:e2e tests/e2e/ide.spec.ts

# Run tests in specific browser
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit
```

## Test Coverage

### IDE Home Page Tests (`/ide`)
- Displays main heading and description
- Shows "New Session" button
- Displays active sessions section (empty state)
- Displays recent sessions section (empty state)
- Navigation to new session creation

### IDE Session Page Tests (`/ide/[sessionId]`)

#### Layout Tests
- Header with logo, session ID, and status indicators
- File tree sidebar (EXPLORER panel)
- Monaco editor area
- Terminal panel (TERMINAL)

#### Interaction Tests
- Sidebar toggle (Cmd+B keyboard shortcut + button)
- Terminal toggle (Cmd+` keyboard shortcut + button)
- Terminal maximize/minimize
- Session ID display (truncated to 8 chars)
- Connection status indicator

#### Empty States
- "No file selected" message when no file is open
- Helper text for file selection

#### Responsiveness
- Desktop layout (1920x1080)
- Laptop layout (1366x768)
- Full viewport height layout

#### Accessibility
- Proper heading hierarchy
- Keyboard navigation
- Button labels and aria attributes

#### Error Handling
- Invalid session ID handling
- Long session ID handling

### Editor Tab Tests
- Empty tabs bar display
- Skipped tests (require file operations):
  - Opening files from tree
  - Multiple tabs
  - Dirty indicators
  - Cmd+W to close tabs
  - Unsaved changes confirmation

## Test Structure

Tests are organized by feature area:
1. **IDE Home Page** - Landing page and session list
2. **IDE Session Page** - Main IDE interface
3. **Editor Tabs** - File tab management (partially implemented)
4. **Layout and Responsiveness** - Screen size handling
5. **Accessibility** - a11y compliance
6. **Error Handling** - Edge cases and invalid input

## Configuration

See `playwright.config.ts` for:
- Browser configurations (Chromium, Firefox, WebKit)
- Base URL: `http://localhost:3005`
- Test directory: `./tests/e2e`
- Retry strategy (2 retries on CI)
- Dev server auto-start
- Screenshot and video capture on failure

## Writing New Tests

Follow the existing pattern:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/your-route')

    // Assertions
    await expect(page.locator('selector')).toBeVisible()
  })
})
```

### Best Practices

1. Use semantic selectors (roles, text) over CSS selectors
2. Wait for animations with `page.waitForTimeout()` if needed
3. Use `test.skip()` for tests requiring unimplemented features
4. Group related tests in `test.describe()` blocks
5. Keep tests independent - no shared state between tests

## CI/CD Integration

Tests run automatically via `webServer` configuration:
- Starts dev server on port 3005
- Waits for server to be ready (120s timeout)
- Runs tests against local server
- Reuses existing server in development

In CI environments:
- Runs with 2 retries
- Uses single worker (no parallelization)
- Captures screenshots and videos on failure
- Generates HTML report

## Troubleshooting

### Tests fail to start
```bash
# Install Playwright browsers
npx playwright install
```

### Server not starting
```bash
# Check if port 3005 is available
lsof -i :3005

# Start dev server manually
pnpm dev
```

### Flaky tests
- Increase timeout for animations
- Use `waitForSelector()` for dynamic content
- Check for race conditions

### Type errors
```bash
# Run typecheck
pnpm typecheck
```

## TODO

- [ ] Add file tree interaction tests when backend is ready
- [ ] Add Monaco editor content tests
- [ ] Add terminal WebSocket interaction tests
- [ ] Add file save/edit workflow tests
- [ ] Add multi-file tab management tests
- [ ] Add keyboard shortcut comprehensive tests
- [ ] Add visual regression testing
