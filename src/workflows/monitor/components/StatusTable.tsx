/**
 * StatusTable - Ink component for displaying workflow status in a table format
 *
 * Displays workflow information with columns:
 * - Name: Workflow identifier
 * - Status: Current state (running, pending, completed, error)
 * - Progress: Current/Total items processed
 * - Velocity: Items processed per second
 * - ETA: Estimated time to completion
 */
import React from 'react'
import { Box, Text } from 'ink'

/**
 * Workflow status data structure
 */
export interface WorkflowStatus {
  /** Workflow identifier/name */
  name: string
  /** Current workflow status */
  status: 'pending' | 'running' | 'completed' | 'error' | 'paused'
  /** Progress tracking */
  progress: {
    current: number
    total: number
  }
  /** Items per second processing rate */
  velocity: number
  /** Estimated time to completion (formatted string) */
  eta: string
  /** Optional error message when status is 'error' */
  error?: string
}

/**
 * StatusTable component props
 */
export interface StatusTableProps {
  /** Array of workflow status objects to display */
  workflows: WorkflowStatus[]
  /** Show detailed error messages for failed workflows */
  showErrors?: boolean
  /** Show progress as percentage instead of fraction */
  showPercentage?: boolean
  /** Compact mode - minimal output */
  compact?: boolean
}

// Column widths for consistent formatting
const COL_NAME = 20
const COL_STATUS = 12
const COL_PROGRESS = 16
const COL_VELOCITY = 10
const COL_ETA = 12

/**
 * Get color for status value
 */
function getStatusColor(status: WorkflowStatus['status']): string {
  switch (status) {
    case 'running':
      return 'blue'
    case 'completed':
      return 'green'
    case 'error':
      return 'red'
    case 'pending':
      return 'yellow'
    case 'paused':
      return 'gray'
    default:
      return 'white'
  }
}

/**
 * Pad string to fixed width
 */
function pad(str: string, width: number): string {
  if (str.length >= width) {
    return str.slice(0, width)
  }
  return str + ' '.repeat(width - str.length)
}

/**
 * Format progress as fraction or percentage
 */
function formatProgress(
  progress: WorkflowStatus['progress'],
  showPercentage?: boolean
): string {
  if (showPercentage) {
    const percent = progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0
    return `${percent}%`
  }
  return `${progress.current}/${progress.total}`
}

/**
 * StatusTable component for displaying workflow statuses
 */
export function StatusTable({
  workflows,
  showErrors = false,
  showPercentage = false,
  compact = false,
}: StatusTableProps) {
  // Handle empty workflows
  if (workflows.length === 0) {
    return (
      <Box flexDirection="column">
        {!compact && <TableHeader />}
        <Text dimColor>No workflows</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {!compact && <TableHeader />}
      {workflows.map((workflow, index) => (
        <React.Fragment key={workflow.name}>
          <WorkflowRow
            workflow={workflow}
            showPercentage={showPercentage}
          />
          {showErrors && workflow.error && (
            <Box paddingLeft={2}>
              <Text color="red" dimColor>
                Error: {workflow.error}
              </Text>
            </Box>
          )}
        </React.Fragment>
      ))}
    </Box>
  )
}

/**
 * Table header row
 */
function TableHeader() {
  return (
    <Box>
      <Text bold>
        {pad('Name', COL_NAME)}
        {pad('Status', COL_STATUS)}
        {pad('Progress', COL_PROGRESS)}
        {pad('Velocity', COL_VELOCITY)}
        {pad('ETA', COL_ETA)}
      </Text>
    </Box>
  )
}

/**
 * Individual workflow row
 */
function WorkflowRow({
  workflow,
  showPercentage,
}: {
  workflow: WorkflowStatus
  showPercentage?: boolean
}) {
  const statusColor = getStatusColor(workflow.status)
  const progressStr = formatProgress(workflow.progress, showPercentage)
  const velocityStr = workflow.velocity > 0 ? workflow.velocity.toFixed(1) : '0'

  return (
    <Box>
      <Text>{pad(workflow.name, COL_NAME)}</Text>
      <Text color={statusColor}>{pad(workflow.status, COL_STATUS)}</Text>
      <Text>{pad(progressStr, COL_PROGRESS)}</Text>
      <Text>{pad(velocityStr, COL_VELOCITY)}</Text>
      <Text>{pad(workflow.eta, COL_ETA)}</Text>
    </Box>
  )
}

export default StatusTable
