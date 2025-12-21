/**
 * PersistenceRPC - Centralized D1 access for Durable Objects
 *
 * Provides RPC methods for DOs to persist state and log tool executions.
 * Uses direct D1 database access via raw SQL.
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import type { Env } from '../types'

export class PersistenceRPC extends WorkerEntrypoint<Env> {
  /**
   * Persist Durable Object state to D1
   *
   * Upserts DO state by doId. Stores XState snapshots and metadata.
   */
  async persistDOState(params: {
    doId: string
    type: 'org' | 'repo' | 'project' | 'pr' | 'issue'
    ref: string
    state: any
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Access env via this.env (provided by WorkerEntrypoint)

      // Use raw SQL for upsert (D1 supports INSERT OR REPLACE)
      const now = new Date().toISOString()
      const stateJson = JSON.stringify(params.state)

      await this.env.DB.prepare(`
        INSERT INTO durable_objects (do_id, type, ref, state, last_heartbeat, updated_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(do_id) DO UPDATE SET
          type = excluded.type,
          ref = excluded.ref,
          state = excluded.state,
          last_heartbeat = excluded.last_heartbeat,
          updated_at = excluded.updated_at
      `)
        .bind(
          params.doId,
          params.type,
          params.ref,
          stateJson,
          now,
          now,
          now
        )
        .run()

      return { success: true }
    } catch (error) {
      console.error('[PersistenceRPC] persistDOState failed:', error)
      return { success: false, error: String(error) }
    }
  }

  /**
   * Log MCP tool execution for observability and debugging
   *
   * Records tool calls with timing, parameters, results, and errors.
   */
  async logToolExecution(params: {
    doId: string
    tool: string
    params: any
    result?: any
    error?: string
    durationMs: number
    userId?: string
    connectionId?: string
  }): Promise<{ success: boolean }> {
    try {
      const now = new Date().toISOString()
      const paramsJson = JSON.stringify(params.params)
      const resultJson = params.result ? JSON.stringify(params.result) : null
      const errorStr = params.error || null

      await this.env.DB.prepare(`
        INSERT INTO tool_executions (
          do_id,
          tool,
          params,
          result,
          error,
          duration_ms,
          user_id,
          connection_id,
          executed_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          params.doId,
          params.tool,
          paramsJson,
          resultJson,
          errorStr,
          params.durationMs,
          params.userId || null,
          params.connectionId || null,
          now,
          now
        )
        .run()

      return { success: true }
    } catch (error) {
      console.error('[PersistenceRPC] logToolExecution failed:', error)
      return { success: false }
    }
  }

  /**
   * Get user's active connections for integration tools
   *
   * Returns connections for specified apps (e.g., GitHub, Slack, Linear)
   */
  async getConnections(
    userId: string,
    apps?: string[]
  ): Promise<any[]> {
    try {
      let query = `
        SELECT * FROM connections
        WHERE user_id = ?
        AND status = 'active'
      `
      const params: any[] = [userId]

      if (apps?.length) {
        const placeholders = apps.map(() => '?').join(',')
        query += ` AND app IN (${placeholders})`
        params.push(...apps)
      }

      query += ` LIMIT 100`

      const result = await this.env.DB.prepare(query)
        .bind(...params)
        .all()

      return result.results || []
    } catch (error) {
      console.error('[PersistenceRPC] getConnections failed:', error)
      return []
    }
  }

  /**
   * Get DO state by doId (for recovery/debugging)
   */
  async getDOState(doId: string): Promise<any | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM durable_objects WHERE do_id = ?
      `)
        .bind(doId)
        .first()

      if (!result) return null

      // Parse state JSON
      return {
        ...result,
        state: result.state ? JSON.parse(result.state as string) : null,
      }
    } catch (error) {
      console.error('[PersistenceRPC] getDOState failed:', error)
      return null
    }
  }

  /**
   * List recent tool executions for a DO (debugging)
   */
  async getToolExecutions(doId: string, limit = 50): Promise<any[]> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM tool_executions
        WHERE do_id = ?
        ORDER BY executed_at DESC
        LIMIT ?
      `)
        .bind(doId, limit)
        .all()

      return (result.results || []).map((row: any) => ({
        ...row,
        params: row.params ? JSON.parse(row.params) : null,
        result: row.result ? JSON.parse(row.result) : null,
      }))
    } catch (error) {
      console.error('[PersistenceRPC] getToolExecutions failed:', error)
      return []
    }
  }
}
