# SandboxEditor Component

Monaco-based code editor integrated with the sandbox file system.

## Features

- **Monaco Editor** - Full-featured code editor from VS Code
- **Dark Theme** - Uses the `vs-dark` theme
- **Language Detection** - Automatic language detection from file extension
- **Keyboard Shortcuts** - Cmd+S / Ctrl+S to save files
- **Dirty Indicator** - Shows when content has been modified
- **Auto Layout** - Automatically resizes with container
- **Error Handling** - Displays save errors in status bar
- **API Integration** - Saves files via `/api/files/write` endpoint

## Installation

The Monaco editor is already installed in the `@todo.mdx/dashboard` package:

```bash
pnpm add @monaco-editor/react monaco-editor
```

## Usage

### Basic Usage

```tsx
import { SandboxEditor } from '@todo.mdx/dashboard/components'

export function MyEditor() {
  return (
    <div style={{ height: '600px' }}>
      <SandboxEditor
        sessionId="my-session-123"
        file={{
          path: 'src/example.ts',
          content: 'console.log("Hello, World!")',
        }}
      />
    </div>
  )
}
```

### With Callbacks

```tsx
import { SandboxEditor } from '@todo.mdx/dashboard/components'

export function MyEditor() {
  return (
    <SandboxEditor
      sessionId="my-session"
      file={{
        path: 'README.md',
        content: '# Hello\n\nMarkdown content here',
      }}
      onSave={() => {
        console.log('File saved successfully!')
      }}
      onChange={(content) => {
        console.log('Content changed:', content.length, 'characters')
      }}
      className="my-custom-editor"
    />
  )
}
```

## Props

```typescript
interface SandboxEditorProps {
  sessionId: string
  file: {
    path: string
    content: string
  }
  onSave?: () => void
  onChange?: (content: string) => void
  className?: string
}
```

### `sessionId`
- **Type:** `string`
- **Required:** Yes
- **Description:** The sandbox session ID used for API requests

### `file`
- **Type:** `{ path: string, content: string }`
- **Required:** Yes
- **Description:** The file to edit with its path and initial content

### `onSave`
- **Type:** `() => void`
- **Required:** No
- **Description:** Callback fired after successful save

### `onChange`
- **Type:** `(content: string) => void`
- **Required:** No
- **Description:** Callback fired when editor content changes

### `className`
- **Type:** `string`
- **Required:** No
- **Description:** Additional CSS class for the editor container

## Supported Languages

The editor automatically detects the language from the file extension:

| Extension | Language |
|-----------|----------|
| `.ts`, `.tsx` | TypeScript |
| `.js`, `.jsx` | JavaScript |
| `.py` | Python |
| `.rs` | Rust |
| `.go` | Go |
| `.md` | Markdown |
| `.json` | JSON |
| `.yaml`, `.yml` | YAML |
| `.css` | CSS |
| `.html` | HTML |
| `.sql` | SQL |

Unknown extensions default to `plaintext`.

## Keyboard Shortcuts

- **Cmd+S / Ctrl+S** - Save file to sandbox
- **All Monaco shortcuts** - Full VS Code keyboard shortcuts are available

## API Integration

The component saves files by making a POST request to:

```
POST /api/files/write?session={sessionId}
Content-Type: application/json

{
  "path": "/path/to/file",
  "content": "file contents"
}
```

Expected response on success:
```json
{
  "success": true
}
```

Expected response on error:
```json
{
  "error": "Error message"
}
```

## Status Bar

The editor includes a status bar showing:

- File path
- Modified indicator (orange dot when dirty)
- Saving indicator (blue "Saving...")
- Error messages (red text)
- Current language
- Save shortcut hint

## Editor Options

The Monaco editor is configured with:

```typescript
{
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
}
```

## Container Requirements

The editor uses `position: absolute` internally, so the parent container must:

1. Have a defined height (e.g., `height: 600px` or `flex: 1`)
2. Have `position: relative` if you want to control positioning

Example:

```tsx
<div style={{ height: '100vh', position: 'relative' }}>
  <SandboxEditor {...props} />
</div>
```

## Examples

See `Editor.example.tsx` for complete working examples including:
- Basic single-file editor
- Multi-file editor with tabs
- Integration with file trees

## Error Handling

Save errors are displayed in the status bar and logged to console. The component handles:

- Network failures
- HTTP errors (4xx, 5xx)
- API errors (invalid JSON responses)
- Unknown errors

## Performance

The editor includes optimizations:

- Automatic layout on window resize
- Debounced onChange callbacks (handled by Monaco)
- Efficient dirty state tracking
- Prevents concurrent saves

## Accessibility

The Monaco editor includes built-in accessibility features:
- Full keyboard navigation
- Screen reader support
- High contrast themes available
- Configurable font sizes

## Browser Support

Supports all modern browsers that Monaco supports:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Related Components

- `Terminal` - Terminal component for command execution
- `FileTree` - File tree navigation component

## Future Enhancements

Potential improvements:
- Auto-save on idle
- Multiple cursors
- Find/replace UI
- Diff viewer
- Read-only mode
- Custom themes
