/**
 * Round-trip MDX components for Issue entities
 * Uses @mdxld/extract for bi-directional rendering and extraction
 */

import {
  roundTripComponent,
  renderMarkdownTable,
  parseMarkdownTable,
  renderMarkdownList,
  type ComponentExtractor,
} from '@mdxld/extract'
import type { TodoIssue } from '../types.js'

/**
 * Convert TodoIssue to EntityItem format for rendering
 */
function issueToEntity(issue: TodoIssue): Record<string, unknown> {
  return {
    $id: issue.id,
    $type: 'Issue',
    id: issue.id,
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    type: issue.type,
    assignee: issue.assignee || '',
    labels: issue.labels?.join(', ') || '',
    createdAt: issue.createdAt || '',
    updatedAt: issue.updatedAt || '',
    closedAt: issue.closedAt || '',
    dependsOn: issue.dependsOn?.join(', ') || '',
    blocks: issue.blocks?.join(', ') || '',
    parent: issue.parent || '',
    children: issue.children?.join(', ') || '',
  }
}

/**
 * Convert EntityItem back to partial TodoIssue
 */
function entityToIssue(entity: Record<string, unknown>): Partial<TodoIssue> {
  const issue: Partial<TodoIssue> = {
    id: String(entity.id || entity.$id),
    title: String(entity.title || ''),
    status: (entity.status || 'open') as TodoIssue['status'],
    priority: Number(entity.priority || 2) as TodoIssue['priority'],
    type: (entity.type || 'task') as TodoIssue['type'],
  }

  if (entity.assignee && String(entity.assignee).trim()) {
    issue.assignee = String(entity.assignee)
  }

  if (entity.labels && String(entity.labels).trim()) {
    issue.labels = String(entity.labels)
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)
  }

  if (entity.createdAt && String(entity.createdAt).trim()) {
    issue.createdAt = String(entity.createdAt)
  }

  if (entity.updatedAt && String(entity.updatedAt).trim()) {
    issue.updatedAt = String(entity.updatedAt)
  }

  if (entity.closedAt && String(entity.closedAt).trim()) {
    issue.closedAt = String(entity.closedAt)
  }

  if (entity.dependsOn && String(entity.dependsOn).trim()) {
    issue.dependsOn = String(entity.dependsOn)
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
  }

  if (entity.blocks && String(entity.blocks).trim()) {
    issue.blocks = String(entity.blocks)
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean)
  }

  if (entity.parent && String(entity.parent).trim()) {
    issue.parent = String(entity.parent)
  }

  if (entity.children && String(entity.children).trim()) {
    issue.children = String(entity.children)
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
  }

  return issue
}

/**
 * Props for Issues component
 */
export interface IssuesProps extends Record<string, unknown> {
  /** Issues to display */
  issues?: TodoIssue[]
  /** Filter by status */
  status?: 'open' | 'in_progress' | 'blocked' | 'closed'
  /** Columns to display */
  columns?: string[]
  /** Max number of issues to show */
  limit?: number
  /** Render format */
  format?: 'table' | 'list'
}

/**
 * Props for filtered Issues components (without status prop)
 */
interface FilteredIssuesProps extends Record<string, unknown> {
  /** Issues to display */
  issues?: TodoIssue[]
  /** Columns to display */
  columns?: string[]
  /** Max number of issues to show */
  limit?: number
  /** Render format */
  format?: 'table' | 'list'
}

/**
 * Type for Issues component with sub-components
 */
type IssuesComponent = ReturnType<typeof roundTripComponent<IssuesProps>> & {
  Blocked: ReturnType<typeof roundTripComponent<FilteredIssuesProps>>
  Ready: ReturnType<typeof roundTripComponent<FilteredIssuesProps>>
  Open: ReturnType<typeof roundTripComponent<FilteredIssuesProps>>
  Closed: ReturnType<typeof roundTripComponent<FilteredIssuesProps>>
}

/**
 * Generic Issues component - Render and extract issue tables/lists
 *
 * @example
 * ```tsx
 * <Issues issues={allIssues} columns={['id', 'title', 'status']} />
 * <Issues issues={allIssues} status="open" />
 * <Issues issues={allIssues} limit={10} format="list" />
 * ```
 */
