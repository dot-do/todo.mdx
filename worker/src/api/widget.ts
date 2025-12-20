/**
 * Widget API
 * GET /api/widget/token - Get WorkOS widget token for API key management
 */

import { Hono } from 'hono'
import { getWidgetToken } from '../auth/workos.js'
import type { Env } from '../types.js'

const widget = new Hono<{ Bindings: Env }>()

// Get widget token for API key management
widget.get('/token', async (c) => {
  const auth = c.get('auth')

  try {
    const token = await getWidgetToken(auth.userId, auth.organizationId, c.env)

    return c.json({ token })
  } catch (error) {
    return c.json({
      error: 'widget_error',
      message: (error as Error).message,
    }, 500)
  }
})

export { widget }
