/**
 * Models API
 * GET /api/models - List available models
 * POST /api/models/sync - Sync models from OpenRouter
 */

import { Hono } from 'hono'
import type { Env } from '../types.js'

const models = new Hono<{ Bindings: Env }>()

interface OpenRouterModel {
  id: string
  name: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
  }
  architecture?: {
    modality?: string[]
  }
  top_provider?: {
    context_length?: number
  }
}

interface OpenRouterResponse {
  data: OpenRouterModel[]
}

// List available models
models.get('/', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT
        id,
        modelId,
        name,
        provider,
        contextLength,
        pricing,
        capabilities,
        status,
        tier,
        bestFor,
        lastSyncedAt,
        updatedAt
      FROM models
      WHERE status != 'hidden'
      ORDER BY
        CASE status
          WHEN 'recommended' THEN 1
          WHEN 'available' THEN 2
          WHEN 'deprecated' THEN 3
          ELSE 4
        END,
        provider,
        name
    `).all()

    return c.json({
      models: result.results.map((model: any) => ({
        id: model.id,
        modelId: model.modelId,
        name: model.name,
        provider: model.provider,
        contextLength: model.contextLength,
        pricing: model.pricing ? JSON.parse(model.pricing) : null,
        capabilities: model.capabilities ? JSON.parse(model.capabilities) : null,
        status: model.status,
        tier: model.tier,
        bestFor: model.bestFor ? JSON.parse(model.bestFor) : null,
        lastSyncedAt: model.lastSyncedAt,
        updatedAt: model.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Failed to list models:', error)
    return c.json({ error: 'internal_error', message: 'Failed to list models' }, 500)
  }
})

// Sync models from OpenRouter
models.post('/sync', async (c) => {
  const auth = c.get('auth')

  // Only admins can sync models
  // TODO: Check user role when admin auth is implemented
  // For now, just require authentication

  try {
    // Fetch models from OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'HTTP-Referer': 'https://todo.mdx.do',
      },
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const { data } = await response.json() as OpenRouterResponse

    let created = 0
    let updated = 0
    const errors: string[] = []

    // Process each model
    for (const model of data) {
      try {
        const provider = model.id.split('/')[0]
        const contextLength = model.top_provider?.context_length || model.context_length || 0

        const pricing = JSON.stringify({
          prompt: parseFloat(model.pricing?.prompt || '0'),
          completion: parseFloat(model.pricing?.completion || '0'),
        })

        const capabilities = JSON.stringify({
          vision: model.architecture?.modality?.includes('image') ?? false,
          tools: true, // Most models support tools now
          streaming: true,
        })

        const now = new Date().toISOString()

        // Check if model exists
        const existing = await c.env.DB.prepare(`
          SELECT id, status, tier, bestFor, notes
          FROM models
          WHERE modelId = ?
        `).bind(model.id).first()

        if (existing) {
          // Update existing model (preserve curation fields)
          await c.env.DB.prepare(`
            UPDATE models
            SET
              name = ?,
              provider = ?,
              contextLength = ?,
              pricing = ?,
              capabilities = ?,
              lastSyncedAt = ?,
              updatedAt = ?
            WHERE modelId = ?
          `).bind(
            model.name,
            provider,
            contextLength,
            pricing,
            capabilities,
            now,
            now,
            model.id
          ).run()
          updated++
        } else {
          // Create new model with default curation
          await c.env.DB.prepare(`
            INSERT INTO models (
              modelId,
              name,
              provider,
              contextLength,
              pricing,
              capabilities,
              status,
              lastSyncedAt,
              createdAt,
              updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            model.id,
            model.name,
            provider,
            contextLength,
            pricing,
            capabilities,
            'available',
            now,
            now,
            now
          ).run()
          created++
        }
      } catch (error) {
        console.error(`Failed to sync model ${model.id}:`, error)
        errors.push(`${model.id}: ${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }

    return c.json({
      success: true,
      created,
      updated,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Failed to sync models:', error)
    return c.json({
      error: 'sync_failed',
      message: error instanceof Error ? error.message : 'Failed to sync models from OpenRouter'
    }, 500)
  }
})

export { models }
