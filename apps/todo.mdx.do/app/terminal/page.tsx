import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@todo.mdx/dashboard'

export default function TerminalHistoryPage() {
  return (
    <main className="flex min-h-screen flex-col p-8">
      <div className="max-w-7xl w-full mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Terminal Sessions</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Manage and monitor terminal sessions
            </p>
          </div>
          <Link href="/terminal/new">
            <Button size="lg">New Session</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Currently running terminal sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No active sessions. Start a new session to get started.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <CardDescription>Previously completed terminal sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No session history available.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
