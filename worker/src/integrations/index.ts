/**
 * External Integrations
 *
 * Provides integration with external services:
 * - Linear (bidirectional issue sync)
 * - Slack (notifications)
 * - Discord (notifications)
 */

// ============================================================================
// Linear Integration
// ============================================================================

export interface LinearIssue {
  id: string
  identifier: string
  title: string
  description?: string
  priority: number
  state: { name: string; type: string }
  labels?: Array<{ name: string }>
  assignee?: { email: string }
}

export interface LinearConfig {
  apiKey: string
  teamId?: string
}

export class LinearIntegration {
  private apiKey: string
  private baseUrl = 'https://api.linear.app/graphql'

  constructor(config: LinearConfig) {
    this.apiKey = config.apiKey
  }

  /**
   * Create an issue in Linear
   */
  async createIssue(params: {
    teamId: string
    title: string
    description?: string
    priority?: number
    labelIds?: string[]
    assigneeId?: string
  }): Promise<LinearIssue> {
    const response = await this.query(`
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            priority
            state { name type }
            labels { nodes { name } }
            assignee { email }
          }
        }
      }
    `, {
      input: {
        teamId: params.teamId,
        title: params.title,
        description: params.description,
        priority: params.priority,
        labelIds: params.labelIds,
        assigneeId: params.assigneeId,
      },
    })

    return response.issueCreate.issue
  }

  /**
   * Update an issue in Linear
   */
  async updateIssue(issueId: string, params: {
    title?: string
    description?: string
    priority?: number
    stateId?: string
    labelIds?: string[]
    assigneeId?: string
  }): Promise<LinearIssue> {
    const response = await this.query(`
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            priority
            state { name type }
            labels { nodes { name } }
            assignee { email }
          }
        }
      }
    `, { id: issueId, input: params })

    return response.issueUpdate.issue
  }

  /**
   * Add a comment to a Linear issue
   */
  async addComment(issueId: string, body: string): Promise<{ id: string }> {
    const response = await this.query(`
      mutation CreateComment($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
          comment { id }
        }
      }
    `, {
      input: { issueId, body },
    })

    return response.commentCreate.comment
  }

  /**
   * Get issue by identifier (e.g., "ENG-123")
   */
  async getIssue(identifier: string): Promise<LinearIssue | null> {
    const response = await this.query(`
      query Issue($identifier: String!) {
        issue(id: $identifier) {
          id
          identifier
          title
          description
          priority
          state { name type }
          labels { nodes { name } }
          assignee { email }
        }
      }
    `, { identifier })

    return response.issue
  }

  private async query(query: string, variables?: Record<string, any>): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    })

    const result = await response.json() as { data?: any; errors?: any[] }

    if (result.errors) {
      throw new Error(`Linear API error: ${JSON.stringify(result.errors)}`)
    }

    return result.data
  }
}

// ============================================================================
// Slack Integration
// ============================================================================

export interface SlackConfig {
  webhookUrl: string
}

export interface SlackMessage {
  channel?: string
  text: string
  blocks?: SlackBlock[]
  attachments?: SlackAttachment[]
}

export interface SlackBlock {
  type: 'section' | 'divider' | 'header' | 'context' | 'actions'
  text?: { type: 'mrkdwn' | 'plain_text'; text: string }
  fields?: Array<{ type: 'mrkdwn' | 'plain_text'; text: string }>
  accessory?: any
  elements?: any[]
}

export interface SlackAttachment {
  color?: string
  title?: string
  title_link?: string
  text?: string
  fields?: Array<{ title: string; value: string; short?: boolean }>
}

export class SlackIntegration {
  private webhookUrl: string

  constructor(config: SlackConfig) {
    this.webhookUrl = config.webhookUrl
  }

