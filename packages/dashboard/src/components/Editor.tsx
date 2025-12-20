'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

export interface SandboxEditorProps {
  sessionId: string
  file: {
    path: string
    content: string
  }
  onSave?: () => void
  onChange?: (content: string) => void
  className?: string
}

/**
 * Detects the Monaco editor language from a file path extension
 */
function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    css: 'css',
    html: 'html',
    sql: 'sql',
  }
  return map[ext || ''] || 'plaintext'
}

/**
 * Monaco editor component integrated with sandbox file system.
 *
 * Features:
 * - Dark theme (vs-dark)
 * - Language detection from file extension
 * - Cmd+S / Ctrl+S to save
 * - Dirty indicator when content changed
 * - Automatic layout on container resize
 */
export function SandboxEditor({
  sessionId,
  file,
  onSave,
  onChange,
  className = '',
}: SandboxEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const originalContentRef = useRef(file.content)

  // Update original content when file prop changes
  useEffect(() => {
    originalContentRef.current = file.content
    setIsDirty(false)
  }, [file.path, file.content])

  const handleEditorDidMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor

      // Add Cmd+S / Ctrl+S keybinding to save
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        handleSave()
      })

      // Focus the editor
      editor.focus()
    },
    []
  )

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const newContent = value ?? ''

      // Update dirty state
      setIsDirty(newContent !== originalContentRef.current)

      // Call onChange callback if provided
      onChange?.(newContent)
    },
    [onChange]
  )

  const handleSave = useCallback(async () => {
    if (!editorRef.current || isSaving) return

    const content = editorRef.current.getValue()

    setIsSaving(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/files/write?session=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path, content }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save file' }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      // Update original content and clear dirty flag
      originalContentRef.current = content
      setIsDirty(false)

      // Call onSave callback if provided
      onSave?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      setSaveError(message)
      console.error('Failed to save file:', error)
    } finally {
      setIsSaving(false)
    }
  }, [sessionId, file.path, onSave, isSaving])

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      editorRef.current?.layout()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const language = detectLanguage(file.path)

  return (
    <div className={`sandbox-editor ${className}`} style={{ position: 'relative', height: '100%' }}>
      {/* Status bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '30px',
          background: '#1e1e1e',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          fontSize: '12px',
          color: '#ccc',
          zIndex: 10,
        }}
      >
        <span style={{ flex: 1 }}>{file.path}</span>
        {isDirty && (
          <span style={{ marginRight: '12px', color: '#ffa500' }}>
            ● Modified
          </span>
        )}
        {isSaving && (
          <span style={{ marginRight: '12px', color: '#4a9eff' }}>
            Saving...
          </span>
        )}
        {saveError && (
          <span style={{ marginRight: '12px', color: '#f44336' }}>
            Error: {saveError}
          </span>
        )}
        <span style={{ color: '#888' }}>
          {language} | Cmd+S to save
        </span>
      </div>

      {/* Monaco Editor */}
      <div style={{ position: 'absolute', top: '30px', left: 0, right: 0, bottom: 0 }}>
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={file.content}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'off',
            renderWhitespace: 'selection',
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>
    </div>
  )
}

export type { editor, Monaco }
