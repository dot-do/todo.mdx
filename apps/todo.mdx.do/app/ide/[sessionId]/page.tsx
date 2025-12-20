'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { Terminal, FileTree, SandboxEditor } from '@todo.mdx/dashboard'
import { Button } from '@todo.mdx/dashboard'
import { X, Plus, Maximize2, Minimize2, Sidebar, Code } from 'lucide-react'

interface IDEPageProps {
  params: Promise<{
    sessionId: string
  }>
}

interface EditorTab {
  path: string
  content: string
  dirty: boolean
}

export default function IDEPage({ params }: IDEPageProps) {
  const router = useRouter()
  const { sessionId } = use(params)

  // Layout state
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [terminalVisible, setTerminalVisible] = useState(true)
  const [terminalMaximized, setTerminalMaximized] = useState(false)

  // File state
  const [openFiles, setOpenFiles] = useState<EditorTab[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)

  // Terminal state
  const [terminalStatus, setTerminalStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  // WebSocket URL
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = typeof window !== 'undefined' ? window.location.host : ''
  const wsUrl = `${protocol}//${host}/terminal/${sessionId}/ws`

  // Load file content
  const loadFile = useCallback(async (path: string) => {
    try {
      const response = await fetch(
        `/api/files/read?session=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`
      )

      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.statusText}`)
      }

      const data = await response.json()
      return data.content || ''
    } catch (error) {
      console.error('Error loading file:', error)
      return ''
    }
  }, [sessionId])

  // Handle file selection from tree
  const handleSelectFile = useCallback(async (path: string) => {
    // Check if file is already open
    const existingTab = openFiles.find(f => f.path === path)

    if (existingTab) {
      setActiveFile(path)
      return
    }

    // Load file content
    const content = await loadFile(path)

    // Add to open files
    setOpenFiles(prev => [...prev, { path, content, dirty: false }])
    setActiveFile(path)
  }, [openFiles, loadFile])

  // Handle file content change
  const handleFileChange = useCallback((path: string, newContent: string) => {
    setOpenFiles(prev => prev.map(file => {
      if (file.path === path) {
        return { ...file, content: newContent, dirty: file.content !== newContent }
      }
      return file
    }))
  }, [])

  // Handle file save
  const handleFileSave = useCallback((path: string) => {
    setOpenFiles(prev => prev.map(file => {
      if (file.path === path) {
        return { ...file, dirty: false }
      }
      return file
    }))
  }, [])

  // Close tab
  const handleCloseTab = useCallback((path: string) => {
    const tab = openFiles.find(f => f.path === path)

    if (tab?.dirty) {
      if (!confirm(`File ${path} has unsaved changes. Close anyway?`)) {
        return
      }
    }

    setOpenFiles(prev => prev.filter(f => f.path !== path))

    if (activeFile === path) {
      const index = openFiles.findIndex(f => f.path === path)
      const nextFile = openFiles[index + 1] || openFiles[index - 1]
      setActiveFile(nextFile?.path || null)
    }
  }, [openFiles, activeFile])

  // Get active file data
  const activeFileData = openFiles.find(f => f.path === activeFile)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S - Save (handled by editor)
      // Cmd+B - Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarVisible(prev => !prev)
      }
      // Cmd+` - Toggle terminal
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault()
        setTerminalVisible(prev => !prev)
      }
      // Cmd+W - Close current tab
      if ((e.metaKey || e.ctrlKey) && e.key === 'w' && activeFile) {
        e.preventDefault()
        handleCloseTab(activeFile)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeFile, handleCloseTab])

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="h-12 border-b border-gray-800 flex items-center px-4 gap-4 bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5 text-blue-500" />
          <h1 className="text-sm font-semibold text-gray-100">todo.mdx IDE</h1>
        </div>
        <code className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
          {sessionId.slice(0, 8)}
        </code>

        <div className="ml-auto flex items-center gap-4">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                terminalStatus === 'connected'
                  ? 'bg-green-500'
                  : terminalStatus === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-gray-400 capitalize">
              {terminalStatus}
            </span>
          </div>

          {/* View toggles */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarVisible(!sidebarVisible)}
            className="text-gray-400 hover:text-gray-100"
          >
            <Sidebar className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main IDE Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* File Tree Sidebar */}
        {sidebarVisible && (
          <div className="w-64 border-r border-gray-800 bg-gray-900 flex-shrink-0 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-gray-800 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">EXPLORER</span>
            </div>
            <div className="flex-1 overflow-auto">
              <FileTree
                sessionId={sessionId}
                selectedPath={activeFile || undefined}
                onSelectFile={handleSelectFile}
                className=""
              />
            </div>
          </div>
        )}

        {/* Editor + Terminal Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Editor Area */}
          <div className={`${terminalMaximized ? 'h-0' : terminalVisible ? 'flex-[7]' : 'flex-1'} flex flex-col overflow-hidden min-h-0`}>
            {/* Tabs */}
            <div className="h-9 border-b border-gray-800 flex items-center overflow-x-auto bg-gray-900 flex-shrink-0">
              {openFiles.map(file => {
                const filename = file.path.split('/').pop() || file.path
                const isActive = file.path === activeFile

                return (
                  <div
                    key={file.path}
                    className={`h-full px-3 flex items-center gap-2 border-r border-gray-800 cursor-pointer ${
                      isActive
                        ? 'bg-gray-950 text-gray-100'
                        : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                    }`}
                    onClick={() => setActiveFile(file.path)}
                  >
                    <span className="text-sm truncate max-w-[150px]">{filename}</span>
                    {file.dirty && <span className="w-2 h-2 rounded-full bg-yellow-500" />}
                    <button
                      className="ml-1 hover:bg-gray-700 rounded p-0.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCloseTab(file.path)
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden min-h-0">
              {activeFileData ? (
                <SandboxEditor
                  sessionId={sessionId}
                  file={{
                    path: activeFileData.path,
                    content: activeFileData.content,
                  }}
                  onSave={() => handleFileSave(activeFileData.path)}
                  onChange={(content: string | undefined) => content !== undefined && handleFileChange(activeFileData.path, content)}
                  className="h-full"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 bg-gray-950">
                  <div className="text-center">
                    <Code className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">No file selected</p>
                    <p className="text-xs text-gray-600 mt-1">Select a file from the explorer to begin editing</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Terminal */}
          {terminalVisible && (
            <div className={`${terminalMaximized ? 'flex-1' : 'flex-[3]'} flex flex-col border-t border-gray-800 overflow-hidden min-h-0`}>
              <div className="h-8 border-b border-gray-800 flex items-center px-2 gap-2 bg-gray-900 flex-shrink-0">
                <span className="text-xs font-medium text-gray-400">TERMINAL</span>
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-100"
                    onClick={() => setTerminalMaximized(!terminalMaximized)}
                  >
                    {terminalMaximized ? (
                      <Minimize2 className="w-3 h-3" />
                    ) : (
                      <Maximize2 className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-100"
                    onClick={() => setTerminalVisible(false)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 bg-gray-950 overflow-hidden min-h-0">
                <Terminal
                  wsUrl={wsUrl}
                  onConnect={() => setTerminalStatus('connected')}
                  onDisconnect={() => setTerminalStatus('disconnected')}
                  className="h-full"
                />
              </div>
            </div>
          )}

          {/* Terminal toggle when hidden */}
          {!terminalVisible && (
            <div className="h-8 border-t border-gray-800 flex items-center px-2 bg-gray-900 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTerminalVisible(true)}
                className="text-xs text-gray-400 hover:text-gray-100"
              >
                <Plus className="w-3 h-3 mr-1" />
                Show Terminal
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
