/**
 * roadmap.mdx - Sync ROADMAP.mdx with GitHub Milestones, Projects, and beads epics
 */

// Types
export type {
  Milestone,
  Epic,
  Project,
  ProjectField,
  ProjectItem,
  RoadmapConfig,
  ParsedRoadmapFile,
  SyncSource,
  SyncResult,
  Component,
  ComponentProps,
  ComponentRenderer,
} from './types.js'

// Markdown utilities
export { toMarkdown, fromMarkdown } from '@mdxld/markdown'

// Component registry
export {
  registerComponent,
  getComponent,
  listComponents,
  hasComponent,
  unregisterComponent,
  setData,
} from './components/index.js'

// Parser
export {
  parseRoadmapFile,
  extractTasks,
  calculateProgress,
} from './parser.js'

// Compilation & Rendering
export {
  compile,
  render,
  generateRoadmapFiles,
  renderRoadmap,
} from './compiler.js'
