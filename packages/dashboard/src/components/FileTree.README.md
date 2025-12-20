# FileTree Component

A hierarchical file browser component for sandbox navigation with lazy loading, file type icons, and selection state management.

## Features

- **Hierarchical Display**: Nested file/folder structure with indentation
- **Lazy Loading**: Loads directory contents on-demand when expanded
- **File Type Icons**: Visual distinction between files and folders using lucide-react icons
- **Selection State**: Highlights selected file with visual feedback
- **Keyboard Navigation**: Accessible via keyboard (Enter/Space to select)
- **Loading States**: Shows spinners during async operations
- **Error Handling**: Displays inline error messages for failed operations
- **Dark Mode Support**: Automatic dark mode styling

## Usage

```tsx
import { FileTree } from '@todo.mdx/dashboard/components'

function MyComponent() {
  const [selectedFile, setSelectedFile] = React.useState<string>()

  return (
    <FileTree
      sessionId="your-sandbox-session-id"
      onSelectFile={(path) => {
        console.log('File selected:', path)
        setSelectedFile(path)
      }}
      selectedPath={selectedFile}
      className="h-96"
    />
  )
}
```

## Props

### `FileTreeProps`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | Yes | Sandbox session identifier for API calls |
| `onSelectFile` | `(path: string) => void` | Yes | Callback when a file is clicked |
| `selectedPath` | `string` | No | Path of currently selected file (for highlighting) |
| `className` | `string` | No | Additional CSS classes for styling |

### `FileNode` Type

```typescript
interface FileNode {
  name: string          // File or directory name (e.g., "package.json")
  path: string          // Absolute path (e.g., "/workspace/package.json")
  type: 'file' | 'directory'
  children?: FileNode[] // Optional pre-loaded children (for directories)
}
```

## API Integration

The component expects a REST API endpoint at `/api/files/list` that returns:

**Request:**
```
GET /api/files/list?session={sessionId}&path={path}
```

**Response:**
```json
{
  "path": "/workspace",
  "entries": [
    { "name": "src", "path": "/workspace/src", "type": "directory" },
    { "name": "package.json", "path": "/workspace/package.json", "type": "file" }
  ]
}
```

## Behavior

### Initial Load
- On mount, fetches root directory (`/workspace`)
- Shows loading spinner while fetching
- Displays error message if fetch fails

### Directory Expansion
- Click folder name or chevron to expand/collapse
- Lazy loads children on first expansion
- Caches loaded children to avoid redundant API calls
- Shows loading spinner while fetching directory contents

### File Selection
- Click file name to trigger `onSelectFile` callback
- Selected file is highlighted with background color
- Selection state controlled via `selectedPath` prop

### Icons
- `Folder` - Collapsed directory
- `FolderOpen` - Expanded directory
- `File` - Regular file
- `ChevronRight` - Collapsed directory indicator
- `ChevronDown` - Expanded directory indicator
- `Loader2` - Loading spinner (animated)

## Styling

The component uses Tailwind CSS classes and supports dark mode:

```tsx
<FileTree
  sessionId={sessionId}
  onSelectFile={handleSelect}
  className="max-h-screen shadow-md rounded-lg"
/>
```

### Key Style Classes
- Container: `border rounded-md bg-white dark:bg-gray-900`
- Items: `hover:bg-gray-100 dark:hover:bg-gray-800`
- Selected: `bg-gray-200 dark:bg-gray-700`
- Icons: Color-coded (blue for folders, gray for files)

## Accessibility

- Uses proper ARIA roles (`tree`, `treeitem`, `group`)
- Keyboard navigable (Tab, Enter, Space)
- `aria-expanded` for directory state
- `aria-selected` for selection state
- Proper focus management

## Error Handling

Errors are displayed inline below the affected directory:

```
📁 src
  ❌ Failed to load directory: Network error
```

## Examples

See `FileTree.example.tsx` for complete usage examples including:
- Basic file tree with selection
- Integration with file viewer
- Custom styling
