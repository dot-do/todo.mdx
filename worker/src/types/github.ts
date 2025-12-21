/**
 * GitHub webhook payload types
 * Based on @octokit/webhooks-types with additional custom types
 */

import type {
  InstallationEvent,
  IssuesEvent,
  MilestoneEvent,
  PushEvent,
  PullRequestEvent,
  PullRequestReviewEvent,
} from '@octokit/webhooks-types'

// Re-export official types
export type {
  InstallationEvent,
  IssuesEvent,
  MilestoneEvent,
  PushEvent,
  PullRequestEvent,
  PullRequestReviewEvent,
}

// GitHub Projects v2 types (not in @octokit/webhooks-types yet)
export interface ProjectsV2Event {
  action: 'created' | 'edited' | 'closed' | 'reopened' | 'deleted'
  projects_v2: {
    id: number
    node_id: string
    number: number
    title: string
    short_description: string | null
    public: boolean
    closed: boolean
    created_at: string
    updated_at: string
    creator: {
      login: string
      id: number
      node_id: string
      avatar_url: string
      type: string
    }
  }
  organization?: {
    login: string
    id: number
    node_id: string
    avatar_url: string
    type: string
  }
  sender: {
    login: string
    id: number
    node_id: string
    avatar_url: string
    type: string
  }
  installation?: {
    id: number
    node_id: string
  }
}

export interface ProjectsV2ItemEvent {
  action: 'created' | 'edited' | 'deleted' | 'archived' | 'converted' | 'reordered' | 'restored'
  projects_v2_item: {
    id: number
    node_id: string
    project_node_id: string
    content_node_id: string
    content_type: 'Issue' | 'PullRequest' | 'DraftIssue'
    creator: {
      login: string
      id: number
      node_id: string
    }
    created_at: string
    updated_at: string
    archived_at: string | null
    is_archived: boolean
  }
  changes?: {
    field_value?: {
      field_node_id: string
      field_type: string
      field_name: string
      project_number: number
      from: string | number | null
      to: string | number | null
    }
  }
  organization?: {
    login: string
    id: number
    node_id: string
  }
  sender: {
    login: string
    id: number
    node_id: string
  }
  installation?: {
    id: number
    node_id: string
  }
}

// Union type for all webhook payloads
export type GitHubWebhookPayload =
  | InstallationEvent
  | IssuesEvent
  | MilestoneEvent
  | PushEvent
  | ProjectsV2Event
  | ProjectsV2ItemEvent
  | PullRequestEvent
  | PullRequestReviewEvent

// Helper type to extract payload by event name
export type WebhookPayloadByEvent<T extends string> = T extends 'installation'
  ? InstallationEvent
  : T extends 'issues'
  ? IssuesEvent
  : T extends 'milestone'
  ? MilestoneEvent
  : T extends 'push'
  ? PushEvent
  : T extends 'projects_v2'
  ? ProjectsV2Event
  : T extends 'projects_v2_item'
  ? ProjectsV2ItemEvent
  : T extends 'pull_request'
  ? PullRequestEvent
  : T extends 'pull_request_review'
  ? PullRequestReviewEvent
  : never
