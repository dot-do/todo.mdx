# Tool Configuration Inheritance

Tool configuration allows fine-grained control over which tools are available at different levels of the hierarchy: organization → repository → project → issue.

## How It Works

Configuration is defined using the `ToolConfig` interface and stored as JSON in Payload collections:

```typescript
interface ToolConfig {
  enabled?: string[]        // Tool names to enable (e.g., ['github.createPullRequest'])
  disabled?: string[]       // Tool names to disable
  includeDefaults?: boolean // Whether to include default tools (default: true)
  requiredApps?: string[]   // Apps that must have active connections (e.g., ['GitHub'])
}
```

## Inheritance Rules

1. **enabled** - Accumulates down the hierarchy (union)
   - Org enables GitHub tools → Repo adds Linear tools → Both are available

2. **disabled** - Overrides at each level
   - Org enables all GitHub tools → Repo disables `github.deleteRepo` → Tool is unavailable

3. **requiredApps** - Accumulates down the hierarchy (union)
   - Org requires GitHub → Issue requires Linear → Both apps must be connected

4. **includeDefaults** - Defaults to `true`, can be overridden
   - If any level sets `includeDefaults: true`, defaults are included
   - Can still disable specific defaults using `disabled` array

## Example Usage

### Organization Level (Installation)

Configure tools for all repos in the organization:

```json
{
  "enabled": ["github.createPullRequest", "github.createIssue", "slack.sendMessage"],
  "requiredApps": ["GitHub"],
  "includeDefaults": true
}
```

### Repository Level

Override or extend org-level config:

```json
{
  "enabled": ["linear.createIssue"],
  "disabled": ["slack.sendMessage"],
  "requiredApps": ["Linear"]
}
```

### Issue Level

Further customize for specific issues:

```json
{
  "disabled": ["github.createPullRequest"],
  "requiredApps": ["Linear", "Notion"]
}
```

### Resolved Result

When resolving the above hierarchy:

```typescript
const resolved = resolveToolConfig([orgConfig, repoConfig, issueConfig], connections)

// Result:
// {
//   enabled: ['github.createIssue', 'linear.createIssue', ...defaults],
//   required: ['GitHub', 'Linear', 'Notion'],
//   connections: [...active connections only...]
// }
```

## Code Example

```typescript
import { resolveToolConfig, validateRequiredApps } from './config'

// Get configs from Payload
const installation = await payload.findByID({ collection: 'installations', id: installationId })
const repo = await payload.findByID({ collection: 'repos', id: repoId })
const issue = await payload.findByID({ collection: 'issues', id: issueId })

// Get user's active connections
const connections = await payload.find({
  collection: 'connections',
  where: {
    user: { equals: userId },
    status: { equals: 'active' }
  }
})

// Resolve the hierarchy
const resolved = resolveToolConfig(
  [
    installation.toolConfig || {},
    repo.toolConfig || {},
    issue.toolConfig || {}
  ],
  connections.docs,
  defaultToolNames
)

// Validate required apps
const validation = validateRequiredApps(resolved)
if (!validation.valid) {
  throw new Error(`Missing required apps: ${validation.missingApps.join(', ')}`)
}

// Get only tools with active connections
const availableTools = getAvailableTools(resolved)
```

## Best Practices

1. **Set defaults at the org level** - Define common tools all repos should have
2. **Disable dangerous tools** - Use `disabled` to block destructive operations
3. **Require critical apps** - Use `requiredApps` to ensure agents can't start without necessary connections
4. **Keep issue configs minimal** - Only override when truly necessary for a specific issue

## Integration with MCP

When an MCP session starts for an issue, the tool configuration determines:

1. Which tools are exposed to the AI agent
2. Which apps must have valid OAuth connections
3. Whether the agent can proceed without certain apps

This ensures agents always have the right tools for the job while preventing unauthorized actions.
