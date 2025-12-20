'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Terminal } from '@todo.mdx/dashboard'
import { Button } from '@todo.mdx/dashboard'

interface SessionPageProps {
  params: Promise<{
    sessionId: string
  }>
}

export default function TerminalSessionPage({ params }: SessionPageProps) {
  const router = useRouter()
  const { sessionId } = use(params)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'completed'>('connecting')
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [isTerminating, setIsTerminating] = useState(false)

  // Construct WebSocket URL
  // Use wss:// for production, ws:// for localhost
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = typeof window !== 'undefined' ? window.location.host : ''
  const wsUrl = `${protocol}//${host}/terminal/${sessionId}/ws`

  const handleConnect = () => {
    setStatus('connected')
  }

  const handleDisconnect = () => {
    if (status !== 'completed') {
      setStatus('disconnected')
    }
  }

  const handleComplete = (code: number) => {
    setStatus('completed')
    setExitCode(code)
  }

  const handleTerminate = async () => {
    if (!confirm('Are you sure you want to terminate this session? This cannot be undone.')) {
      return
    }

    setIsTerminating(true)
    try {
      const response = await fetch(`/terminal/${sessionId}/terminate`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to terminate session')
      }

      // Will trigger disconnect and cleanup
    } catch (err) {
      console.error('Failed to terminate session:', err)
      alert('Failed to terminate session. Please try again.')
    } finally {
      setIsTerminating(false)
    }
  }

  const handleGoBack = () => {
    router.push('/terminal')
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Terminal Session</h1>
          <code className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
            {sessionId}
          </code>
        </div>

        <div className="flex items-center gap-4">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-green-500'
                  : status === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : status === 'completed'
                  ? 'bg-blue-500'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
              {status}
              {exitCode !== null && ` (exit code: ${exitCode})`}
            </span>
          </div>

          {/* Action Buttons */}
          {status === 'connected' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleTerminate}
              disabled={isTerminating}
            >
              {isTerminating ? 'Terminating...' : 'Terminate'}
            </Button>
          )}

          {(status === 'completed' || status === 'disconnected') && (
            <Button variant="outline" size="sm" onClick={handleGoBack}>
              Back to Sessions
            </Button>
          )}
        </div>
      </header>

      {/* Terminal */}
      <div className="flex-1 bg-gray-900 dark:bg-black">
        <Terminal
          wsUrl={wsUrl}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onComplete={handleComplete}
          className="h-full"
        />
      </div>
    </div>
  )
}
