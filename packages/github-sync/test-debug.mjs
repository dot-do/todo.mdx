import { parseIssueBody } from './src/parser.ts'

const customConventions = {
  labels: {
    type: {
      'defect': 'bug',
      'story': 'feature',
    },
    priority: {
      'critical': 0,
      'high': 1,
      'medium': 2,
      'low': 3,
    },
    status: {
      inProgress: 'doing',
    },
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

const body = 'Custom conventions test.\n\nRequires: #111\nBlocked by this: #222\nEpic: #333'

const result = parseIssueBody(body, customConventions)
console.log('dependsOn:', result.dependsOn)
console.log('blocks:', result.blocks)
console.log('parent:', result.parent)
