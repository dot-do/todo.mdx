export { Dashboard } from './dashboard'
export { DashboardLayout } from './layout'
export { DashboardNav } from './nav'
export { DashboardSidebar } from './sidebar'
export { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from './card'
export { Button } from './button'
export { Terminal } from './Terminal'
export { SandboxEditor } from './Editor'
export { FileTree } from './FileTree'

// Project visualization components
export { ViewSwitcher } from './view-switcher'
export { FilterBar, defaultFilterState } from './filter-bar'
export { StatsCards } from './stats-cards'
export { IssueList } from './issue-list'
export { ProjectsView } from './projects'

export type { DashboardProps } from './dashboard'
export type { DashboardLayoutProps } from './layout'
export type { DashboardNavProps } from './nav'
export type { DashboardSidebarProps, NavItem } from './sidebar'
export type { TerminalProps, WebSocketMessage, ClientMessage } from './Terminal'
export type { SandboxEditorProps } from './Editor'
export type { FileTreeProps, FileNode } from './FileTree'

// Project visualization types
export type { ViewType } from './view-switcher'
export type { IssueStatus, IssuePriority, IssueType } from './filter-bar'
export type { Issue } from './issue-list'
