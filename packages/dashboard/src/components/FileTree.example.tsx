import * as React from 'react'
import { FileTree } from './FileTree'

/**
 * Example usage of FileTree component for sandbox file navigation
 */
export function FileTreeExample() {
  const [selectedPath, setSelectedPath] = React.useState<string>()
  const sessionId = 'example-session-id' // Replace with actual session ID

  return (
    <div className="h-screen flex flex-col p-4">
      <h1 className="text-2xl font-bold mb-4">File Tree Example</h1>

      <div className="flex-1 flex gap-4">
        {/* File tree in left sidebar */}
        <div className="w-64 flex-shrink-0">
          <FileTree
            sessionId={sessionId}
            onSelectFile={(path) => {
              console.log('Selected file:', path)
              setSelectedPath(path)
            }}
            selectedPath={selectedPath}
            className="h-full"
          />
        </div>

        {/* File content area */}
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-md p-4">
          {selectedPath ? (
            <div>
              <h2 className="text-lg font-semibold mb-2">Selected File</h2>
              <code className="text-sm text-gray-600 dark:text-gray-400">
                {selectedPath}
              </code>
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400">
              Select a file to view
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Example with custom styling
 */
export function StyledFileTreeExample() {
  const [selectedPath, setSelectedPath] = React.useState<string>()
  const sessionId = 'example-session-id'

  return (
    <FileTree
      sessionId={sessionId}
      onSelectFile={setSelectedPath}
      selectedPath={selectedPath}
      className="max-h-96 shadow-lg"
    />
  )
}
