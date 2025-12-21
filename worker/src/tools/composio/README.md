# Composio SDK Integration

This module provides integration with the Composio SDK for tool normalization and execution.

## Overview

Composio is a third-party tool aggregation service that provides normalized access to hundreds of integrations (GitHub, Linear, Slack, etc.) through a single API. This integration allows our worker to:

1. **Fetch tools** from Composio for connected apps
2. **Normalize tool names** from `SCREAMING_SNAKE_CASE` to our `camelCase` format
3. **Convert schemas** from Composio's format to Zod schemas
4. **Execute tools** through Composio's API

## Architecture

```
composio/
├── client.ts       # Composio client initialization and tool fetching
├── normalize.ts    # Tool name parsing and schema conversion
├── execute.ts      # Tool execution via Composio API
├── index.ts        # Public exports
└── __tests__/      # Comprehensive test suite
```

## Tool Name Normalization

Composio uses `SCREAMING_SNAKE_CASE` for tool names. We normalize them to match our `app.action` format:

| Composio Name | Our Format |
|--------------|-----------|
| `GITHUB_CREATE_ISSUE` | `github.createIssue` |
| `GITHUB_CREATE_PULL_REQUEST` | `github.createPullRequest` |
| `LINEAR_CREATE_ISSUE` | `linear.createIssue` |
| `SLACK_SEND_MESSAGE` | `slack.sendMessage` |

### Known Apps with Special Casing

- `github` → `GitHub`
- `linear` → `Linear`
- `slack` → `Slack`
- `googledrive` → `GoogleDrive`
- `microsoftteams` → `MicrosoftTeams`

## Usage

### Initialize Composio Client

```typescript
import { getComposio } from './composio'

const composio = getComposio(env)
```

### Fetch Tools for Apps

```typescript
import { getComposioTools } from './composio'

const integrations = await getComposioTools(
  env,
  ['github', 'linear'],
  connection
)

// Returns:
// [
//   { name: 'GitHub', tools: [...] },
//   { name: 'Linear', tools: [...] }
// ]
```

### Fetch Tools for a Connection

```typescript
import { getComposioToolsForConnection } from './composio'

const integration = await getComposioToolsForConnection(env, connection)

// Returns single integration for the connection's app
```

### Execute a Tool

```typescript
import { executeComposioTool } from './composio'

const result = await executeComposioTool(
  'GITHUB_CREATE_ISSUE',
  { title: 'Bug report', body: 'Description' },
  connection,
  env
)
```

### Parse Tool Names

```typescript
import { parseComposioToolName } from './composio'

const { app, action } = parseComposioToolName('GITHUB_CREATE_PULL_REQUEST')
// app = 'GitHub'
// action = 'createPullRequest'
```

## Configuration

Add the Composio API key to your environment:

```typescript
// worker/src/types/env.ts
export interface Env {
  COMPOSIO_API_KEY?: string
  // ... other env vars
}
```

Set the secret via wrangler:

```bash
wrangler secret put COMPOSIO_API_KEY
```

## Connection Requirements

For Composio tools to work, the Connection object must include:

- `externalRef.composioEntityId` - The Composio entity ID for this connection
- OR `externalId` - Falls back to this if composioEntityId is not present

Example:

```typescript
const connection: Connection = {
  id: 'conn-123',
  user: 'user-456',
  app: 'GitHub',
  provider: 'composio',
  externalId: 'entity-789',
  externalRef: {
    composioEntityId: 'entity-789'
  },
  status: 'active',
  scopes: ['repo', 'issues']
}
```

## Schema Conversion

Composio's JSON Schema parameters are automatically converted to Zod schemas:

| JSON Schema Type | Zod Type |
|-----------------|----------|
| `string` | `z.string()` |
| `number` / `integer` | `z.number()` |
| `boolean` | `z.boolean()` |
| `array` | `z.array(z.string())` |
| `object` | `z.record(z.any())` |

Required fields are enforced, optional fields are marked with `.optional()`.

## Error Handling

- **Missing API Key**: Throws error if `COMPOSIO_API_KEY` is not set
- **Missing Entity ID**: Throws error if connection lacks `composioEntityId` or `externalId`
- **Tool Fetch Errors**: Logs error and continues with other apps (doesn't throw)
- **Execution Errors**: Re-throws errors from Composio API for proper error propagation

## Testing

Comprehensive test suite covering:

- Client initialization
- Tool fetching and normalization
- Schema conversion and validation
- Tool execution
- Error handling
- Integration scenarios

```bash
pnpm test -- src/tools/composio
```

## Integration with Tool Registry

The Composio integration works alongside our native integrations:

```typescript
import { ToolRegistry } from '../registry'
import { getComposioTools } from './composio'

const registry = new ToolRegistry()

// Add Composio tools
const composioIntegrations = await getComposioTools(env, ['github'], connection)
composioIntegrations.forEach(integration => {
  registry.register(integration)
})
```

## Future Enhancements

- More sophisticated schema conversion (nested objects, unions, etc.)
- Caching of tool definitions to reduce API calls
- Batch tool execution
- Webhook support for async tool execution
- Tool usage analytics
