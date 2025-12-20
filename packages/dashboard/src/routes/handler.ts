import { type NextRequest } from 'next/server'

export interface DashboardRoute {
  path: string
  component: () => Promise<{ default: React.ComponentType<unknown> }>
}

export interface DashboardHandlerConfig {
  routes?: DashboardRoute[]
  basePath?: string
}

/**
 * Creates a Next.js catch-all route handler for /dashboard/[[...path]]
 *
 * Usage in app/dashboard/[[...path]]/page.tsx:
 * ```tsx
 * import { createDashboardHandler } from '@todo.mdx/dashboard/routes'
 * export default createDashboardHandler({ basePath: '/dashboard' })
 * ```
 */
export function createDashboardHandler(config: DashboardHandlerConfig = {}) {
  const { basePath = '/dashboard' } = config

  return async function DashboardHandler({
    params,
  }: {
    params: Promise<{ path?: string[] }>
  }) {
    const resolvedParams = await params
    const path = resolvedParams.path?.join('/') ?? ''

    // Dynamic import to avoid bundling issues
    const { DashboardPage } = await import('./page')

    return DashboardPage({ path, basePath })
  }
}

/**
 * Utility to parse dashboard route params
 */
export function parseDashboardPath(path: string[] | undefined): string {
  return path?.join('/') ?? ''
}
