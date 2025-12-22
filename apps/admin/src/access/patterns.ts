import type { AccessArgs } from 'payload'
import { isInternalRequest } from './internal'

/**
 * Standardized access control patterns for Payload collections.
 *
 * SECURITY: All patterns check isInternalRequest first to allow internal RPC calls.
 * This ensures the Worker can access all collections via service bindings.
 *
 * Pattern hierarchy (most restrictive to least):
 * 1. internalOnly - Only internal RPC calls (no user access)
 * 2. adminOnly - Internal RPC or admin users
 * 3. authenticated - Internal RPC or any logged-in user
 * 4. ownerOrAdmin - Internal RPC, admin, or record owner
 * 5. repoAccess - Internal RPC, admin, or users with repo access via installation
 * 6. publicRead - Anyone can read (use sparingly)
 */

/**
 * Only allow internal RPC calls. No user access at all.
 * Use for system-only collections.
 */
export function internalOnly({ req }: AccessArgs): boolean {
  return isInternalRequest(req)
}

/**
 * Allow internal RPC or admin users.
 * Standard pattern for create/delete on most collections.
 */
export function adminOnly({ req }: AccessArgs): boolean {
  if (isInternalRequest(req)) return true
  return req.user?.roles?.includes('admin') ?? false
}

/**
 * Allow internal RPC or any authenticated user.
 * Use for collections where any logged-in user can perform actions.
 */
export function authenticated({ req }: AccessArgs): boolean {
  if (isInternalRequest(req)) return true
  return !!req.user
}

/**
 * Create an access function that allows internal requests, admins,
 * or the owner of the record (based on a field).
 *
 * @param ownerField - The field name that contains the owner relationship (default: 'user')
 *
 * For read/update/delete operations, returns a where clause to filter by owner.
 */
export function ownerOrAdmin(ownerField: string = 'user') {
  return ({ req }: AccessArgs): boolean | Record<string, any> => {
    if (isInternalRequest(req)) return true
    const { user } = req
    if (!user) return false
    if (user.roles?.includes('admin')) return true
    // Return where clause to filter by owner
    return {
      [ownerField]: { equals: user.id },
    }
  }
}

/**
 * Access function for collections with a self-ownership pattern.
 * Users can only access their own record (e.g., Users collection).
 */
export function selfOrAdmin({ req }: AccessArgs): boolean | Record<string, any> {
  if (isInternalRequest(req)) return true
  const { user } = req
  if (!user) return false
  if (user.roles?.includes('admin')) return true
  return { id: { equals: user.id } }
}

/**
 * Access function for collections scoped to repositories.
 * Users can access records from repos in installations they're connected to.
 *
 * Requires the collection to have a 'repo' relationship field that has
 * 'installation.users' populated.
 */
export function repoAccess({ req }: AccessArgs): boolean | Record<string, any> {
  if (isInternalRequest(req)) return true
  const { user } = req
  if (!user) return false
  if (user.roles?.includes('admin')) return true
  return {
    'repo.installation.users.id': { equals: user.id },
  }
}

/**
 * Access function for collections scoped to installations (orgs).
 * Users can access records from installations they're connected to.
 */
export function installationAccess({ req }: AccessArgs): boolean | Record<string, any> {
  if (isInternalRequest(req)) return true
  const { user } = req
  if (!user) return false
  if (user.roles?.includes('admin')) return true
  return {
    'installation.users.id': { equals: user.id },
  }
}

/**
 * Access function for repo-level update operations.
 * Users can update records from repos in installations they're connected to.
 * Same as repoAccess but semantically named for clarity.
 */
export const repoUpdateAccess = repoAccess

/**
 * Public read access with internal request check.
 * Use sparingly - allows unauthenticated reads.
 */
export function publicRead({ req }: AccessArgs): boolean {
  if (isInternalRequest(req)) return true
  return true
}

/**
 * Deny all access. Use for immutable operations.
 */
export function denyAll(): boolean {
  return false
}
