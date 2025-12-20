/**
 * Core types for roadmap.mdx
 */

// Component types
export type ComponentProps = Record<string, unknown>

export type ComponentRenderer = (props: ComponentProps) => Promise<string> | string

export interface Component {
  name: string
  render: ComponentRenderer
  description?: string
}

export interface RoadmapConfig {
  /** GitHub owner/org name */
  owner?: string
  /** GitHub repo name */
  repo?: string
  /** Sync with beads epics */
  beads?: boolean
  /** File naming pattern for .roadmap files */
  filePattern?: string
  /** GitHub Project number (for cross-repo sync) */
  projectNumber?: number
}

export interface Milestone {
  id: string
  githubId?: number
  githubNumber?: number
  beadsId?: string
  title: string
  description?: string
  state: 'open' | 'closed'
  dueOn?: string
  progress: {
    open: number
    closed: number
    percent: number
  }
  createdAt: string
  updatedAt: string
}

export interface Epic {
  id: string
  beadsId?: string
  title: string
  description?: string
  status: 'open' | 'in_progress' | 'closed'
  children: string[]
  progress: {
    total: number
    completed: number
    percent: number
  }
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  githubId: string
  number: number
  title: string
  description?: string
  owner: string
  repos: string[]
  fields: ProjectField[]
  createdAt: string
  updatedAt: string
}

export interface ProjectField {
  id: string
  name: string
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'ITERATION'
  options?: string[]
}

export interface ProjectItem {
  id: string
  githubItemId: string
  contentType: 'Issue' | 'PullRequest' | 'DraftIssue'
  contentId?: number
  repoFullName?: string
  title: string
  status?: string
  priority?: string
  iteration?: string
  milestone?: string
}

export interface ParsedRoadmapFile {
  frontmatter: Record<string, unknown>
  content: string
  milestone: Partial<Milestone>
}

export type SyncSource = 'github' | 'beads' | 'file'

export interface SyncResult {
  source: SyncSource
  target: SyncSource
  action: 'created' | 'updated' | 'deleted' | 'skipped'
  milestone?: Milestone
  error?: string
}
