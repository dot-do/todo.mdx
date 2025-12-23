/**
 * StartWorkflowMenu - Ink component for selecting workflows to start
 *
 * Features:
 * - Lists all available workflows
 * - Arrow key navigation (up/down)
 * - Enter to start selected workflow
 * - ESC or 'q' to cancel
 */
import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

/**
 * Workflow definition with name and description
 */
export interface Workflow {
  /** Workflow identifier used for triggering */
  name: string
  /** Human-readable description of what the workflow does */
  description: string
}

/**
 * Available workflows in the system
 * These correspond to the workflows defined in wrangler.jsonc
 */
export const WORKFLOWS: Workflow[] = [
  {
    name: 'develop',
    description: 'Run autonomous development workflow on an issue',
  },
  {
    name: 'embed',
    description: 'Generate embeddings for a single item',
  },
  {
    name: 'bulk-embed',
    description: 'Generate embeddings for multiple items in batch',
  },
  {
    name: 'sync',
    description: 'Synchronize beads issues with remote',
  },
  {
    name: 'reconcile',
    description: 'Reconcile workflow state with external systems',
  },
  {
    name: 'autonomous',
    description: 'Full autonomous development cycle',
  },
]

/**
 * Props for StartWorkflowMenu component
 */
export interface StartWorkflowMenuProps {
  /** Callback when a workflow is selected */
  onSelect: (workflowName: string) => void
  /** Callback when menu is cancelled */
  onCancel: () => void
}

/**
 * StartWorkflowMenu component for selecting and starting workflows
 */
export function StartWorkflowMenu({
  onSelect,
  onCancel,
}: StartWorkflowMenuProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const handleInput = useCallback(
    (input: string, key: { upArrow: boolean; downArrow: boolean; return: boolean; escape: boolean }) => {
      // Handle ESC key
      if (key.escape) {
        onCancel()
        return
      }

      // Handle 'q' to cancel
      if (input === 'q') {
        onCancel()
        return
      }

      // Handle Enter key
      if (key.return) {
        const selected = WORKFLOWS[selectedIndex]
        onSelect(selected.name)
        return
      }

      // Handle down arrow - wrap around
      if (key.downArrow) {
        setSelectedIndex((prev) => (prev + 1) % WORKFLOWS.length)
        return
      }

      // Handle up arrow - wrap around
      if (key.upArrow) {
        setSelectedIndex((prev) => (prev - 1 + WORKFLOWS.length) % WORKFLOWS.length)
        return
      }
    },
    [selectedIndex, onSelect, onCancel]
  )

  useInput(handleInput)

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">
        Start Workflow
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {WORKFLOWS.map((workflow, index) => {
          const isSelected = index === selectedIndex
          return (
            <Box key={workflow.name}>
              <Text color={isSelected ? 'cyan' : undefined}>
                {isSelected ? '> ' : '  '}
                {workflow.name}
              </Text>
              <Text dimColor> - {workflow.description}</Text>
            </Box>
          )
        })}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Use arrows to navigate, Enter to start, ESC to cancel</Text>
      </Box>
    </Box>
  )
}

export default StartWorkflowMenu
