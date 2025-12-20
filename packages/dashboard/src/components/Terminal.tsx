'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

export interface TerminalProps {
  wsUrl: string
  onConnect?: () => void
  onDisconnect?: () => void
  onData?: (data: string) => void
  onComplete?: (exitCode: number) => void
  className?: string
}

export interface WebSocketMessage {
  type: 'stdout' | 'stderr' | 'complete' | 'error'
  data?: string
  exitCode?: number
  error?: string
}

export interface ClientMessage {
  type: 'stdin' | 'resize'
  data?: string
  cols?: number
  rows?: number
}

/**
 * Terminal component with xterm.js
 *
 * Features:
 * - Full ANSI escape code support (colors, cursor movement, clearing)
 * - Unicode support for Claude Code's UI elements
 * - Bidirectional WebSocket for stdin/stdout
 * - Responsive sizing with FitAddon
 * - Copy/paste support
 * - Clickable URLs with WebLinksAddon
 * - Auto-reconnect on connection loss
 */
export function Terminal({
  wsUrl,
  onConnect,
  onDisconnect,
  onData,
  onComplete,
  className = '',
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return

    // Create terminal instance with Claude Code aesthetic
    const xterm = new XTerminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
      scrollback: 10000,
    })

    // Add FitAddon for responsive sizing
    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)

    // Add WebLinksAddon for clickable URLs
    const webLinksAddon = new WebLinksAddon()
    xterm.loadAddon(webLinksAddon)

    // Open terminal
    xterm.open(terminalRef.current)
    fitAddon.fit()

    // Store refs
    xtermRef.current = xterm
    fitAddonRef.current = fitAddon

    // Handle resize events
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit()

        // Send resize to server if connected
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const message: ClientMessage = {
            type: 'resize',
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          }
          wsRef.current.send(JSON.stringify(message))
        }
      }
    })

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    // Handle terminal input (user typing)
    xterm.onData((data) => {
      // Forward to server
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const message: ClientMessage = { type: 'stdin', data }
        wsRef.current.send(JSON.stringify(message))
      }

      // Call callback
      onData?.(data)
    })

    // Cleanup
    return () => {
      resizeObserver.disconnect()
      xterm.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [onData])

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!xtermRef.current) return

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[Terminal] WebSocket connected')
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0

        // Send initial resize event
        if (xtermRef.current) {
          const message: ClientMessage = {
            type: 'resize',
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          }
          ws.send(JSON.stringify(message))
        }

        onConnect?.()
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage

          switch (message.type) {
            case 'stdout':
            case 'stderr':
              if (message.data && xtermRef.current) {
                xtermRef.current.write(message.data)
              }
              break

            case 'complete':
              console.log('[Terminal] Session complete', message.exitCode)
              if (xtermRef.current) {
                xtermRef.current.write(
                  `\r\n\x1b[32m[Process completed with exit code ${message.exitCode ?? 0}]\x1b[0m\r\n`
                )
              }
              onComplete?.(message.exitCode ?? 0)
              break

            case 'error':
              console.error('[Terminal] Server error:', message.error)
              if (xtermRef.current) {
                xtermRef.current.write(
                  `\r\n\x1b[31m[Error: ${message.error}]\x1b[0m\r\n`
                )
              }
              setError(message.error || 'Unknown error')
              break
          }
        } catch (err) {
          console.error('[Terminal] Failed to parse message:', err)
        }
      }

      ws.onerror = (event) => {
        console.error('[Terminal] WebSocket error:', event)
        setError('WebSocket connection error')
      }

      ws.onclose = (event) => {
        console.log('[Terminal] WebSocket closed:', event.code, event.reason)
        setIsConnected(false)
        wsRef.current = null

        onDisconnect?.()

        // Auto-reconnect with exponential backoff (max 5 attempts)
        if (reconnectAttemptsRef.current < 5 && event.code !== 1000) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
          console.log(`[Terminal] Reconnecting in ${delay}ms...`)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, delay)
        } else if (event.code !== 1000) {
          if (xtermRef.current) {
            xtermRef.current.write(
              '\r\n\x1b[31m[Connection closed. Max reconnect attempts reached.]\x1b[0m\r\n'
            )
          }
          setError('Connection closed')
        }
      }
    } catch (err) {
      console.error('[Terminal] Failed to connect:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect')
    }
  }, [wsUrl, onConnect, onDisconnect, onComplete])

  // Connect on mount and when wsUrl changes
  useEffect(() => {
    connect()

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting')
        wsRef.current = null
      }
    }
  }, [connect])

  return (
    <div className={`terminal-container ${className}`} style={{ width: '100%', height: '100%' }}>
      <div
        ref={terminalRef}
        style={{
          width: '100%',
          height: '100%',
          padding: '8px',
        }}
      />
      {error && !isConnected && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(205, 49, 49, 0.9)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '4px',
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: '14px',
            pointerEvents: 'none',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

export default Terminal
