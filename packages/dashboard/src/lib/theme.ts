/**
 * Dashboard theme constants for consistent styling across components.
 *
 * These constants define the visual appearance of statuses, priorities,
 * and issue types throughout the dashboard.
 */

// Issue status types
export type IssueStatus = 'open' | 'in_progress' | 'blocked' | 'closed'

// Issue priority levels (0 = highest, 4 = lowest)
export type IssuePriority = 0 | 1 | 2 | 3 | 4

// Issue types
export type IssueType = 'bug' | 'feature' | 'task' | 'epic' | 'chore'

// Color theme names used in stats cards
export type ThemeColor = 'gray' | 'blue' | 'yellow' | 'red' | 'green'

/**
 * Status badge colors for issue list and other status displays.
 * Uses Tailwind classes with dark mode variants.
 */
export const STATUS_COLORS: Record<IssueStatus, string> = {
  open: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  closed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
}

/**
 * Priority text colors for issue displays.
 * P0 = critical (red), P4 = lowest (gray)
 */
export const PRIORITY_COLORS: Record<IssuePriority, string> = {
  0: 'text-red-600 dark:text-red-400',
  1: 'text-orange-600 dark:text-orange-400',
  2: 'text-yellow-600 dark:text-yellow-400',
  3: 'text-blue-600 dark:text-blue-400',
  4: 'text-gray-500 dark:text-gray-400',
}

/**
 * Emoji icons for different issue types.
 */
export const TYPE_ICONS: Record<IssueType, string> = {
  bug: '\u{1F41B}',      // bug emoji
  feature: '\u{2728}',   // sparkles emoji
  task: '\u{1F4CB}',     // clipboard emoji
  epic: '\u{1F3AF}',     // target emoji
  chore: '\u{1F527}',    // wrench emoji
}

/**
 * Color class sets for stat cards and themed components.
 * Provides consistent background, icon, and border colors.
 */
export const THEME_COLORS: Record<ThemeColor, {
  bg: string
  icon: string
  border: string
}> = {
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-900',
    icon: 'text-gray-500 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-800',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    icon: 'text-blue-500 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    icon: 'text-yellow-500 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950',
    icon: 'text-red-500 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-950',
    icon: 'text-green-500 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
}

/**
 * Default priority color for unknown/out-of-range priorities.
 */
export const DEFAULT_PRIORITY_COLOR = PRIORITY_COLORS[4]

/**
 * Helper to get priority color with fallback for unknown priorities.
 */
export function getPriorityColor(priority: number): string {
  if (priority in PRIORITY_COLORS) {
    return PRIORITY_COLORS[priority as IssuePriority]
  }
  return DEFAULT_PRIORITY_COLOR
}
