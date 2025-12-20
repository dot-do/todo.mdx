'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function NewIDESessionPage() {
  const router = useRouter()

  useEffect(() => {
    // Generate a new session ID and redirect
    const createSession = async () => {
      try {
        // Call API to create new session
        const response = await fetch('/api/sessions/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'ide' }),
        })

        if (!response.ok) {
          throw new Error('Failed to create session')
        }

        const data = await response.json()
        const sessionId = data.sessionId || data.id

        // Redirect to the new session
        router.push(`/ide/${sessionId}`)
      } catch (error) {
        console.error('Error creating session:', error)
        // Fallback: generate client-side session ID
        const sessionId = `ide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        router.push(`/ide/${sessionId}`)
      }
    }

    createSession()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-sm text-gray-400">Creating new IDE session...</p>
      </div>
    </div>
  )
}
