import { test } from 'vitest'
import { parseIssueBody } from './src/parser'

const customConventions = {
  labels: {
    type: {},
    priority: {},
    status: {},
  },
  dependencies: {
    pattern: 'Requires:\\s*(.+)',
    separator: ', ',
    blocksPattern: 'Blocked by this:\\s*(.+)',
  },
  epics: {
    bodyPattern: 'Epic:\\s*#(\\d+)',
  },
}

test('parse custom body', () => {
  const body = 'Custom conventions test.\n\nRequires: #111\nBlocked by this: #222\nEpic: #333'
  const result = parseIssueBody(body, customConventions)
  console.log('Parser result:', JSON.stringify(result, null, 2))
})
