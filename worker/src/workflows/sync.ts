/**
 * Beads Sync Workflow
 *
 * Durable Cloudflare Workflow that syncs all beads issues to GitHub.
 * Triggered on GitHub App installation or manual API call.
 *
 * Flow:
 * 1. Fetch .beads/issues.jsonl from repo
 * 2. Import to RepoDO
 * 3. For each issue without github_number:
 *    - Create GitHub issue
 *    - Update DO with github_number
 *    - Sleep 500ms (rate limit)
 * 4. Commit updated JSONL to repo
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers'
import { SignJWT, importPKCS8 } from 'jose'

// ============================================================================
// Workflow Payload
// ============================================================================

export interface BeadsSyncPayload {
  /** Full repo name (owner/name) */
  repoFullName: string

  /** GitHub App installation ID */
  installationId: number
}

// ============================================================================
// Workflow Environment
// ============================================================================

interface WorkflowEnv {
  REPO: DurableObjectNamespace
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
}

// ============================================================================
// Beads Issue Type (from JSONL)
// ============================================================================

interface BeadsIssue {
  id: string
  title: string
  description?: string
  status: string
  priority?: number
  issue_type?: string
  assignee?: string
  created_at: string
  updated_at: string
  closed_at?: string
  labels?: string[]
}

// ============================================================================
// GitHub API Helpers
// ============================================================================

function convertPkcs1ToPkcs8(pkcs1Pem: string): string {
  if (pkcs1Pem.includes('-----BEGIN PRIVATE KEY-----')) {
    return pkcs1Pem
  }

  const pkcs1Base64 = pkcs1Pem
    .replace('-----BEGIN RSA PRIVATE KEY-----', '')
    .replace('-----END RSA PRIVATE KEY-----', '')
    .replace(/[\s\n\r]/g, '')

  const pkcs1Binary = Uint8Array.from(atob(pkcs1Base64), (c) => c.charCodeAt(0))

  const rsaAlgorithmId = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ])

  const version = new Uint8Array([0x02, 0x01, 0x00])

  const pkcs1Len = pkcs1Binary.length
  let octetStringHeader: Uint8Array
  if (pkcs1Len < 128) {
    octetStringHeader = new Uint8Array([0x04, pkcs1Len])
  } else if (pkcs1Len < 256) {
    octetStringHeader = new Uint8Array([0x04, 0x81, pkcs1Len])
  } else {
    octetStringHeader = new Uint8Array([0x04, 0x82, (pkcs1Len >> 8) & 0xff, pkcs1Len & 0xff])
  }

  const innerLen = version.length + rsaAlgorithmId.length + octetStringHeader.length + pkcs1Binary.length
  let sequenceHeader: Uint8Array
  if (innerLen < 128) {
    sequenceHeader = new Uint8Array([0x30, innerLen])
  } else if (innerLen < 256) {
    sequenceHeader = new Uint8Array([0x30, 0x81, innerLen])
  } else {
    sequenceHeader = new Uint8Array([0x30, 0x82, (innerLen >> 8) & 0xff, innerLen & 0xff])
  }

  const pkcs8Binary = new Uint8Array(
    sequenceHeader.length + version.length + rsaAlgorithmId.length + octetStringHeader.length + pkcs1Binary.length
  )
  let offset = 0
  pkcs8Binary.set(sequenceHeader, offset)
  offset += sequenceHeader.length
  pkcs8Binary.set(version, offset)
  offset += version.length
  pkcs8Binary.set(rsaAlgorithmId, offset)
  offset += rsaAlgorithmId.length
  pkcs8Binary.set(octetStringHeader, offset)
  offset += octetStringHeader.length
  pkcs8Binary.set(pkcs1Binary, offset)

  const base64 = btoa(String.fromCharCode(...pkcs8Binary))
  const lines = base64.match(/.{1,64}/g) || []

  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`
}

async function generateGitHubAppJWT(appId: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  let privateKeyPEM = privateKey

  if (!privateKeyPEM.includes('-----BEGIN')) {
    try {
      privateKeyPEM = atob(privateKeyPEM)
    } catch {
      // Not base64, use as-is
    }
  }
  privateKeyPEM = privateKeyPEM.replace(/\\n/g, '\n')
  privateKeyPEM = convertPkcs1ToPkcs8(privateKeyPEM)

  const key = await importPKCS8(privateKeyPEM, 'RS256')

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .setIssuer(appId)
    .sign(key)
}

async function getInstallationToken(
  appId: string,
  privateKey: string,
  installationId: number
): Promise<string> {
  const jwt = await generateGitHubAppJWT(appId, privateKey)

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'todo.mdx-worker',
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get installation token: ${response.status} ${error}`)
  }

  const data = (await response.json()) as { token: string }
  return data.token
}

