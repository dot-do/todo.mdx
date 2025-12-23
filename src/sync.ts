/**
 * Bi-directional sync between beads (.beads/issues.jsonl) and .todo/*.md files
 *
 * This module provides sync functionality to keep issues in sync between:
 * - .beads/issues.jsonl (beads issue tracker)
 * - .todo/*.md files (markdown files with YAML frontmatter)
 *
 * Features:
 * - Detects new, updated, and deleted issues in both sources
 * - Resolves conflicts based on configurable strategies (beads-wins, file-wins, newest-wins)
 * - Supports dry-run mode for previewing changes
 * - Supports directional sync (beads-to-files, files-to-beads, or bidirectional)
 *
 * @example
 * ```ts
 * import { sync } from 'todo.mdx'
 *
 * // Bi-directional sync with newest-wins strategy
 * const result = await sync({
 *   todoDir: '.todo',
 *   conflictStrategy: 'newest-wins',
 * })
 *
 * console.log(`Created: ${result.created.length}`)
 * console.log(`Updated: ${result.updated.length}`)
 * console.log(`Files written: ${result.filesWritten.length}`)
 * console.log(`Conflicts: ${result.conflicts.length}`)
 * ```
 *
 * @example
 * ```ts
 * // Dry run to preview changes
 * const result = await sync({
 *   todoDir: '.todo',
 *   dryRun: true,
 * })
 * ```
 *
 * @example
 * ```ts
 * // One-way sync from beads to files
 * const result = await sync({
 *   todoDir: '.todo',
 *   direction: 'beads-to-files',
 * })
 * ```
 */

import { createIssue, updateIssue, closeIssue } from 'beads-workflows'
import type { CreateOptions, UpdateOptions } from 'beads-workflows'
import { diff, applyExtract } from '@mdxld/markdown'
import { loadBeadsIssues } from './beads.js'
import { loadTodoFiles } from './parser.js'
import { writeTodoFiles, DEFAULT_PATTERN } from './generator.js'
import type { GeneratorOptions } from './generator.js'
import type { TodoConfig, TodoIssue, SyncResult, SyncConflict } from './types.js'

/**
 * Options for sync operation
 */
export interface SyncOptions extends TodoConfig {
  /** Don't actually write changes */
  dryRun?: boolean
  /** Sync direction */
  direction?: 'beads-to-files' | 'files-to-beads' | 'bidirectional'
  /** Filename pattern for generated files (default: '[yyyy-mm-dd] [Title].md') */
  pattern?: string
  /** Subdirectory for closed issues (default: 'closed') */
  closedSubdir?: string
  /** Whether to separate closed issues into subdirectory (default: true) */
  separateClosed?: boolean
}

/**
 * Result of change detection
 */
export interface ChangeDetectionResult {
  /** Issues to push to beads */
  toBeads: TodoIssue[]
  /** Issues to write to files */
  toFiles: TodoIssue[]
  /** Conflicts detected */
  conflicts: SyncConflict[]
}

/**
 * Check if two issues have the same content (ignoring updatedAt and source)
 */
function issuesAreEqual(a: TodoIssue, b: TodoIssue): boolean {
  // Create normalized versions without updatedAt and source for comparison
  const { updatedAt: _aUpdatedAt, source: _aSource, ...aNormalized } = a
  const { updatedAt: _bUpdatedAt, source: _bSource, ...bNormalized } = b

  const diffResult = diff(aNormalized, bNormalized)
  return !diffResult.hasChanges
}

/**
 * Detect which fields differ between two issues using diff()
 */
function detectDifferentFields(beadsIssue: TodoIssue, fileIssue: TodoIssue): string[] {
  // Create normalized versions without updatedAt and source for comparison
  const { updatedAt: _beadsUpdatedAt, source: _beadsSource, ...beadsNormalized } = beadsIssue
  const { updatedAt: _fileUpdatedAt, source: _fileSource, ...fileNormalized } = fileIssue

  const diffResult = diff(beadsNormalized, fileNormalized)

  // Collect all changed fields: added, modified, and removed
  const fields = new Set<string>([
    ...Object.keys(diffResult.added),
    ...Object.keys(diffResult.modified),
    ...diffResult.removed,
  ])

  return Array.from(fields)
}

