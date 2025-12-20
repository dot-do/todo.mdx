/**
 * REST API Router
 */

import { Hono } from 'hono'
import { authMiddleware } from '../auth/index.js'
import { repos } from './repos.js'
import { issues } from './issues.js'
import { milestones } from './milestones.js'
import { widget } from './widget.js'
import type { Env } from '../types.js'

const api = new Hono<{ Bindings: Env }>()

// All API routes require auth
api.use('/*', authMiddleware)

// Mount sub-routers
api.route('/repos', repos)
api.route('/widget', widget)

// Nested routes under repos
api.route('/repos/:owner/:repo/issues', issues)
api.route('/repos/:owner/:repo/milestones', milestones)

export { api }
