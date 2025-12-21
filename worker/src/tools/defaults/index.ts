export { Browser } from './browser'
export { Code } from './code'
export { Search } from './search'
export { File } from './file'

import { Browser } from './browser'
import { Code } from './code'
import { Search } from './search'
import { File } from './file'
import type { Integration } from '../types'

/**
 * All default integrations that require no authentication
 */
export const defaultIntegrations: Integration[] = [
  Browser,
  Code,
  Search,
  File
]
