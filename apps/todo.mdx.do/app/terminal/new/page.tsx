'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button } from '@todo.mdx/dashboard'

export default function NewTerminalSessionPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const repo = formData.get('repo') as string
    const task = formData.get('task') as string
    const installationId = formData.get('installationId') as string

    try {
      const response = await fetch('/terminal/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo,
          task,
          installationId: installationId || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to start session: ${response.statusText}`)
      }

      const data = await response.json()
      const sessionId = data.sessionId

      if (!sessionId) {
        throw new Error('No session ID returned from server')
      }

      // Redirect to the session page
      router.push(`/terminal/${sessionId}`)
    } catch (err) {
      console.error('Failed to start terminal session:', err)
      setError(err instanceof Error ? err.message : 'Failed to start session')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <Card>
          <CardHeader>
            <CardTitle>Start New Terminal Session</CardTitle>
            <CardDescription>
              Create a new terminal session to work on a task in your repository
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label
                  htmlFor="repo"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Repository
                </label>
                <input
                  id="repo"
                  name="repo"
                  type="text"
                  placeholder="owner/repo"
                  required
                  className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 dark:focus-visible:ring-gray-800"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Format: owner/repository (e.g., octocat/hello-world)
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="task"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Task Description
                </label>
                <textarea
                  id="task"
                  name="task"
                  rows={4}
                  placeholder="Describe the task you want to work on..."
                  required
                  className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 dark:focus-visible:ring-gray-800"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  What do you want Claude to help you with?
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="installationId"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Installation ID (Optional)
                </label>
                <input
                  id="installationId"
                  name="installationId"
                  type="text"
                  placeholder="GitHub App installation ID"
                  className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 dark:focus-visible:ring-gray-800"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Leave empty to auto-detect from repository
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/terminal')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Starting...' : 'Start Session'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  )
}
