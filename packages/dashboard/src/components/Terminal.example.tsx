/**
 * Terminal Component Usage Example
 *
 * This file demonstrates how to use the Terminal component with xterm.js
 * for interactive Claude Code sessions.
 */

import { Terminal } from './Terminal'

/**
 * Basic usage with a WebSocket connection
 */
export function BasicTerminalExample() {
  const wsUrl = 'wss://api.todo.mdx.do/sandbox/ws?repo=owner/repo&task=Fix bug&installationId=123'

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <Terminal wsUrl={wsUrl} />
    </div>
  )
}

/**
 * Advanced usage with event handlers
 */
export function AdvancedTerminalExample() {
  const wsUrl = 'wss://api.todo.mdx.do/sandbox/ws?repo=owner/repo&task=Add feature&installationId=123'

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <Terminal
        wsUrl={wsUrl}
        onConnect={() => {
          console.log('Terminal connected')
        }}
        onDisconnect={() => {
          console.log('Terminal disconnected')
        }}
        onData={(data) => {
          console.log('User input:', data)
        }}
        onComplete={(exitCode) => {
          console.log('Session completed with exit code:', exitCode)
        }}
        className="my-custom-terminal"
      />
    </div>
  )
}

/**
 * Full-screen terminal
 */
export function FullScreenTerminalExample() {
  const wsUrl = 'wss://api.todo.mdx.do/sandbox/ws?repo=owner/repo&task=Refactor code&installationId=123'

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Terminal
        wsUrl={wsUrl}
        onComplete={(exitCode) => {
          if (exitCode === 0) {
            console.log('Success!')
          } else {
            console.error('Failed with exit code:', exitCode)
          }
        }}
      />
    </div>
  )
}
