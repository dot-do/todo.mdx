import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { CloudflareContext, getCloudflareContext } from '@opennextjs/cloudflare'
import { GetPlatformProxyOptions } from 'wrangler'
import { r2Storage } from '@payloadcms/storage-r2'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Installations } from './collections/Installations'
import { Repos } from './collections/Repos'
import { Issues } from './collections/Issues'
import { SyncEvents } from './collections/SyncEvents'
import { LinearIntegrations } from './collections/LinearIntegrations'
import { Agents } from './collections/Agents'
import { DurableObjects } from './collections/DurableObjects'
import { Connections } from './collections/Connections'
import { ToolExecutions } from './collections/ToolExecutions'
import { Models } from './collections/Models'
import { ModelDefaults } from './collections/ModelDefaults'
import { AuditLogs } from './collections/AuditLogs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const isCLI = process.argv.some((value) => value.match(/^(generate|migrate):?/))
const isProduction = process.env.NODE_ENV === 'production'

const cloudflare =
  isCLI || !isProduction
    ? await getCloudflareContextFromWrangler()
    : await getCloudflareContext({ async: true })

const secret = process.env.PAYLOAD_SECRET
if (!secret) {
  throw new Error('PAYLOAD_SECRET environment variable is required')
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Installations, Repos, Issues, SyncEvents, LinearIntegrations, Agents, DurableObjects, Connections, ToolExecutions, Models, ModelDefaults, AuditLogs],
  editor: lexicalEditor(),
  secret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteD1Adapter({ binding: cloudflare.env.D1 }),
  plugins: [
    r2Storage({
      bucket: cloudflare.env.R2,
      collections: { media: true },
    }),
  ],
  // Server URL for production - used for CSRF protection baseline
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://admin.todo.mdx.do',
  // CSRF protection - whitelist trusted domains for cookie-based authentication
  csrf: [
    'https://todo.mdx.do',
    'https://priya.do',
    'https://admin.todo.mdx.do',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
  ],
  // CORS configuration - allow requests from trusted origins
  cors: [
    'https://todo.mdx.do',
    'https://priya.do',
    'https://admin.todo.mdx.do',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
  ],
})

// Adapted from https://github.com/opennextjs/opennextjs-cloudflare/blob/d00b3a13e42e65aad76fba41774815726422cc39/packages/cloudflare/src/api/cloudflare-context.ts#L328C36-L328C46
function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  return import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(
    ({ getPlatformProxy }) =>
      getPlatformProxy({
        environment: process.env.CLOUDFLARE_ENV,
        remoteBindings: isProduction,
      } satisfies GetPlatformProxyOptions),
  )
}
