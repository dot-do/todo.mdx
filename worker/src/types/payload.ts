/**
 * Payload CMS types and collection schemas
 */

// Generic Payload document
export interface PayloadDocument {
  id: string
  createdAt: string
  updatedAt: string
}

// User collection
export interface PayloadUser extends PayloadDocument {
  email: string
  workosUserId: string
  firstName?: string
  lastName?: string
  role?: 'admin' | 'user'
}

// Installation collection
export interface PayloadInstallation extends PayloadDocument {
  installationId: number
  accountType: 'User' | 'Organization'
  accountId: number
  accountLogin: string
  accountAvatarUrl: string
  permissions?: Record<string, string>
  events?: string[]
  repositorySelection: 'all' | 'selected'
  users?: Array<string | PayloadUser>
}

// Repo collection
export interface PayloadRepo extends PayloadDocument {
  githubId: number
  name: string
  fullName: string
  owner: string
  private: boolean
  installation: string | PayloadInstallation
}

// Issue collection
export interface PayloadIssue extends PayloadDocument {
  githubId?: number
  githubNumber?: number
  title: string
  body?: string
  status: 'open' | 'in_progress' | 'closed'
  labels?: string[]
  assignees?: string[]
  repo: string | PayloadRepo
  milestone?: string | PayloadMilestone
  priority?: number
  dependsOn?: Array<string | PayloadIssue>
  githubCreatedAt?: string
  githubUpdatedAt?: string
  githubClosedAt?: string
}

// Milestone collection
export interface PayloadMilestone extends PayloadDocument {
  githubId?: number
  githubNumber?: number
  title: string
  description?: string
  state: 'open' | 'closed'
  dueOn?: string
  repo: string | PayloadRepo
  githubCreatedAt?: string
  githubUpdatedAt?: string
}

// Linear Integration collection
export interface PayloadLinearIntegration extends PayloadDocument {
  workspaceId: string
  workspaceName: string
  accessToken: string
  user: string | PayloadUser
  repos?: Array<{
    repo: string | PayloadRepo
    linearTeamId: string
    linearTeamName: string
  }>
}

// Payload query result
export interface PayloadQueryResult<T> {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page?: number
  pagingCounter?: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage?: number | null
  nextPage?: number | null
}

// Payload find options
export interface PayloadFindOptions {
  collection: string
  where?: PayloadWhereCondition
  limit?: number
  page?: number
  depth?: number
  sort?: string
}

// Payload where condition (simplified)
export type PayloadWhereCondition = {
  [key: string]:
    | { equals?: string | number | boolean }
    | { not_equals?: string | number | boolean }
    | { in?: Array<string | number> }
    | { not_in?: Array<string | number> }
    | { contains?: string }
    | { like?: string }
    | { greater_than?: number }
    | { less_than?: number }
    | PayloadWhereCondition
} | {
  and?: PayloadWhereCondition[]
  or?: PayloadWhereCondition[]
}

// Payload RPC interface
export interface PayloadRPC {
  find<T = PayloadDocument>(args: {
    collection: string
    where?: PayloadWhereCondition
    limit?: number
    page?: number
    depth?: number
    sort?: string
  }): Promise<PayloadQueryResult<T>>

  findByID<T = PayloadDocument>(args: {
    collection: string
    id: string | number
    depth?: number
  }): Promise<T>

  create<T = PayloadDocument>(args: {
    collection: string
    data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>
  }): Promise<T>

  update<T = PayloadDocument>(args: {
    collection: string
    id: string | number
    data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>
  }): Promise<T>

  delete(args: {
    collection: string
    id: string | number
  }): Promise<{ id: string }>
}
