/**
 * Access control utilities for Payload CMS collections.
 *
 * Re-exports all access control helpers for easy importing:
 *   import { adminOnly, repoAccess, ownerOrAdmin } from '../access'
 */

// Core internal request detection and legacy helpers
export { isInternalRequest, withInternalAccess, internalOrAdmin } from './internal'

// Standardized access patterns
export {
  internalOnly,
  adminOnly,
  authenticated,
  ownerOrAdmin,
  selfOrAdmin,
  repoAccess,
  installationAccess,
  repoUpdateAccess,
  publicRead,
  denyAll,
} from './patterns'
