---
id: todo-439
title: "File tree browser component for sandbox navigation"
state: closed
priority: 2
type: feature
labels: ["file-tree", "sandbox", "ui"]
createdAt: "2025-12-20T19:52:43.044Z"
updatedAt: "2025-12-20T20:08:49.531Z"
closedAt: "2025-12-20T20:08:49.531Z"
source: "beads"
dependsOn: ["todo-42f"]
blocks: ["todo-01p"]
---

# File tree browser component for sandbox navigation

Build a file tree component to browse and manage files in the sandbox.

## Features
- Hierarchical file/folder display
- Expand/collapse folders
- File icons by type
- Context menu (new file, rename, delete)
- Drag and drop
- Search/filter

## Libraries to Consider
- [monaco-tree](https://github.com/BlueMagnificent/monaco-tree) - Extracted from Monaco
- Custom with react-arborist or similar
- VS Code style icons via file-icons or similar

## Implementation

```tsx
// packages/dashboard/src/components/FileTree.tsx
import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface FileTreeProps {
  sessionId: string
  onSelectFile: (path: string) => void
  selectedPath?: string
}

export function FileTree({ sessionId, onSelectFile, selectedPath }: FileTreeProps) {
  const [root, setRoot] = useState<FileNode | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['/workspace']))

  // Load directory
  const loadDirectory = async (path: string) => {
    const res = await fetch(`/api/files/list?session=${sessionId}&path=${path}`)
    const data = await res.json()
    return data.entries
  }

  // Initial load
  useEffect(() => {
    loadDirectory('/workspace').then(entries => {
      setRoot({
        name: 'workspace',
        path: '/workspace',
        type: 'directory',
        children: entries
      })
    })
  }, [sessionId])

  const toggleExpand = async (path: string) => {
    const newExpanded = new Set(expanded)
    if (expanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
      // Lazy load children
      await loadChildren(path)
    }
    setExpanded(newExpanded)
  }

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expanded.has(node.path)
    const isSelected = selectedPath === node.path

    return (
      <div key={node.path}>
        <div
          className={cn(
            'flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-muted',
            isSelected && 'bg-accent'
          )}
          style={{ paddingLeft: depth * 16 + 8 }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleExpand(node.path)
            } else {
              onSelectFile(node.path)
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {node.type === 'directory' ? (
            <>
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Folder size={16} className="text-yellow-500" />
            </>
          ) : (
            <>
              <span className="w-4" />
              <FileIcon filename={node.name} />
            </>
          )}
          <span className="text-sm truncate">{node.name}</span>
        </div>

        {node.type === 'directory' && isExpanded && node.children?.map(
          child => renderNode(child, depth + 1)
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-background border-r">
      <div className="p-2 border-b flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">EXPLORER</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleNewFile}>
            <FilePlus size={14} />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNewFolder}>
            <FolderPlus size={14} />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleRefresh}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>
      {root && renderNode(root)}
    </div>
  )
}
```

## Context Menu

```tsx
function FileContextMenu({ node, position, onAction }) {
  return (
    <DropdownMenu open={true}>
      <DropdownMenuContent style={{ left: position.x, top: position.y }}>
        {node.type === 'directory' && (
          <>
            <DropdownMenuItem onClick={() => onAction('new-file')}>
              New File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('new-folder')}>
              New Folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => onAction('rename')}>
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('copy-path')}>
          Copy Path
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => onAction('delete')}
          className="text-red-500"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

## File Icons
Use language-specific icons:
```tsx
function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()
  const icons: Record<string, JSX.Element> = {
    ts: <TypeScriptIcon />,
    tsx: <ReactIcon />,
    js: <JavaScriptIcon />,
    py: <PythonIcon />,
    md: <MarkdownIcon />,
    json: <JsonIcon />,
    // ... etc
  }
  return icons[ext || ''] || <File size={16} />
}
```

## Real-time Updates
Subscribe to file changes from sandbox:
```typescript
// When Claude creates/modifies files, update tree
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.type === 'file-change') {
    refreshPath(msg.path)
  }
}
```

### Related Issues

**Depends on:**
- [todo-42f](./todo-42f.md)

**Blocks:**
- [todo-01p](./todo-01p.md)