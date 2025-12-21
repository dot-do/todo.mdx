import { DashboardPage } from '@todo.mdx/dashboard/routes'

export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>
}) {
  const resolvedParams = await params
  const path = resolvedParams.path?.join('/') ?? ''
  return <DashboardPage path={path} basePath="/dashboard" />
}
