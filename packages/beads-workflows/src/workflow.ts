/**
 * Workflow API - provides on.issue.ready() style handlers
 */

import type {
  BeadsIssue,
  IssueReadyEvent,
  IssueBlockedEvent,
  IssueClosedEvent,
  IssueCreatedEvent,
  IssueUpdatedEvent,
  IssueReopenedEvent,
  EpicCompletedEvent,
  EpicProgressEvent,
  Unsubscribe,
} from './types.js'
import { WorkflowEventEmitter } from './events.js'

/** Handler for issue events */
export type IssueHandler<T> = (event: T) => void | Promise<void>

/** Handler that receives just the issue */
export type SimpleIssueHandler = (issue: BeadsIssue) => void | Promise<void>

/**
 * Issue event handlers namespace
 */
export interface IssueHandlers {
  /** Triggered when an issue becomes ready (open with no blockers) */
  ready(handler: SimpleIssueHandler): Unsubscribe

  /** Triggered when an issue becomes blocked */
  blocked(handler: IssueHandler<IssueBlockedEvent>): Unsubscribe

  /** Triggered when an issue is closed */
  closed(handler: SimpleIssueHandler): Unsubscribe

  /** Triggered when an issue is created */
  created(handler: SimpleIssueHandler): Unsubscribe

  /** Triggered when an issue is updated */
  updated(handler: IssueHandler<IssueUpdatedEvent>): Unsubscribe

  /** Triggered when an issue is reopened */
  reopened(handler: SimpleIssueHandler): Unsubscribe
}

/**
 * Epic event handlers namespace
 */
export interface EpicHandlers {
  /** Triggered when an epic is completed (all children closed) */
  completed(handler: SimpleIssueHandler): Unsubscribe

  /** Triggered when epic progress changes */
  progress(handler: IssueHandler<EpicProgressEvent>): Unsubscribe
}

/**
 * Workflow trigger namespace
 */
export interface WorkflowTriggers {
  issue: IssueHandlers
  epic: EpicHandlers
}

/**
 * Create the `on` namespace for workflow triggers
 */
export function createWorkflowTriggers(emitter: WorkflowEventEmitter): WorkflowTriggers {
  return {
    issue: {
      ready(handler: SimpleIssueHandler): Unsubscribe {
        return emitter.on('issue.ready', (event: IssueReadyEvent) => handler(event.issue))
      },

      blocked(handler: IssueHandler<IssueBlockedEvent>): Unsubscribe {
        return emitter.on('issue.blocked', handler)
      },

      closed(handler: SimpleIssueHandler): Unsubscribe {
        return emitter.on('issue.closed', (event: IssueClosedEvent) => handler(event.issue))
      },

      created(handler: SimpleIssueHandler): Unsubscribe {
        return emitter.on('issue.created', (event: IssueCreatedEvent) => handler(event.issue))
      },

      updated(handler: IssueHandler<IssueUpdatedEvent>): Unsubscribe {
        return emitter.on('issue.updated', handler)
      },

      reopened(handler: SimpleIssueHandler): Unsubscribe {
        return emitter.on('issue.reopened', (event: IssueReopenedEvent) => handler(event.issue))
      },
    },

    epic: {
      completed(handler: SimpleIssueHandler): Unsubscribe {
        return emitter.on('epic.completed', (event: EpicCompletedEvent) => handler(event.issue))
      },

      progress(handler: IssueHandler<EpicProgressEvent>): Unsubscribe {
        return emitter.on('epic.progress', handler)
      },
    },
  }
}

/**
 * Scheduled trigger namespace
 */
export interface ScheduledTriggers {
  /** Run at a specific time each day */
  day(time: string, handler: () => void | Promise<void>): Unsubscribe

  /** Run at a specific time each hour */
  hour(minute: number, handler: () => void | Promise<void>): Unsubscribe

  /** Run on a cron schedule */
  cron(schedule: string, handler: () => void | Promise<void>): Unsubscribe
}

/**
 * Create the `every` namespace for scheduled triggers
 * Note: Actual scheduling is handled by the runtime (local daemon or Cloudflare)
 */
export function createScheduledTriggers(): ScheduledTriggers {
  const schedules = new Map<string, () => void | Promise<void>>()

  return {
    day(time: string, handler: () => void | Promise<void>): Unsubscribe {
      const key = `day:${time}`
      schedules.set(key, handler)
      return () => schedules.delete(key)
    },

    hour(minute: number, handler: () => void | Promise<void>): Unsubscribe {
      const key = `hour:${minute}`
      schedules.set(key, handler)
      return () => schedules.delete(key)
    },

    cron(schedule: string, handler: () => void | Promise<void>): Unsubscribe {
      const key = `cron:${schedule}`
      schedules.set(key, handler)
      return () => schedules.delete(key)
    },
  }
}