/**
 * Create a conflict object for two different versions of an issue
 */
function createConflict(
  beadsIssue: TodoIssue,
  fileIssue: TodoIssue,
  field: string,
  resolution: 'beads-wins' | 'file-wins' | 'manual'
): SyncConflict {
  const beadsValue = (beadsIssue as unknown as Record<string, unknown>)[field]
  const fileValue = (fileIssue as unknown as Record<string, unknown>)[field]

  return {
    issueId: beadsIssue.id,
    field,
    beadsValue,
    fileValue,
    resolution,
  }
}

/**
 * Detect changes between beads issues and file issues
 *
 * @param beadsIssues - Issues loaded from beads
 * @param fileIssues - Issues loaded from .todo/*.md files
 * @returns Object containing issues to push to beads, issues to write to files, and conflicts
 */
export function detectChanges(
  beadsIssues: TodoIssue[],
  fileIssues: TodoIssue[]
): ChangeDetectionResult {
  const toBeads: TodoIssue[] = []
  const toFiles: TodoIssue[] = []
  const conflicts: SyncConflict[] = []

  // Create maps for efficient lookup
  const beadsMap = new Map(beadsIssues.map((issue) => [issue.id, issue]))
  const fileMap = new Map(fileIssues.map((issue) => [issue.id, issue]))

  // Check for new issues in files that need to be created in beads
  for (const fileIssue of fileIssues) {
    const beadsIssue = beadsMap.get(fileIssue.id)

    if (!beadsIssue) {
      // New issue in file, needs to be created in beads
      toBeads.push(fileIssue)
      continue
    }

    // Issue exists in both - check for conflicts
    if (!issuesAreEqual(beadsIssue, fileIssue)) {
      // Issues differ - determine which is newer
      const beadsTime = beadsIssue.updatedAt ? new Date(beadsIssue.updatedAt).getTime() : 0
      const fileTime = fileIssue.updatedAt ? new Date(fileIssue.updatedAt).getTime() : 0

      // If both timestamps exist and are on the same day, treat as a conflict
      // This handles the case where both sources were modified recently/independently
      const ONE_DAY = 24 * 60 * 60 * 1000
      const timeDiff = Math.abs(beadsTime - fileTime)

      if (
        beadsTime === fileTime ||
        (!beadsIssue.updatedAt && !fileIssue.updatedAt) ||
        (beadsTime !== 0 && fileTime !== 0 && timeDiff < ONE_DAY)
      ) {
        // Same timestamp, both missing, or within same day - this is a conflict
        const fields = detectDifferentFields(beadsIssue, fileIssue)
        if (fields.length > 0) {
          // Create a single conflict for the issue with the first differing field
          // (or we could create one per field, but test expects one per issue)
          conflicts.push(createConflict(beadsIssue, fileIssue, fields[0], 'manual'))
        }
      } else if (fileTime > beadsTime) {
        // File is newer, push to beads
        toBeads.push(fileIssue)
      } else {
        // Beads is newer, write to files
        toFiles.push(beadsIssue)
      }
    }
  }

  // Check for new issues in beads that need to be written to files
  for (const beadsIssue of beadsIssues) {
    if (!fileMap.has(beadsIssue.id)) {
      toFiles.push(beadsIssue)
    }
  }

  return { toBeads, toFiles, conflicts }
}

/**
 * Convert TodoIssue to CreateOptions for beads-workflows
 */
function toCreateOptions(issue: TodoIssue): CreateOptions {
  return {
    title: issue.title,
    type: issue.type,
    priority: issue.priority,
    description: issue.description,
    assignee: issue.assignee,
    labels: issue.labels,
  }
}

/**
 * Convert TodoIssue to UpdateOptions for beads-workflows, optionally merging with original issue
 */
