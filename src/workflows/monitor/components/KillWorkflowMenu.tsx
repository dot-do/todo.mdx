/**
 * KillWorkflowMenu - Ink component for selecting running workflows to kill
 *
 * Features:
 * - Lists only running workflows (filtered by caller)
 * - Arrow key navigation (up/down)
 * - Enter to kill selected workflow
 * - ESC to cancel
 */
import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

export interface RunningWorkflow {
  name: string
  pid: number
}

export interface KillWorkflowMenuProps {
  runningWorkflows: RunningWorkflow[]
  onKill: (workflowName: string, pid: number) => void
  onCancel: () => void
}

export function KillWorkflowMenu({
  runningWorkflows,
  onKill,
  onCancel,
}: KillWorkflowMenuProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const handleInput = useCallback(
    (input: string, key: { upArrow: boolean; downArrow: boolean; return: boolean; escape: boolean }) => {
      if (key.escape) {
        onCancel()
        return
      }

      if (key.return && runningWorkflows.length > 0) {
        const selected = runningWorkflows[selectedIndex]
        onKill(selected.name, selected.pid)
        return
      }

      if (key.downArrow) {
        setSelectedIndex((prev) => (prev + 1) % runningWorkflows.length)
        return
      }

      if (key.upArrow) {
        setSelectedIndex((prev) => (prev - 1 + runningWorkflows.length) % runningWorkflows.length)
        return
      }
    },
    [runningWorkflows, selectedIndex, onKill, onCancel]
  )

  useInput(handleInput)

  // Empty state
  if (runningWorkflows.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="yellow">
          Kill Workflow
        </Text>
        <Box marginTop={1}>
          <Text color="gray">No running workflows</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to go back</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="red">
        Kill Workflow
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {runningWorkflows.map((workflow, index) => {
          const isSelected = index === selectedIndex
          return (
            <Box key={workflow.name}>
              <Text color={isSelected ? 'cyan' : undefined}>
                {isSelected ? '> ' : '  '}
                {workflow.name}
              </Text>
              <Text dimColor> (PID: {workflow.pid})</Text>
            </Box>
          )
        })}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Use arrow keys (up/down) to navigate</Text>
        <Text dimColor>Press Enter to kill, ESC to cancel</Text>
      </Box>
    </Box>
  )
}
