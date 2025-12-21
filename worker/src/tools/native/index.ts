/**
 * Native integrations using direct API access
 *
 * These integrations use the native app credentials (GitHub App, Linear OAuth, etc.)
 * stored in the connection's externalRef, rather than going through a third-party
 * integration platform like Composio.
 */

export { GitHub } from './github'
export { Linear } from './linear'

// Placeholder for future native integrations:
// export { Slack } from './slack'
