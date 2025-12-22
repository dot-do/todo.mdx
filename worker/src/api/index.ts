/**
 * REST API Router
 */

import { Hono } from 'hono'
import { authMiddleware } from '../auth/index.js'
import { rateLimitMiddleware } from '../middleware/ratelimit.js'
import { repos } from './repos.js'
import { widget } from './widget.js'
import { search } from './search.js'
import { models } from './models.js'
import { agents } from './agents.js'
import code from './code.js'
import terminal from './terminal.js'
import { browser } from '../browser/api.js'
import type { Env } from '../types.js'

const api = new Hono<{ Bindings: Env }>()

// All API routes require auth
api.use('/*', authMiddleware)

// Mount sub-routers
api.route('/repos', repos)
api.route('/widget', widget)
api.route('/search', search)
api.route('/models', models)
api.route('/agents', agents)
api.route('/code', code)
api.route('/terminal', terminal)

// Browser routes with strict rate limiting to prevent session abuse
api.use('/browser/*', rateLimitMiddleware('browser'))
api.route('/browser', browser)

export { api }