  /**
   * Send a message to Slack
   */
  async sendMessage(message: SlackMessage): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${await response.text()}`)
    }
  }

  /**
   * Send a notification about an issue
   */
  async notifyIssue(params: {
    action: 'created' | 'updated' | 'closed' | 'ready'
    issue: { id: string; title: string; url?: string }
    repo: { owner: string; name: string }
    channel?: string
  }): Promise<void> {
    const emoji = {
      created: '🆕',
      updated: '✏️',
      closed: '✅',
      ready: '🚀',
    }[params.action]

    await this.sendMessage({
      channel: params.channel,
      text: `${emoji} Issue ${params.action}: ${params.issue.title}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${emoji} Issue ${params.action}*\n<${params.issue.url || '#'}|${params.issue.id}: ${params.issue.title}>`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Repository: ${params.repo.owner}/${params.repo.name}`,
            },
          ],
        },
      ],
    })
  }

  /**
   * Send a notification about a PR
   */
  async notifyPR(params: {
    action: 'opened' | 'approved' | 'merged' | 'closed' | 'review_requested'
    pr: { number: number; title: string; url: string }
    repo: { owner: string; name: string }
    channel?: string
  }): Promise<void> {
    const emoji = {
      opened: '📝',
      approved: '✅',
      merged: '🎉',
      closed: '❌',
      review_requested: '👀',
    }[params.action]

    await this.sendMessage({
      channel: params.channel,
      text: `${emoji} PR ${params.action}: ${params.pr.title}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${emoji} PR ${params.action}*\n<${params.pr.url}|#${params.pr.number}: ${params.pr.title}>`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Repository: ${params.repo.owner}/${params.repo.name}`,
            },
          ],
        },
      ],
    })
  }
}

// ============================================================================
// Discord Integration
// ============================================================================

export interface DiscordConfig {
  webhookUrl: string
}

export interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string }
  timestamp?: string
}

export class DiscordIntegration {
  private webhookUrl: string

  constructor(config: DiscordConfig) {
    this.webhookUrl = config.webhookUrl
  }

  /**
   * Send a message to Discord
   */
  async sendMessage(content: string, embeds?: DiscordEmbed[]): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, embeds }),
    })

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${await response.text()}`)
    }
  }

  /**
   * Send a notification about an issue
   */
  async notifyIssue(params: {
    action: 'created' | 'updated' | 'closed' | 'ready'
    issue: { id: string; title: string; url?: string }
    repo: { owner: string; name: string }
  }): Promise<void> {
    const colors = {
      created: 0x3498db, // Blue
      updated: 0xf1c40f, // Yellow
      closed: 0x2ecc71, // Green
      ready: 0x9b59b6, // Purple
    }

    await this.sendMessage('', [{
      title: `Issue ${params.action}: ${params.issue.title}`,
      url: params.issue.url,
      color: colors[params.action],
      fields: [
        { name: 'Issue', value: params.issue.id, inline: true },
        { name: 'Repository', value: `${params.repo.owner}/${params.repo.name}`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    }])
  }

  /**
   * Send a notification about a PR
   */
  async notifyPR(params: {
    action: 'opened' | 'approved' | 'merged' | 'closed' | 'review_requested'
    pr: { number: number; title: string; url: string }
    repo: { owner: string; name: string }
  }): Promise<void> {
    const colors = {
      opened: 0x3498db,
      approved: 0x2ecc71,
      merged: 0x9b59b6,
      closed: 0xe74c3c,
      review_requested: 0xf1c40f,
    }

    await this.sendMessage('', [{
      title: `PR ${params.action}: ${params.pr.title}`,
      url: params.pr.url,
      color: colors[params.action],
      fields: [
        { name: 'PR', value: `#${params.pr.number}`, inline: true },
        { name: 'Repository', value: `${params.repo.owner}/${params.repo.name}`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    }])
  }
}

// ============================================================================
// Integration Manager
// ============================================================================

export interface IntegrationConfig {
  linear?: LinearConfig
  slack?: SlackConfig
  discord?: DiscordConfig
}

export class IntegrationManager {
  private linear?: LinearIntegration
  private slack?: SlackIntegration
  private discord?: DiscordIntegration

  constructor(config: IntegrationConfig) {
    if (config.linear) {
      this.linear = new LinearIntegration(config.linear)
    }
    if (config.slack) {
      this.slack = new SlackIntegration(config.slack)
    }
    if (config.discord) {
      this.discord = new DiscordIntegration(config.discord)
    }
  }

  getLinear(): LinearIntegration | undefined {
    return this.linear
  }

  getSlack(): SlackIntegration | undefined {
    return this.slack
  }

  getDiscord(): DiscordIntegration | undefined {
    return this.discord
  }

  /**
   * Notify all configured channels about an issue event
   */
  async notifyIssue(params: {
    action: 'created' | 'updated' | 'closed' | 'ready'
    issue: { id: string; title: string; url?: string }
    repo: { owner: string; name: string }
  }): Promise<void> {
    const promises: Promise<void>[] = []

    if (this.slack) {
      promises.push(this.slack.notifyIssue(params).catch(e => {
        console.error('[IntegrationManager] Slack notification failed:', e)
      }))
    }

    if (this.discord) {
      promises.push(this.discord.notifyIssue(params).catch(e => {
        console.error('[IntegrationManager] Discord notification failed:', e)
      }))
    }

    await Promise.all(promises)
  }

  /**
   * Notify all configured channels about a PR event
   */
  async notifyPR(params: {
    action: 'opened' | 'approved' | 'merged' | 'closed' | 'review_requested'
    pr: { number: number; title: string; url: string }
    repo: { owner: string; name: string }
  }): Promise<void> {
    const promises: Promise<void>[] = []

    if (this.slack) {
      promises.push(this.slack.notifyPR(params).catch(e => {
        console.error('[IntegrationManager] Slack notification failed:', e)
      }))
    }

    if (this.discord) {
      promises.push(this.discord.notifyPR(params).catch(e => {
        console.error('[IntegrationManager] Discord notification failed:', e)
      }))
    }

    await Promise.all(promises)
  }
}