// ============================================================================
// Beads Sync Workflow
// ============================================================================

export class BeadsSyncWorkflow extends WorkflowEntrypoint<WorkflowEnv, BeadsSyncPayload> {
  async run(event: WorkflowEvent<BeadsSyncPayload>, step: WorkflowStep): Promise<{
    synced: number
    failed: number
    total: number
  }> {
    const { repoFullName, installationId } = event.payload

    console.log(`[BeadsSyncWorkflow] Starting sync for ${repoFullName}`)

    // Step 1: Fetch JSONL from repo
    const jsonl = await step.do('fetch-jsonl', async () => {
      const token = await getInstallationToken(
        this.env.GITHUB_APP_ID,
        this.env.GITHUB_PRIVATE_KEY,
        installationId
      )

      const url = `https://api.github.com/repos/${repoFullName}/contents/.beads/issues.jsonl`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'todo.mdx-worker',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return '' // No beads file, nothing to sync
        }
        const error = await response.text()
        throw new Error(`Failed to fetch JSONL: ${response.status} ${error}`)
      }

      const data = (await response.json()) as { content: string; encoding: string }
      if (data.encoding === 'base64') {
        return atob(data.content.replace(/\n/g, ''))
      }
      return data.content
    })

    if (!jsonl) {
      console.log('[BeadsSyncWorkflow] No beads file found, nothing to sync')
      return { synced: 0, failed: 0, total: 0 }
    }

    // Step 2: Parse issues
    const issues = await step.do('parse-issues', () => {
      const lines = jsonl.trim().split('\n').filter(Boolean)
      return lines.map((line) => JSON.parse(line) as BeadsIssue)
    })

    console.log(`[BeadsSyncWorkflow] Found ${issues.length} issues`)

    // Step 3: Import to RepoDO and get unsynced issues
    const unsynced = await step.do('import-to-do', async () => {
      const doId = this.env.REPO.idFromName(repoFullName)
      const stub = this.env.REPO.get(doId)

      // Set context
      await stub.fetch(
        new Request('http://do/context', {
          method: 'POST',
          body: JSON.stringify({ repoFullName, installationId }),
        })
      )

      // Import JSONL
      await stub.fetch(
        new Request('http://do/import', {
          method: 'POST',
          body: jsonl,
        })
      )

      // Get status to find unsynced count
      const statusResponse = await stub.fetch(new Request('http://do/status'))
      const status = (await statusResponse.json()) as { unsyncedCount: number }

      return status.unsyncedCount
    })

    console.log(`[BeadsSyncWorkflow] ${unsynced} issues need GitHub sync`)

    if (unsynced === 0) {
      return { synced: 0, failed: 0, total: issues.length }
    }

    // Step 4: Trigger bulk sync on RepoDO (it handles individual issue creation)
    const result = await step.do('bulk-sync', async () => {
      const doId = this.env.REPO.idFromName(repoFullName)
      const stub = this.env.REPO.get(doId)

      // Sync in batches to avoid timeout
      let totalSynced = 0
      let totalFailed = 0
      let remaining = unsynced

      while (remaining > 0) {
        const response = await stub.fetch(
          new Request('http://do/sync/bulk?limit=25', { method: 'POST' })
        )
        const batch = (await response.json()) as { synced: number; failed: number; total: number }

        totalSynced += batch.synced
        totalFailed += batch.failed
        remaining -= batch.total

        console.log(`[BeadsSyncWorkflow] Batch complete: ${batch.synced} synced, ${batch.failed} failed, ${remaining} remaining`)

        // Sleep between batches to avoid rate limits
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, 2000))
        }
      }

      return { synced: totalSynced, failed: totalFailed }
    })

    console.log(`[BeadsSyncWorkflow] Sync complete: ${result.synced} synced, ${result.failed} failed`)

    return {
      synced: result.synced,
      failed: result.failed,
      total: issues.length,
    }
  }
}
