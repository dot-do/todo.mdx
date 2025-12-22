import { describe, it, expect, vi } from 'vitest'
import { Trigger } from './Trigger'
import type { TriggerConfig } from '../types'

describe('Trigger component', () => {
  it('creates trigger config with event only', () => {
    const config = Trigger({ event: 'issue.ready' })

    expect(config.event).toBe('issue.ready')
    expect(config.condition).toBeUndefined()
    expect(config.cron).toBeUndefined()
  })

  it('accepts condition filter', () => {
    const config = Trigger({
      event: 'issue.ready',
      condition: 'priority >= 3',
    })

    expect(config.event).toBe('issue.ready')
    expect(config.condition).toBe('priority >= 3')
  })

  it('accepts cron expression for schedule triggers', () => {
    const config = Trigger({
      event: 'schedule',
      cron: '0 9 * * *',
    })

    expect(config.event).toBe('schedule')
    expect(config.cron).toBe('0 9 * * *')
  })

  it('accepts handler function', () => {
    const handler = vi.fn()
    const config = Trigger({
      event: 'issue.closed',
      handler,
    })

    expect(config.event).toBe('issue.closed')
    expect(config.handler).toBe(handler)
  })

  it('accepts handler reference string', () => {
    const config = Trigger({
      event: 'issue.ready',
      handler: 'handleIssueReady',
    })

    expect(config.handler).toBe('handleIssueReady')
  })

  it('supports issue events', () => {
    const events = [
      Trigger({ event: 'issue.ready' }),
      Trigger({ event: 'issue.closed' }),
      Trigger({ event: 'issue.created' }),
      Trigger({ event: 'issue.updated' }),
    ]

    expect(events.map(e => e.event)).toEqual([
      'issue.ready',
      'issue.closed',
      'issue.created',
      'issue.updated',
    ])
  })

  it('supports epic events', () => {
    const config = Trigger({ event: 'epic.completed' })

    expect(config.event).toBe('epic.completed')
  })

  it('supports PR events', () => {
    const events = [
      Trigger({ event: 'pr.opened' }),
      Trigger({ event: 'pr.merged' }),
      Trigger({ event: 'pr.approved' }),
    ]

    expect(events.map(e => e.event)).toEqual([
      'pr.opened',
      'pr.merged',
      'pr.approved',
    ])
  })

  it('creates complete trigger config', () => {
    const handler = vi.fn()
    const config = Trigger({
      event: 'issue.ready',
      condition: 'priority >= 2 && type === "feature"',
      handler,
    })

    expect(config).toEqual({
      event: 'issue.ready',
      condition: 'priority >= 2 && type === "feature"',
      handler,
    })
  })

  it('creates schedule trigger with cron and handler', () => {
    const handler = vi.fn()
    const config = Trigger({
      event: 'schedule',
      cron: '0 0 * * *',
      handler,
    })

    expect(config.event).toBe('schedule')
    expect(config.cron).toBe('0 0 * * *')
    expect(config.handler).toBe(handler)
  })

  it('supports complex conditions', () => {
    const conditions = [
      Trigger({ event: 'issue.ready', condition: 'priority >= 3' }),
      Trigger({ event: 'issue.ready', condition: 'labels.includes("urgent")' }),
      Trigger({ event: 'issue.ready', condition: 'assignee === "claude"' }),
      Trigger({ event: 'issue.ready', condition: 'type === "bug" && priority > 2' }),
    ]

    expect(conditions[0].condition).toBe('priority >= 3')
    expect(conditions[1].condition).toBe('labels.includes("urgent")')
    expect(conditions[2].condition).toBe('assignee === "claude"')
    expect(conditions[3].condition).toBe('type === "bug" && priority > 2')
  })

  it('supports various cron expressions', () => {
    const schedules = [
      Trigger({ event: 'schedule', cron: '0 9 * * *' }), // Daily at 9am
      Trigger({ event: 'schedule', cron: '0 * * * *' }), // Every hour
      Trigger({ event: 'schedule', cron: '*/15 * * * *' }), // Every 15 minutes
      Trigger({ event: 'schedule', cron: '0 9 * * 1-5' }), // Weekdays at 9am
    ]

    expect(schedules[0].cron).toBe('0 9 * * *')
    expect(schedules[1].cron).toBe('0 * * * *')
    expect(schedules[2].cron).toBe('*/15 * * * *')
    expect(schedules[3].cron).toBe('0 9 * * 1-5')
  })

  it('handles webhook events', () => {
    const config = Trigger({
      event: 'webhook.github.push',
      condition: 'branch === "main"',
    })

    expect(config.event).toBe('webhook.github.push')
    expect(config.condition).toBe('branch === "main"')
  })

  it('handles custom events', () => {
    const config = Trigger({
      event: 'custom.deployment.success',
    })

    expect(config.event).toBe('custom.deployment.success')
  })
})
