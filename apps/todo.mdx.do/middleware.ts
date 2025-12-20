import { authkitMiddleware } from '@workos-inc/authkit-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Check if WorkOS is configured
const isWorkOSConfigured = !!(
  process.env.WORKOS_API_KEY &&
  process.env.WORKOS_CLIENT_ID &&
  process.env.WORKOS_COOKIE_PASSWORD
)

// Create a pass-through middleware when WorkOS isn't configured
function passthroughMiddleware(request: NextRequest) {
  return NextResponse.next()
}

// Use AuthKit when configured, pass-through when not
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