const IssuesBase = roundTripComponent<IssuesProps>({
  render: (props) => {
    let issues = props.issues || []

    // Apply status filter
    if (props.status) {
      issues = issues.filter((i) => i.status === props.status)
    }

    // Apply limit
    if (props.limit && props.limit > 0) {
      issues = issues.slice(0, props.limit)
    }

    // Convert to entity format
    const entities = issues.map(issueToEntity) as Array<
      Record<string, unknown> & { $id: string }
    >

    // Determine columns
    const columns =
      props.columns || ['id', 'title', 'status', 'priority', 'type']

    // Render based on format
    if (props.format === 'list') {
      return renderMarkdownList(entities, { linkPattern: './{$id}.md' })
    }

    return renderMarkdownTable(entities, columns)
  },

  extract: (content) => {
    // Try to parse as table first
    try {
      const { headers, rows } = parseMarkdownTable(content)

      // Check if it's actually a table (has rows)
      if (rows.length > 0) {
        const issues = rows.map((row) => entityToIssue(row))

        return {
          issues: issues as TodoIssue[],
          columns: headers,
        }
      }
    } catch {
      // Fall through to list parsing
    }

    // If table parsing fails or has no rows, try to extract as list
    const lines = content.split('\n').filter((l) => l.trim().startsWith('-'))

    const issues = lines.map((line) => {
      // Extract from markdown link: - [Title](./ID.md)
      const linkMatch = line.match(/\[([^\]]+)\]\(\.\/([^)]+)\.md\)/)
      if (linkMatch) {
        const title = linkMatch[1]
        const id = linkMatch[2]
        return {
          id,
          title,
          status: 'open' as const,
          priority: 2 as const,
          type: 'task' as const,
        }
      }

      // Extract from plain text: - ID: Title or - Title
      const plainMatch = line.match(/^-\s*(.*)$/)
      if (plainMatch) {
        const text = plainMatch[1].trim()
        const colonSplit = text.split(':')
        if (colonSplit.length >= 2) {
          return {
            id: colonSplit[0].trim(),
            title: colonSplit.slice(1).join(':').trim(),
            status: 'open' as const,
            priority: 2 as const,
            type: 'task' as const,
          }
        }
        // Just use the text as both id and title
        return {
          id: text,
          title: text,
          status: 'open' as const,
          priority: 2 as const,
          type: 'task' as const,
        }
      }

      // Fallback
      return {
        id: '',
        title: '',
        status: 'open' as const,
        priority: 2 as const,
        type: 'task' as const,
      }
    })

    return {
      issues: issues.filter((i) => i.id) as TodoIssue[],
      columns: ['id', 'title'],
    }
  },
})

/**
 * Blocked issues component
 */
const IssuesBlocked = roundTripComponent<FilteredIssuesProps>({
  render: (props) => {
    const blockedIssues = (props.issues || []).filter(
      (i) => i.status === 'blocked'
    )
    return IssuesBase.render({ ...props, issues: blockedIssues })
  },
  extract: (content) => IssuesBase.extract(content),
})

/**
 * Ready (unblocked) issues component
 */
const IssuesReady = roundTripComponent<FilteredIssuesProps>({
  render: (props) => {
    // Ready = open issues with no dependencies blocking them
    const readyIssues = (props.issues || []).filter((i) => {
      if (i.status !== 'open') return false
      // If no dependsOn, it's ready
      if (!i.dependsOn || i.dependsOn.length === 0) return true
      // Check if any dependencies are not closed (assuming we'd need to check this)
      // For now, we'll consider issues with dependsOn as potentially blocked
      return false
    })
    return IssuesBase.render({ ...props, issues: readyIssues })
  },
  extract: (content) => IssuesBase.extract(content),
})

/**
 * Open issues component
 */
const IssuesOpen = roundTripComponent<FilteredIssuesProps>({
  render: (props) => {
    return IssuesBase.render({ ...props, status: 'open' })
  },
  extract: (content) => IssuesBase.extract(content),
})

/**
 * Closed issues component
 */
const IssuesClosed = roundTripComponent<FilteredIssuesProps>({
  render: (props) => {
    return IssuesBase.render({ ...props, status: 'closed' })
  },
  extract: (content) => IssuesBase.extract(content),
})

/**
 * Issues component with sub-components
 *
 * @example
 * ```tsx
 * <Issues issues={allIssues} columns={['id', 'title', 'status']} />
 * <Issues.Blocked issues={allIssues} />
 * <Issues.Ready issues={allIssues} />
 * <Issues.Open issues={allIssues} />
 * <Issues.Closed issues={allIssues} />
 * ```
 */
