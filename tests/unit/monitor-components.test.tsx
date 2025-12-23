/**
 * Tests for Ink StatusTable component
 * TDD approach: These tests are written first to define the component API
 */
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { StatusTable, type WorkflowStatus } from '../../src/workflows/monitor/components/StatusTable.js'

describe('StatusTable', () => {
  const mockWorkflows: WorkflowStatus[] = [
    {
      name: 'problems-tech',
      status: 'running',
      progress: { current: 150, total: 500 },
      velocity: 12.5,
      eta: '00:28:00',
    },
    {
      name: 'problems-tool',
      status: 'pending',
      progress: { current: 0, total: 300 },
      velocity: 0,
      eta: '--:--:--',
    },
    {
      name: 'solutions-gen',
      status: 'completed',
      progress: { current: 1000, total: 1000 },
      velocity: 0,
      eta: 'Done',
    },
    {
      name: 'content-seo',
      status: 'error',
      progress: { current: 45, total: 200 },
      velocity: 0,
      eta: 'Failed',
      error: 'Rate limit exceeded',
    },
  ]

  it('renders workflow rows with all columns', () => {
    const { lastFrame } = render(<StatusTable workflows={mockWorkflows} />)
    const frame = lastFrame()

    // Should contain workflow names
    expect(frame).toContain('problems-tech')
    expect(frame).toContain('problems-tool')
    expect(frame).toContain('solutions-gen')
    expect(frame).toContain('content-seo')
  })

  it('displays status for each workflow', () => {
    const { lastFrame } = render(<StatusTable workflows={mockWorkflows} />)
    const frame = lastFrame()

    expect(frame).toContain('running')
    expect(frame).toContain('pending')
    expect(frame).toContain('completed')
    expect(frame).toContain('error')
  })

  it('shows progress information', () => {
    const { lastFrame } = render(<StatusTable workflows={mockWorkflows} />)
    const frame = lastFrame()

    // Progress should show as fraction or percentage
    expect(frame).toContain('150')
    expect(frame).toContain('500')
    expect(frame).toContain('1000')
  })

  it('displays velocity column', () => {
    const { lastFrame } = render(<StatusTable workflows={mockWorkflows} />)
    const frame = lastFrame()

    // Should show velocity value
    expect(frame).toContain('12.5')
  })

  it('shows ETA column', () => {
    const { lastFrame } = render(<StatusTable workflows={mockWorkflows} />)
    const frame = lastFrame()

    expect(frame).toContain('00:28:00')
    expect(frame).toContain('Done')
    expect(frame).toContain('Failed')
  })

  it('renders column headers', () => {
    const { lastFrame } = render(<StatusTable workflows={mockWorkflows} />)
    const frame = lastFrame()

    expect(frame).toContain('Name')
    expect(frame).toContain('Status')
    expect(frame).toContain('Progress')
    expect(frame).toContain('Velocity')
    expect(frame).toContain('ETA')
  })

  it('handles empty workflow list', () => {
    const { lastFrame } = render(<StatusTable workflows={[]} />)
    const frame = lastFrame()

    // Should show a message or just headers
    expect(frame).toBeDefined()
    expect(frame).toContain('No workflows')
  })

  it('optionally shows error details', () => {
    const workflowWithError: WorkflowStatus[] = [
      {
        name: 'failing-job',
        status: 'error',
        progress: { current: 10, total: 100 },
        velocity: 0,
        eta: 'Failed',
        error: 'Connection timeout',
      },
    ]

    const { lastFrame } = render(<StatusTable workflows={workflowWithError} showErrors />)
    const frame = lastFrame()

    expect(frame).toContain('Connection timeout')
  })

  it('calculates and displays percentage progress', () => {
    const workflow: WorkflowStatus[] = [
      {
        name: 'test-workflow',
        status: 'running',
        progress: { current: 50, total: 100 },
        velocity: 5,
        eta: '00:10:00',
      },
    ]

    const { lastFrame } = render(<StatusTable workflows={workflow} showPercentage />)
    const frame = lastFrame()

    expect(frame).toContain('50%')
  })

  it('supports compact mode without headers', () => {
    const workflow: WorkflowStatus[] = [
      {
        name: 'test-workflow',
        status: 'running',
        progress: { current: 25, total: 100 },
        velocity: 2,
        eta: '00:37:30',
      },
    ]

    const { lastFrame } = render(<StatusTable workflows={workflow} compact />)
    const frame = lastFrame()

    // Should contain the workflow data
    expect(frame).toContain('test-workflow')
    // But in compact mode, headers might be omitted or minimized
  })

  it('applies color coding to status values', () => {
    // Note: ink-testing-library doesn't capture ANSI colors in lastFrame()
    // This test verifies the component renders without errors with status colors
    const { lastFrame } = render(<StatusTable workflows={mockWorkflows} />)

    // Just verify it renders successfully with all statuses
    expect(lastFrame()).toBeDefined()
  })
})

describe('WorkflowStatus type', () => {
  it('requires mandatory fields', () => {
    // Type check - this should compile
    const validStatus: WorkflowStatus = {
      name: 'test',
      status: 'pending',
      progress: { current: 0, total: 0 },
      velocity: 0,
      eta: '--:--:--',
    }

    expect(validStatus.name).toBe('test')
    expect(validStatus.status).toBe('pending')
  })

  it('allows optional error field', () => {
    const statusWithError: WorkflowStatus = {
      name: 'test',
      status: 'error',
      progress: { current: 0, total: 100 },
      velocity: 0,
      eta: 'Failed',
      error: 'Something went wrong',
    }

    expect(statusWithError.error).toBe('Something went wrong')
  })
})
