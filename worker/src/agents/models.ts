import type { AgentDef } from './base'
import type { Env } from '../types/env'
import { createDrizzle, models, modelDefaults } from '../db/drizzle'
import { eq, and, isNull } from 'drizzle-orm'

export interface ResolvedModel {
  provider: string
  modelId: string
  name: string
}

// Hardcoded fallback defaults (when no defaults in DB)
const HARDCODED_DEFAULTS: Record<string, string> = {
  best: 'anthropic/claude-opus-4-5-20251101',
  fast: 'anthropic/claude-haiku-4-5-20251001',
  cheap: 'openai/gpt-4.1-mini',
  overall: 'anthropic/claude-opus-4-5-20251101',
}

/**
 * Check if a model preference is a built-in use case
 */
function isBuiltInUseCase(preference: string): boolean {
  return ['best', 'fast', 'cheap', 'overall'].includes(preference)
}

/**
 * Resolve a model preference (best/fast/cheap/overall or explicit ID)
 * to an actual model from the database.
 *
 * Resolution order:
 * 1. If explicit model ID (not best/fast/cheap/overall), use directly
 * 2. Check org-level ModelDefaults
 * 3. Fall back to global ModelDefaults
 * 4. Fall back to hardcoded defaults
 */
export async function resolveModel(
  modelPreference: AgentDef['model'],
  context: { env: Env; orgId?: string; taskType?: string }
): Promise<ResolvedModel> {
  // If it's not a use case, return it directly as a model ID
  if (!isBuiltInUseCase(modelPreference)) {
    // For explicit model IDs, extract provider and ID
    // Format is typically "provider/model-id"
    const parts = modelPreference.split('/')
    if (parts.length === 2) {
      return {
        provider: parts[0],
        modelId: modelPreference,
        name: modelPreference,
      }
    }
    // Fallback for unknown format
    return {
      provider: 'unknown',
      modelId: modelPreference,
      name: modelPreference,
    }
  }

  // It's a use case, resolve from database
  const db = createDrizzle(context.env.DB)

  try {
    let resolvedModel: ResolvedModel | null = null

    // First, try to find org-specific default if orgId is provided
    if (context.orgId) {
      const orgDefault = await db
        .select({
          modelId: modelDefaults.modelId,
          model: {
            modelId: models.modelId,
            provider: models.provider,
            name: models.name,
          },
        })
        .from(modelDefaults)
        .leftJoin(models, eq(modelDefaults.modelId, models.id))
        .where(
          and(
            eq(modelDefaults.useCase, modelPreference),
            eq(modelDefaults.orgId, parseInt(context.orgId)),
            context.taskType ? eq(modelDefaults.taskType, context.taskType) : undefined
          )
        )
        .limit(1)

      if (orgDefault.length > 0 && orgDefault[0].model) {
        resolvedModel = {
          provider: orgDefault[0].model.provider || 'unknown',
          modelId: orgDefault[0].model.modelId || modelPreference,
          name: orgDefault[0].model.name || modelPreference,
        }
      }
    }

    // If no org-specific default, try global default
    if (!resolvedModel) {
      const globalDefault = await db
        .select({
          modelId: modelDefaults.modelId,
          model: {
            modelId: models.modelId,
            provider: models.provider,
            name: models.name,
          },
        })
        .from(modelDefaults)
        .leftJoin(models, eq(modelDefaults.modelId, models.id))
        .where(
          and(
            eq(modelDefaults.useCase, modelPreference),
            isNull(modelDefaults.orgId),
            context.taskType ? eq(modelDefaults.taskType, context.taskType) : undefined
          )
        )
        .limit(1)

      if (globalDefault.length > 0 && globalDefault[0].model) {
        resolvedModel = {
          provider: globalDefault[0].model.provider || 'unknown',
          modelId: globalDefault[0].model.modelId || modelPreference,
          name: globalDefault[0].model.name || modelPreference,
        }
      }
    }

    // If we found a model in the database, return it
    if (resolvedModel) {
      return resolvedModel
    }

    // Fall back to hardcoded defaults
    const hardcodedModelId = HARDCODED_DEFAULTS[modelPreference]
    const parts = hardcodedModelId.split('/')
    return {
      provider: parts[0] || 'unknown',
      modelId: hardcodedModelId,
      name: hardcodedModelId,
    }
  } catch (error) {
    console.error(`[resolveModel] Error resolving model "${modelPreference}":`, error)

    // Fallback to hardcoded defaults on error
    const hardcodedModelId = HARDCODED_DEFAULTS[modelPreference]
    const parts = hardcodedModelId.split('/')
    return {
      provider: parts[0] || 'unknown',
      modelId: hardcodedModelId,
      name: hardcodedModelId,
    }
  }
}
