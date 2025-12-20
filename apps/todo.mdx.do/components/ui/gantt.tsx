'use client'

import * as React from 'react'
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays, addWeeks } from 'date-fns'
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor, DragOverlay } from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { clsx } from 'clsx'

export interface GanttTask {
  id: string
  title: string
  group: string
  startDate: Date
  endDate: Date
  priority?: number
  status?: 'open' | 'in_progress' | 'blocked' | 'closed'
  color?: string
}

export interface GanttProps {
  tasks: GanttTask[]
  onTaskUpdate?: (taskId: string, startDate: Date, endDate: Date) => void
  className?: string
}

const COLUMN_WIDTH = 40
const ROW_HEIGHT = 48
const HEADER_HEIGHT = 60

export function Gantt({ tasks, onTaskUpdate, className }: GanttProps) {
  const [activeTask, setActiveTask] = React.useState<GanttTask | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Calculate date range
  const allDates = tasks.flatMap(task => [task.startDate, task.endDate])
  const minDate = allDates.length > 0
    ? startOfWeek(new Date(Math.min(...allDates.map(d => d.getTime()))))
    : startOfWeek(new Date())
  const maxDate = allDates.length > 0
    ? endOfWeek(addWeeks(new Date(Math.max(...allDates.map(d => d.getTime()))), 2))
    : endOfWeek(addWeeks(new Date(), 4))

  const dateRange = eachDayOfInterval({ start: minDate, end: maxDate })

  // Group tasks
  const groupedTasks = React.useMemo(() => {
    const groups = new Map<string, GanttTask[]>()
    tasks.forEach(task => {
      const existing = groups.get(task.group) || []
      groups.set(task.group, [...existing, task])
    })
    return groups
  }, [tasks])

  const handleDragStart = (event: any) => {
    const task = tasks.find(t => t.id === event.active.id)
    setActiveTask(task || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null)

    if (!event.delta.x) return

    const taskId = event.active.id as string
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // Calculate day offset from pixel delta
    const dayOffset = Math.round(event.delta.x / COLUMN_WIDTH)
    if (dayOffset === 0) return

    const newStartDate = addDays(task.startDate, dayOffset)
    const newEndDate = addDays(task.endDate, dayOffset)

    console.log('Task moved:', {
      taskId,
      title: task.title,
      oldStart: format(task.startDate, 'yyyy-MM-dd'),
      oldEnd: format(task.endDate, 'yyyy-MM-dd'),
      newStart: format(newStartDate, 'yyyy-MM-dd'),
      newEnd: format(newEndDate, 'yyyy-MM-dd'),
      dayOffset,
    })

    onTaskUpdate?.(taskId, newStartDate, newEndDate)
  }

  return (
    <div className={clsx('relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800', className)}>
      <DndContext
        sensors={sensors}
        modifiers={[restrictToHorizontalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto">
          <div style={{ minWidth: dateRange.length * COLUMN_WIDTH + 200 }}>
            {/* Header */}
            <div className="sticky top-0 z-20 flex border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
              <div className="w-[200px] shrink-0 px-4 py-3 font-semibold">
                Task
              </div>
              <div className="flex">
                {dateRange.map((date, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'flex flex-col items-center justify-center border-l border-gray-200 dark:border-gray-800',
                      date.getDay() === 0 || date.getDay() === 6 ? 'bg-gray-50 dark:bg-gray-900' : ''
                    )}
                    style={{ width: COLUMN_WIDTH, height: HEADER_HEIGHT }}
                  >
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {format(date, 'EEE')}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {format(date, 'd')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Task rows */}
            <div className="relative">
              {Array.from(groupedTasks.entries()).map(([group, groupTasks], groupIndex) => (
                <div key={group}>
                  {/* Group header */}
                  <div className="flex border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                    <div className="w-[200px] shrink-0 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {group}
                    </div>
                    <div className="flex-1" />
                  </div>

                  {/* Group tasks */}
                  {groupTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      dateRange={dateRange}
                      minDate={minDate}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeTask ? (
            <div
              className="rounded bg-blue-500 px-2 py-1 text-xs text-white opacity-80"
              style={{ width: differenceInDays(activeTask.endDate, activeTask.startDate) * COLUMN_WIDTH }}
            >
              {activeTask.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

interface TaskRowProps {
  task: GanttTask
  dateRange: Date[]
  minDate: Date
}

function TaskRow({ task, dateRange, minDate }: TaskRowProps) {
  const startOffset = differenceInDays(task.startDate, minDate)
  const duration = differenceInDays(task.endDate, task.startDate)

  const statusColors = {
    open: 'bg-gray-400 dark:bg-gray-600',
    in_progress: 'bg-blue-500 dark:bg-blue-600',
    blocked: 'bg-red-500 dark:bg-red-600',
    closed: 'bg-green-500 dark:bg-green-600',
  }

  const priorityBorders = {
    1: 'border-2 border-red-500',
    2: 'border-2 border-orange-500',
    3: 'border-2 border-yellow-500',
  }

  return (
    <div className="flex border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
      <div className="w-[200px] shrink-0 px-4 py-3">
        <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {task.priority && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              P{task.priority}
            </span>
          )}
          {task.status && (
            <span className={clsx(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white',
              statusColors[task.status]
            )}>
              {task.status.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>

      <div className="relative flex" style={{ height: ROW_HEIGHT }}>
        {dateRange.map((date, i) => (
          <div
            key={i}
            className={clsx(
              'border-l border-gray-200 dark:border-gray-800',
              date.getDay() === 0 || date.getDay() === 6 ? 'bg-gray-50/50 dark:bg-gray-900/50' : ''
            )}
            style={{ width: COLUMN_WIDTH }}
          />
        ))}

        {/* Task bar */}
        <div
          id={task.id}
          className={clsx(
            'absolute top-2 cursor-move rounded px-2 py-1',
            task.color || statusColors[task.status || 'open'],
            task.priority ? priorityBorders[task.priority as 1 | 2 | 3] : '',
            'transition-all hover:shadow-lg'
          )}
          style={{
            left: startOffset * COLUMN_WIDTH,
            width: Math.max(duration * COLUMN_WIDTH, COLUMN_WIDTH),
            height: ROW_HEIGHT - 16,
          }}
        >
          <div className="truncate text-xs font-medium text-white">
            {task.title}
          </div>
        </div>
      </div>
    </div>
  )
}