export const Issues = Object.assign(IssuesBase, {
  Blocked: IssuesBlocked,
  Ready: IssuesReady,
  Open: IssuesOpen,
  Closed: IssuesClosed,
}) as IssuesComponent

/**
 * Props for Issue.Labels component
 */
export interface IssueLabelsProps extends Record<string, unknown> {
  /** Labels array */
  labels?: string[]
  /** Render as badges or comma-separated */
  format?: 'badges' | 'comma'
}

/**
 * Issue.Labels - Render labels as badges or comma-separated
 *
 * @example
 * ```tsx
 * <Issue.Labels labels={['bug', 'urgent']} />
 * <Issue.Labels labels={['feature']} format="badges" />
 * ```
 */
export const IssueLabels = roundTripComponent<IssueLabelsProps>({
  render: (props) => {
    const labels = props.labels || []

    if (labels.length === 0) return ''

    if (props.format === 'badges') {
      // Render as inline code badges
      return labels.map((label) => `\`${label}\``).join(' ')
    }

    // Default: comma-separated
    return labels.join(', ')
  },

  extract: (content) => {
    if (!content.trim()) {
      return { labels: [] }
    }

    // Check if badges format (contains backticks)
    if (content.includes('`')) {
      const labels = content.match(/`([^`]+)`/g)?.map((l) => l.slice(1, -1)) || []
      return { labels, format: 'badges' as const }
    }

    // Comma-separated format
    const labels = content
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)

    return { labels, format: 'comma' as const }
  },
})

/**
 * Type for Issue component with sub-components
 */
type IssueComponent = {
  Labels: typeof IssueLabels
  Dependencies: typeof IssueDependencies
}

/**
 * Props for Issue.Dependencies component
 */
export interface IssueDependenciesProps extends Record<string, unknown> {
  /** Dependency issue IDs */
  dependencies?: string[]
  /** Render as links or plain list */
  format?: 'links' | 'list'
}

/**
 * Issue.Dependencies - Render dependency links
 *
 * @example
 * ```tsx
 * <Issue.Dependencies dependencies={['todo-123', 'todo-456']} />
 * <Issue.Dependencies dependencies={['todo-123']} format="links" />
 * ```
 */
export const IssueDependencies = roundTripComponent<IssueDependenciesProps>({
  render: (props) => {
    const deps = props.dependencies || []

    if (deps.length === 0) return ''

    if (props.format === 'links') {
      // Render as markdown links
      return deps.map((id) => `- [${id}](./${id}.md)`).join('\n')
    }

    // Default: plain list
    return deps.map((id) => `- ${id}`).join('\n')
  },

  extract: (content) => {
    if (!content.trim()) {
      return { dependencies: [] }
    }

    const lines = content.split('\n').filter((l) => l.trim().startsWith('-'))

    // Check if links format
    const hasLinks = lines.some((l) => l.includes('['))

    const dependencies = lines.map((line) => {
      // Try to extract from link: [id](...)
      const linkMatch = line.match(/\[([^\]]+)\]/)
      if (linkMatch) return linkMatch[1]

      // Otherwise extract from plain text: - id
      return line.replace(/^-\s*/, '').trim()
    })

    return {
      dependencies: dependencies.filter(Boolean),
      format: hasLinks ? ('links' as const) : ('list' as const),
    }
  },
})

/**
 * Issue namespace with sub-components
 *
 * @example
 * ```tsx
 * <Issue.Labels labels={['bug', 'urgent']} />
 * <Issue.Dependencies dependencies={['todo-123']} format="links" />
 * ```
 */
export const Issue: IssueComponent = {
  Labels: IssueLabels,
  Dependencies: IssueDependencies,
}

/**
 * Create component extractors for use with @mdxld/extract's extract()
 */
export function createIssueExtractors(): Record<string, ComponentExtractor<unknown>> {
  return {
    Issues: Issues.extractor as ComponentExtractor<unknown>,
    'Issues.Blocked': Issues.Blocked.extractor as ComponentExtractor<unknown>,
    'Issues.Ready': Issues.Ready.extractor as ComponentExtractor<unknown>,
    'Issues.Open': Issues.Open.extractor as ComponentExtractor<unknown>,
    'Issues.Closed': Issues.Closed.extractor as ComponentExtractor<unknown>,
    'Issue.Labels': IssueLabels.extractor as ComponentExtractor<unknown>,
    'Issue.Dependencies': IssueDependencies.extractor as ComponentExtractor<unknown>,
  }
}
