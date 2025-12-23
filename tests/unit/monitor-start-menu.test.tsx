/**
 * Tests for StartWorkflowMenu Ink component
 *
 * TDD approach: These tests are written first, before implementation.
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { StartWorkflowMenu, WORKFLOWS } from '../../src/workflows/monitor/components/StartWorkflowMenu.js'

describe('StartWorkflowMenu', () => {
  it('renders list of all workflows', () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { lastFrame } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    // Should contain at least one workflow name
    expect(lastFrame()).toContain('develop')
  })

  it('displays all available workflows from WORKFLOWS array', () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { lastFrame } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    const frame = lastFrame()

    // All workflows should be visible
    for (const workflow of WORKFLOWS) {
      expect(frame).toContain(workflow.name)
    }
  })

  it('highlights the first item by default', () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { lastFrame } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    const frame = lastFrame()
    // First workflow should have a selection indicator
    // Using > as cursor indicator
    expect(frame).toMatch(/>\s*develop/)
  })

  it('navigates down with down arrow key', async () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { stdin } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    // Press down arrow (escape sequence)
    stdin.write('\x1B[B')

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 50))

    // Press Enter to select current item
    stdin.write('\r')

    // Second item should be selected (embed)
    expect(onSelect).toHaveBeenCalledWith('embed')
  })

  it('navigates up with up arrow key', async () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { stdin } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    // Press down twice, then up once
    stdin.write('\x1B[B') // down
    await new Promise(resolve => setTimeout(resolve, 50))
    stdin.write('\x1B[B') // down
    await new Promise(resolve => setTimeout(resolve, 50))
    stdin.write('\x1B[A') // up
    await new Promise(resolve => setTimeout(resolve, 50))

    // Press Enter to select
    stdin.write('\r')

    // Second item should be selected (index 1 = embed)
    expect(onSelect).toHaveBeenCalledWith(WORKFLOWS[1].name)
  })

  it('wraps around when navigating past last item', async () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { stdin } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    // Press down for each workflow to wrap around back to first
    for (let i = 0; i < WORKFLOWS.length; i++) {
      stdin.write('\x1B[B')
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Press Enter to select
    stdin.write('\r')

    // Should wrap back to first item
    expect(onSelect).toHaveBeenCalledWith('develop')
  })

  it('wraps around when navigating before first item', async () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { stdin } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    // Press up from first item to wrap to last
    stdin.write('\x1B[A')
    await new Promise(resolve => setTimeout(resolve, 50))

    // Press Enter to select
    stdin.write('\r')

    // Should wrap to last item
    const lastWorkflow = WORKFLOWS[WORKFLOWS.length - 1]
    expect(onSelect).toHaveBeenCalledWith(lastWorkflow.name)
  })

  it('calls onSelect with workflow name when Enter is pressed', () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { stdin } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    // Press Enter on first item
    stdin.write('\r')

    expect(onSelect).toHaveBeenCalledWith('develop')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('calls onSelect with correct workflow after navigation', async () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { stdin } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    // Navigate down and press Enter
    stdin.write('\x1B[B') // down
    await new Promise(resolve => setTimeout(resolve, 50))
    stdin.write('\r') // enter

    expect(onSelect).toHaveBeenCalledWith(WORKFLOWS[1].name)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Escape is pressed', () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { stdin } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    // Press Escape
    stdin.write('\x1B')

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('calls onCancel when q is pressed', () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { stdin } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    // Press q
    stdin.write('q')

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('displays a title', () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { lastFrame } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    const frame = lastFrame()
    expect(frame).toContain('Start Workflow')
  })

  it('displays keyboard hints', () => {
    const onSelect = vi.fn()
    const onCancel = vi.fn()

    const { lastFrame } = render(
      <StartWorkflowMenu onSelect={onSelect} onCancel={onCancel} />
    )

    const frame = lastFrame()
    // Should show some form of keyboard help
    expect(frame).toMatch(/enter|esc|arrows/i)
  })
})

describe('WORKFLOWS constant', () => {
  it('exports an array of workflows', () => {
    expect(Array.isArray(WORKFLOWS)).toBe(true)
    expect(WORKFLOWS.length).toBeGreaterThan(0)
  })

  it('each workflow has name and description', () => {
    for (const workflow of WORKFLOWS) {
      expect(workflow).toHaveProperty('name')
      expect(workflow).toHaveProperty('description')
      expect(typeof workflow.name).toBe('string')
      expect(typeof workflow.description).toBe('string')
    }
  })

  it('includes all expected workflows', () => {
    const names = WORKFLOWS.map(w => w.name)

    expect(names).toContain('develop')
    expect(names).toContain('embed')
    expect(names).toContain('sync')
    expect(names).toContain('reconcile')
    expect(names).toContain('autonomous')
  })
})
