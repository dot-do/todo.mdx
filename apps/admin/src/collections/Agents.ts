import type { CollectionConfig } from 'payload'
import { encrypt, decrypt, isEncrypted } from '../lib/encryption'

/**
 * Agents collection for autonomous code review system.
 * Stores agent personas (Priya, Quinn, Sam) with encrypted GitHub PATs.
 */
export const Agents: CollectionConfig = {
  slug: 'agents',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'githubUsername', 'canEscalate', 'createdAt'],
    group: 'System',
  },
  access: {
    // All authenticated users can read agents (to see who can review)
    read: ({ req: { user } }) => !!user,
    // Only admins can create/update/delete agents
    create: ({ req: { user } }) => user?.roles?.includes('admin'),
    update: ({ req: { user } }) => user?.roles?.includes('admin'),
    delete: ({ req: { user } }) => user?.roles?.includes('admin'),
  },
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // Encrypt PAT before saving (only if not already encrypted)
        if (data.pat && req.payload.secret && !isEncrypted(data.pat)) {
          data.pat = await encrypt(data.pat, req.payload.secret)
        }
        return data
      },
    ],
    afterRead: [
      async ({ doc, req }) => {
        // Decrypt PAT after reading (only for admins)
        // For non-admins, mask the PAT completely
        if (doc.pat) {
          if (req.user?.roles?.includes('admin') && req.payload.secret && isEncrypted(doc.pat)) {
            try {
              doc.pat = await decrypt(doc.pat, req.payload.secret)
            } catch (error) {
              console.error('Failed to decrypt agent PAT:', error)
              doc.pat = '***decryption-failed***'
            }
          } else if (!req.user?.roles?.includes('admin')) {
            // Non-admins should never see the PAT
            doc.pat = '***hidden***'
          }
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Agent identifier (e.g., "priya", "quinn", "sam")',
      },
    },
    {
      name: 'githubUsername',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'GitHub username for this agent',
      },
    },
    {
      name: 'pat',
      type: 'text',
      admin: {
        description: 'GitHub Personal Access Token (encrypted at rest, admin-only)',
        // Component will be visible but value will be masked for non-admins via afterRead hook
      },
      access: {
        // Only admins can read/update the PAT field
        read: ({ req: { user } }) => user?.roles?.includes('admin'),
        update: ({ req: { user } }) => user?.roles?.includes('admin'),
      },
    },
    {
      name: 'persona',
      type: 'textarea',
      admin: {
        description: 'Description of the agent\'s review focus and personality',
      },
    },
    {
      name: 'canEscalate',
      type: 'array',
      admin: {
        description: 'List of agent names this agent can escalate to',
      },
      fields: [
        {
          name: 'agentName',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
  timestamps: true,
}
