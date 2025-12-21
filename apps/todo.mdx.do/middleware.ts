import { authkitMiddleware } from '@workos-inc/authkit-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Detect environment
const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'

// Check if WorkOS is configured
const isWorkOSConfigured = !!(
  process.env.WORKOS_API_KEY &&
  process.env.WORKOS_CLIENT_ID &&
  process.env.WORKOS_COOKIE_PASSWORD
)

// Security check: In production, WorkOS MUST be configured
if (isProduction && !isWorkOSConfigured) {
  throw new Error(
    'SECURITY ERROR: WorkOS authentication is not configured in production. ' +
    'This would leave the application unprotected. ' +
    'Please set WORKOS_API_KEY, WORKOS_CLIENT_ID, and WORKOS_COOKIE_PASSWORD environment variables.'
  )
}

// Log warning in development if auth is disabled
if (isDevelopment && !isWorkOSConfigured) {
  console.warn(
    '\n⚠️  WARNING: WorkOS authentication is disabled in development mode.\n' +
    '   The application is running WITHOUT authentication protection.\n' +
    '   Set WORKOS_API_KEY, WORKOS_CLIENT_ID, and WORKOS_COOKIE_PASSWORD to enable auth.\n'
  )
}

// Create a pass-through middleware when WorkOS isn't configured (dev only)
function passthroughMiddleware(request: NextRequest) {
  // This should only be called in development when auth is disabled
  if (isProduction) {
    throw new Error('SECURITY ERROR: Attempted to use passthrough middleware in production')
  }
  return NextResponse.next()
}

// Use AuthKit when configured, pass-through only in development when not configured
const middleware = isWorkOSConfigured
  ? authkitMiddleware({
      middlewareAuth: {
        enabled: true,
        unauthenticatedPaths: ['/', '/docs', '/docs/*'],
      },
    })
  : passthroughMiddleware

export default middleware

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
