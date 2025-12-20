'use client'

import * as React from 'react'
import { clsx } from 'clsx'
import { File, Folder, FolderOpen, ChevronRight, ChevronDown, Loader2 } from 'lucide-react'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export interface FileTreeProps {
  sessionId: string
  onSelectFile: (path: string) => void
  selectedPath?: string
  className?: string
}

interface TreeNodeProps {
  node: FileNode
  level: number
  sessionId: string
  selectedPath?: string
  onSelectFile: (path: string) => void
}

function TreeNode({ node, level, sessionId, selectedPath, onSelectFile }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [children, setChildren] = React.useState<FileNode[]>(node.children || [])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const isDirectory = node.type === 'directory'
  const isSelected = node.path === selectedPath
  const hasChildren = children.length > 0

  const loadChildren = React.useCallback(async () => {
    if (!isDirectory || hasChildren) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/files/list?session=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(node.path)}`
      )

      if (!response.ok) {
        throw new Error(`Failed to load directory: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.entries && Array.isArray(data.entries)) {
        setChildren(data.entries)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory')
      console.error('Error loading directory:', err)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, node.path, isDirectory, hasChildren])

  const handleToggle = React.useCallback(async () => {
    if (!isDirectory) return

    if (!isExpanded && !hasChildren && !isLoading) {
      await loadChildren()
    }

    setIsExpanded(!isExpanded)
  }, [isDirectory, isExpanded, hasChildren, isLoading, loadChildren])

  const handleClick = React.useCallback(() => {
    if (isDirectory) {
      handleToggle()
    } else {
      onSelectFile(node.path)
    }
  }, [isDirectory, handleToggle, onSelectFile, node.path])

  const paddingLeft = `${level * 12 + 8}px`

  return (
    <>
      <div
        className={clsx(
          'flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
          isSelected && 'bg-gray-200 dark:bg-gray-700',
          'group'
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
        role="treeitem"
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        {isDirectory && (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
            ) : isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
            )}
          </span>
        )}
        {!isDirectory && <span className="w-4" />}

        <span className="w-4 h-4 flex-shrink-0">
          {isDirectory ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            ) : (
              <Folder className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            )
          ) : (
            <File className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </span>

        <span
          className={clsx(
            'text-sm truncate',
            isSelected
              ? 'text-gray-900 dark:text-gray-100 font-medium'
              : 'text-gray-700 dark:text-gray-300'
          )}
          title={node.name}
        >
          {node.name}
        </span>
      </div>

      {error && (
        <div
          className="text-xs text-red-600 dark:text-red-400 py-1 px-2"
          style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
        >
          {error}
        </div>
      )}

      {isExpanded && hasChildren && (
        <div role="group">
          {children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              sessionId={sessionId}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </>
  )
}

export function FileTree({
  sessionId,
  onSelectFile,
  selectedPath,
  className,
}: FileTreeProps) {
  const [rootNodes, setRootNodes] = React.useState<FileNode[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const loadRoot = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/files/list?session=${encodeURIComponent(sessionId)}&path=/workspace`
        )

        if (!response.ok) {
          throw new Error(`Failed to load files: ${response.statusText}`)
        }

        const data = await response.json()

        if (data.entries && Array.isArray(data.entries)) {
          setRootNodes(data.entries)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file tree')
        console.error('Error loading file tree:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadRoot()
  }, [sessionId])

  if (isLoading) {
    return (
      <div className={clsx('p-4 flex items-center gap-2 text-sm text-gray-500', className)}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading files...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={clsx('p-4 text-sm text-red-600 dark:text-red-400', className)}>
        {error}
      </div>
    )
  }

  if (rootNodes.length === 0) {
    return (
      <div className={clsx('p-4 text-sm text-gray-500 dark:text-gray-400', className)}>
        No files found
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'select-none overflow-auto',
        'border border-gray-200 dark:border-gray-800 rounded-md',
        'bg-white dark:bg-gray-900',
        className
      )}
      role="tree"
    >
      {rootNodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          level={0}
          sessionId={sessionId}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  )
}
