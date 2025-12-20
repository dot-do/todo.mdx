'use client'

import { useState } from 'react'
import { SandboxEditor } from './Editor'

/**
 * Example usage of the SandboxEditor component
 */
export function SandboxEditorExample() {
  const [content, setContent] = useState('')

  return (
    <div style={{ height: '600px', border: '1px solid #333' }}>
      <SandboxEditor
        sessionId="example-session-123"
        file={{
          path: 'src/example.ts',
          content: `// Example TypeScript file
function greet(name: string): string {
  return \`Hello, \${name}!\`
}

const message = greet('World')
console.log(message)
`,
        }}
        onSave={() => {
          console.log('File saved!')
        }}
        onChange={(newContent) => {
          setContent(newContent)
          console.log('Content changed:', newContent.length, 'characters')
        }}
        className="my-editor"
      />
    </div>
  )
}

/**
 * Example with multiple file switching
 */
export function MultiFileEditorExample() {
  const [currentFile, setCurrentFile] = useState({
    path: 'README.md',
    content: '# Example Project\n\nThis is a markdown file.\n',
  })

  const files = [
    {
      path: 'README.md',
      content: '# Example Project\n\nThis is a markdown file.\n',
    },
    {
      path: 'src/index.ts',
      content: 'console.log("Hello from TypeScript")\n',
    },
    {
      path: 'package.json',
      content: JSON.stringify({ name: 'example', version: '1.0.0' }, null, 2),
    },
  ]

  return (
    <div>
      {/* File tabs */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px', background: '#252526' }}>
        {files.map((file) => (
          <button
            key={file.path}
            onClick={() => setCurrentFile(file)}
            style={{
              padding: '6px 12px',
              background: currentFile.path === file.path ? '#1e1e1e' : '#2d2d2d',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {file.path.split('/').pop()}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div style={{ height: '500px' }}>
        <SandboxEditor
          sessionId="multi-file-session"
          file={currentFile}
          onSave={() => {
            console.log('Saved:', currentFile.path)
          }}
        />
      </div>
    </div>
  )
}