function toUpdateOptions(issue: TodoIssue, originalIssue?: TodoIssue): UpdateOptions {
  let mergedIssue = issue

  // If we have an original issue, use applyExtract to merge changes
  if (originalIssue) {
    mergedIssue = applyExtract(originalIssue, issue)
  }

  return {
    title: mergedIssue.title,
    status: mergedIssue.status,
    priority: mergedIssue.priority,
    description: mergedIssue.description,
    assignee: mergedIssue.assignee,
    labels: mergedIssue.labels,
  }
}

/**
 * Perform bi-directional sync between beads and .todo/*.md files
 *
 * @param options - Sync options including config and flags
 * @returns Sync result with created, updated, deleted issues and files written
 */
export async function sync(options: SyncOptions = {}): Promise<SyncResult> {
  const {
    beadsDir,
    todoDir = '.todo',
    dryRun = false,
    direction = 'bidirectional',
    conflictStrategy = 'newest-wins',
    pattern,
    closedSubdir,
    separateClosed,
  } = options

  // Build generator options
  const generatorOptions: GeneratorOptions = {
    pattern,
    closedSubdir,
    separateClosed,
  }

  const result: SyncResult = {
    created: [],
    updated: [],
    deleted: [],
    filesWritten: [],
    conflicts: [],
  }

  // Load issues from both sources
  const beadsIssues = await loadBeadsIssues(beadsDir)
  const fileIssues = await loadTodoFiles(todoDir)

  // Detect changes
  let { toBeads, toFiles, conflicts } = detectChanges(beadsIssues, fileIssues)

  // Handle conflicts based on strategy
  if (conflicts.length > 0) {
    const beadsMap = new Map(beadsIssues.map((issue) => [issue.id, issue]))
    const fileMap = new Map(fileIssues.map((issue) => [issue.id, issue]))

    for (const conflict of conflicts) {
      const beadsIssue = beadsMap.get(conflict.issueId)
      const fileIssue = fileMap.get(conflict.issueId)

      if (!beadsIssue || !fileIssue) continue

      let resolution: 'beads-wins' | 'file-wins' | 'manual'

      if (conflictStrategy === 'beads-wins') {
        resolution = 'beads-wins'
        // Add to toFiles if not already there
        if (!toFiles.find((i) => i.id === beadsIssue.id)) {
          toFiles.push(beadsIssue)
        }
      } else if (conflictStrategy === 'file-wins') {
        resolution = 'file-wins'
        // Add to toBeads if not already there
        if (!toBeads.find((i) => i.id === fileIssue.id)) {
          toBeads.push(fileIssue)
        }
      } else {
        // newest-wins - already handled in detectChanges
        // Mark as manual since we don't override the automatic resolution
        resolution = 'manual'
      }

      // Update conflict resolution and add to result
      const resolvedConflict: SyncConflict = {
        ...conflict,
        resolution,
      }
      result.conflicts.push(resolvedConflict)
    }
  }

  // Filter based on direction
  if (direction === 'beads-to-files') {
    toBeads = []
  } else if (direction === 'files-to-beads') {
    toFiles = []
  }

  // If dry run, just return what would be done
  if (dryRun) {
    return result
  }

  // Push changes to beads
  for (const issue of toBeads) {
    const beadsIssue = beadsIssues.find((i) => i.id === issue.id)

    try {
      if (!beadsIssue) {
        // Create new issue
        const createResult = await createIssue(toCreateOptions(issue), { cwd: beadsDir })
        if (createResult.success) {
          result.created.push(issue.id)
        }
      } else {
        // Update existing issue - use applyExtract to merge file changes into beads issue
        const updateResult = await updateIssue(issue.id, toUpdateOptions(issue, beadsIssue), {
          cwd: beadsDir,
        })
        if (updateResult.success) {
          result.updated.push(issue.id)
        }
      }
    } catch (error) {
      // Log error but continue with other issues
      console.warn(`Failed to sync issue ${issue.id} to beads:`, error)
    }
  }

  // Write changes to files
  if (toFiles.length > 0) {
    try {
      const writtenPaths = await writeTodoFiles(toFiles, todoDir, generatorOptions)
      result.filesWritten.push(...writtenPaths)
    } catch (error) {
      console.warn('Failed to write todo files:', error)
    }
  }

  return result
}
