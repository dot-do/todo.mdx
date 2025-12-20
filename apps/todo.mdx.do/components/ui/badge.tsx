import * as React from 'react'
import { clsx } from 'clsx'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          'bg-gray-900 text-gray-50 dark:bg-gray-50 dark:text-gray-900': variant === 'default',
          'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50': variant === 'secondary',
          'bg-red-500 text-gray-50 dark:bg-red-900 dark:text-gray-50': variant === 'destructive',
          'border border-gray-200 dark:border-gray-800': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}
