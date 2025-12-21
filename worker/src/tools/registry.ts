import type { Integration, Tool } from './types'

export class ToolRegistry {
  private integrations: Map<string, Integration> = new Map()

  register(integration: Integration): void {
    this.integrations.set(integration.name, integration)
  }

  get(name: string): Integration | undefined {
    return this.integrations.get(name)
  }

  getAll(): Integration[] {
    return Array.from(this.integrations.values())
  }

  getTool(fullName: string): Tool | undefined {
    // Parse 'github.createPullRequest' to find the tool
    const dotIndex = fullName.indexOf('.')
    if (dotIndex === -1) {
      return undefined
    }

    // Search all integrations for a tool with this fullName
    for (const integration of this.integrations.values()) {
      const tool = integration.tools.find(t => t.fullName === fullName)
      if (tool) {
        return tool
      }
    }

    return undefined
  }

  getToolsForApps(apps: string[]): Tool[] {
    const tools: Tool[] = []

    for (const app of apps) {
      const integration = this.integrations.get(app)
      if (integration) {
        tools.push(...integration.tools)
      }
    }

    return tools
  }
}
