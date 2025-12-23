import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { KillWorkflowMenu } from '../../src/workflows/monitor/components/KillWorkflowMenu.js'

describe('KillWorkflowMenu', () => {
  it('renders only running workflows', () => {
    const running = [{ name: 'problems-tech', pid: 12345 }]
    const { lastFrame } = render(
      <KillWorkflowMenu
        runningWorkflows={running}
        onKill={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(lastFrame()).toContain('problems-tech')
    expect(lastFrame()).toContain('12345')
  })

  it('shows empty message when no workflows running', () => {
    const { lastFrame } = render(
      <KillWorkflowMenu
        runningWorkflows={[]}
        onKill={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(lastFrame()).toContain('No running workflows')
  })

  it('renders multiple workflows', () => {
    const running = [
      { name: 'problems-tech', pid: 12345 },
      { name: 'enrich-companies', pid: 54321 },
      { name: 'generate-content', pid: 99999 },
    ]
    const { lastFrame } = render(
      <KillWorkflowMenu
        runningWorkflows={running}
        onKill={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(lastFrame()).toContain('problems-tech')
    expect(lastFrame()).toContain('enrich-companies')
    expect(lastFrame()).toContain('generate-content')
  })

  it('shows title/header', () => {
    const running = [{ name: 'test-workflow', pid: 1111 }]
    const { lastFrame } = render(
      <KillWorkflowMenu
        runningWorkflows={running}
        onKill={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(lastFrame()).toContain('Kill Workflow')
  })

  it('shows navigation hints', () => {
    const running = [{ name: 'test-workflow', pid: 1111 }]
    const { lastFrame } = render(
      <KillWorkflowMenu
        runningWorkflows={running}
        onKill={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    // Should show key hints for navigation
    const frame = lastFrame() || ''
    expect(frame).toMatch(/arrow|up|down/i)
    expect(frame).toMatch(/enter/i)
    expect(frame).toMatch(/esc/i)
  })

  it('highlights selected workflow', () => {
    const running = [
      { name: 'workflow-one', pid: 1111 },
      { name: 'workflow-two', pid: 2222 },
    ]
    const { lastFrame } = render(
      <KillWorkflowMenu
        runningWorkflows={running}
        onKill={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    const frame = lastFrame() || ''
    // First item should be selected by default (indicated by arrow or highlight)
    expect(frame).toContain('>')
  })

  it('calls onKill with correct workflow when Enter pressed', async () => {
    const onKill = vi.fn()
    const running = [{ name: 'problems-tech', pid: 12345 }]
    const { stdin } = render(
      <KillWorkflowMenu
        runningWorkflows={running}
        onKill={onKill}
        onCancel={vi.fn()}
      />
    )

    // Press Enter to kill selected workflow
    stdin.write('\r')

    expect(onKill).toHaveBeenCalledWith('problems-tech', 12345)
  })

  it('calls onCancel when Escape pressed', async () => {
    const onCancel = vi.fn()
    const running = [{ name: 'problems-tech', pid: 12345 }]
    const { stdin } = render(
      <KillWorkflowMenu
        runningWorkflows={running}
        onKill={vi.fn()}
        onCancel={onCancel}
      />
    )

    // Press Escape to cancel
    stdin.write('\x1B')

    expect(onCancel).toHaveBeenCalled()
  })

  it('navigates with arrow keys', async () => {
    const onKill = vi.fn()
    const running = [
      { name: 'workflow-one', pid: 1111 },
      { name: 'workflow-two', pid: 2222 },
    ]
    const { stdin } = render(
      <KillWorkflowMenu
        runningWorkflows={running}
        onKill={onKill}
        onCancel={vi.fn()}
      />
    )

    // Press Down arrow to select second workflow
    stdin.write('\x1B[B')

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 50))

    // Press Enter to kill
    stdin.write('\r')

    expect(onKill).toHaveBeenCalledWith('workflow-two', 2222)
  })

  it('wraps around when navigating past last item', async () => {
    const onKill = vi.fn()
    const running = [
      { name: 'workflow-one', pid: 1111 },
      { name: 'workflow-two', pid: 2222 },
    ]
    const { stdin } = render(
      <KillWorkflowMenu
        runningWorkflows={running}
        onKill={onKill}
        onCancel={vi.fn()}
      />
    )

    // Press Down twice to wrap around to first
    stdin.write('\x1B[B')
    stdin.write('\x1B[B')

    // Press Enter to kill
    stdin.write('\r')

    expect(onKill).toHaveBeenCalledWith('workflow-one', 1111)
  })

  it('wraps around when navigating before first item', async () => {
    const onKill = vi.fn()
    const running = [
      { name: 'workflow-one', pid: 1111 },
      { name: 'workflow-two', pid: 2222 },
    ]
    const { stdin } = render(
      <KillWorkflowMenu
        runningWorkflows={running}
        onKill={onKill}
        onCancel={vi.fn()}
      />
    )

    // Press Up to wrap around to last
    stdin.write('\x1B[A')

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 50))

    // Press Enter to kill
    stdin.write('\r')

    expect(onKill).toHaveBeenCalledWith('workflow-two', 2222)
  })
})
