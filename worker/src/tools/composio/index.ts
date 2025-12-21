/**
 * Composio SDK integration for tool normalization
 *
 * This module provides:
 * - Client initialization (getComposio)
 * - Tool fetching and normalization (getComposioTools)
 * - Tool name parsing (SCREAMING_SNAKE_CASE → camelCase)
 * - Tool execution (executeComposioTool)
 */

export { getComposio, getComposioTools, getComposioToolsForConnection } from './client'
export { normalizeComposioTool, parseComposioToolName } from './normalize'
export { executeComposioTool } from './execute'
export type { ComposioTool } from './normalize'
