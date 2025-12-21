/**
 * Stdio WebSocket Proxy API
 *
 * Proxies WebSocket connections to the sandbox's stdio-ws server (port 8080).
 * Uses binary protocol for stdin/stdout/stderr multiplexing.
 *
 * Authentication:
 * - Uses unified session cookie (__Host-SESSION) for browser access
 * - Supports Bearer token (signed session token or OAuth JWT) for WebSocket/API
 * - Login/logout handled by /api/auth/* endpoints
 */

import { Hono } from 'hono'
import { getSandbox } from '@cloudflare/sandbox'
import {
  authMiddleware,
  decodeOAuthToken,
  getSessionFromRequest,
  parseSessionToken,
  createSessionToken,
  type AuthContext,
} from '../auth'
import type { Env } from '../types'

const app = new Hono<{ Bindings: Env }>()

/**
 * Get the singleton SessionDO instance
 */
function getSessionDO(env: Env) {
  const doId = env.SESSION.idFromName('sessions')
  return env.SESSION.get(doId)
}

/**
 * GET /stdio/:sandboxId
 * WebSocket upgrade for stdio proxy
 *
 * Query params passed through to sandbox:
 *   - cmd: Command to run (default: bash)
 *   - arg: Arguments (repeatable)
 *
 * Authentication:
 *   - token: Query param or Authorization header
 */
app.get('/:sandboxId', async (c) => {
  const upgradeHeader = c.req.header('Upgrade')

  // Must be WebSocket upgrade
  if (upgradeHeader?.toLowerCase() !== 'websocket') {
    return c.json({
      error: 'WebSocket upgrade required',
      usage: 'Connect via WebSocket with ?cmd=bash&arg=...',
    }, 426)
  }

  const sandboxId = c.req.param('sandboxId')
  const url = new URL(c.req.url)

  // Authenticate
  const token = url.searchParams.get('token')
    ?? c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  // Validate token
  try {
    const auth = await validateToken(c.env, token)
    if (!auth) {
      return c.json({ error: 'Invalid token' }, 401)
    }
  } catch (err) {
    console.error('[stdio] Auth error:', err)
    return c.json({ error: 'Authentication failed' }, 401)
  }

  // Get sandbox instance
  try {
    const sandbox = getSandbox(
      c.env.Sandbox,
      sandboxId
    )

    // Ensure stdio-ws is running before proxying
    await sandbox.exec(
      'pgrep -f stdio-ws.ts >/dev/null || (nohup bun /workspace/stdio-ws.ts > /tmp/stdio-ws.log 2>&1 & sleep 0.5)'
    )

    // Inject worker env vars into the WebSocket URL for the sandbox
    // This allows CLAUDE_CODE_OAUTH_TOKEN to be available in sandbox commands
    const reqUrl = new URL(c.req.raw.url)
    if (c.env.CLAUDE_CODE_OAUTH_TOKEN) {
      reqUrl.searchParams.set('env_CLAUDE_CODE_OAUTH_TOKEN', c.env.CLAUDE_CODE_OAUTH_TOKEN)
    }
    if (c.env.ANTHROPIC_API_KEY) {
      reqUrl.searchParams.set('env_ANTHROPIC_API_KEY', c.env.ANTHROPIC_API_KEY)
    }

    // Create new request with injected env vars, preserving headers for WebSocket upgrade
    const wsRequest = new Request(reqUrl.toString(), {
      method: c.req.raw.method,
      headers: c.req.raw.headers,
    })

    // Proxy WebSocket to sandbox port 8080
    return await sandbox.wsConnect(wsRequest, 8080)
  } catch (err) {
    console.error('[stdio] Sandbox connection error:', err)
    return c.json({
      error: 'Failed to connect to sandbox',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 500)
  }
})

/**
 * GET /stdio/:sandboxId/warmup
 * Warm up the sandbox container by running a simple command
 * This helps avoid cold-start delays on WebSocket connections
 */
app.get('/:sandboxId/warmup', async (c) => {
  const sandboxId = c.req.param('sandboxId')
  const url = new URL(c.req.url)

  // Authenticate
  const token = url.searchParams.get('token')
    ?? c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const auth = await validateToken(c.env, token)
  if (!auth) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  try {
    const sandbox = getSandbox(
      c.env.Sandbox,
      sandboxId
    )

    // Start stdio-ws if not running
    console.log(`[stdio] Warming up sandbox: ${sandboxId}`)

    // Start stdio-ws server if not already running
    await sandbox.exec(
      'pgrep -f stdio-ws.ts >/dev/null || (nohup bun /workspace/stdio-ws.ts > /tmp/stdio-ws.log 2>&1 & sleep 1)'
    )

    // Verify it's running
    const verifyResult = await sandbox.exec('curl -s localhost:8080 2>/dev/null || echo "Not ready"')

    const result = {
      stdout: verifyResult.stdout || 'stdio-ws started',
      success: verifyResult.stdout?.includes('sandbox-stdio-ws') || false,
    }

    return c.json({
      status: 'ready',
      sandboxId,
      output: result.stdout,
      success: result.success,
    })
  } catch (err) {
    console.error('[stdio] Warmup error:', err)
    return c.json({
      error: 'Failed to warm up sandbox',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 500)
  }
})

/**
 * GET /stdio/:sandboxId/embed
 * Embeddable terminal page with xterm.js
 *
 * Authentication:
 *   - Uses unified session cookie (__Host-SESSION)
 *   - Redirects to /api/auth/login if not authenticated
 *
 * Query params:
 *   - cmd: Command to run (default: bash)
 *   - arg: Arguments (repeatable)
 *
 * Returns an HTML page that can be embedded in an iframe.
 */
app.get('/:sandboxId/embed', async (c) => {
  const sandboxId = c.req.param('sandboxId')
  const url = new URL(c.req.url)

  // Check for token in query param or Authorization header first (for API/token access)
  const token = url.searchParams.get('token')
    ?? c.req.header('Authorization')?.replace('Bearer ', '')

  let wsToken: string

  if (token) {
    // Validate token using the same logic as WebSocket endpoint
    const auth = await validateToken(c.env, token)
    if (!auth) {
      return c.json({ error: 'Invalid token' }, 401)
    }
    // Use the validated token for WebSocket connection
    wsToken = token
  } else {
    // Fall back to session cookie (browser access)
    const session = await getSessionFromRequest(c.req.raw, c.env.COOKIE_ENCRYPTION_KEY)
    if (!session) {
      // Redirect to unified login only for browser access without any auth
      const returnUrl = encodeURIComponent(url.pathname + url.search)
      return c.redirect(`/api/auth/login?return=${returnUrl}`)
    }
    // Create a signed token for WebSocket connection
    // (WebSockets can't access HttpOnly cookies directly)
    wsToken = await createSessionToken(session, c.env.COOKIE_ENCRYPTION_KEY)
  }

  // Build WebSocket URL
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${wsProtocol}//${url.host}/api/stdio/${sandboxId}?token=${encodeURIComponent(wsToken)}`

  // Add cmd and arg params
  const cmd = url.searchParams.get('cmd') || 'bash'
  const args = url.searchParams.getAll('arg')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terminal - ${sandboxId}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; background: #1e1e1e; }
    #terminal { height: 100%; width: 100%; }
    #status {
      position: fixed;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      z-index: 100;
    }
    .connecting { background: #e5e510; color: #000; }
    .connected { background: #0dbc79; color: #fff; }
    .disconnected { background: #cd3131; color: #fff; }
  </style>
</head>
<body>
  <div id="status" class="connecting">Connecting...</div>
  <div id="terminal"></div>

  <script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-web-links@0.11.0/lib/addon-web-links.min.js"></script>
  <script>
    const STREAM_STDOUT = 0x01;
    const STREAM_STDERR = 0x02;

    // Unpack binary message
    function unpack(data) {
      const bytes = new Uint8Array(data);
      return { streamId: bytes[0], payload: bytes.subarray(1) };
    }

    // Initialize terminal
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
    });

    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    const statusEl = document.getElementById('status');
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // Build WebSocket URL with cmd and args
    let wsUrl = ${JSON.stringify(wsUrl)};
    const cmd = ${JSON.stringify(cmd)};
    const args = ${JSON.stringify(args)};
    wsUrl += '&cmd=' + encodeURIComponent(cmd);
    args.forEach(arg => wsUrl += '&arg=' + encodeURIComponent(arg));

    // Connect WebSocket
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      statusEl.className = 'connected';
      statusEl.textContent = 'Connected';

      // Send resize
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows
      }));

      // Hide status after 2s
      setTimeout(() => statusEl.style.opacity = '0', 2000);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // JSON control message
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'exit') {
            term.write('\\r\\n\\x1b[32m[Process exited with code ' + msg.code + ']\\x1b[0m\\r\\n');
            statusEl.className = 'disconnected';
            statusEl.textContent = 'Exited: ' + msg.code;
            statusEl.style.opacity = '1';
          }
        } catch {}
      } else {
        // Binary output
        const { streamId, payload } = unpack(event.data);
        const text = decoder.decode(payload);
        term.write(text);
      }
    };

    ws.onerror = () => {
      statusEl.className = 'disconnected';
      statusEl.textContent = 'Error';
      statusEl.style.opacity = '1';
    };

    ws.onclose = (event) => {
      if (event.code !== 1000) {
        statusEl.className = 'disconnected';
        statusEl.textContent = 'Disconnected';
        statusEl.style.opacity = '1';
        term.write('\\r\\n\\x1b[31m[Connection closed]\\x1b[0m\\r\\n');
      }
    };

    // Handle input
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    });

    // Handle resize
    window.addEventListener('resize', () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows
        }));
      }
    });
  </script>
</body>
</html>`

  return c.html(html)
})

/**
 * POST /stdio/create
 * Create a new sandbox session and return connection details
 *
 * Body:
 *   - sandboxId: Optional custom sandbox ID (default: auto-generated)
 *   - repo: Optional repo to clone
 *   - installationId: GitHub installation ID (required if repo specified)
 */
app.post('/create', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext

  try {
    const body = await c.req.json<{
      sandboxId?: string
      repo?: string
      installationId?: number
    }>()

    const sandboxId = body.sandboxId ?? crypto.randomUUID()

    // Store session in SessionDO (SQLite) instead of KV
    const sessionDO = getSessionDO(c.env)
    await sessionDO.fetch(new Request('http://do/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: `stdio:${sandboxId}`,
        userId: auth.userId,
        email: auth.email,
        name: auth.name,
        data: {
          repo: body.repo,
          installationId: body.installationId,
        },
        ttlSeconds: 3600,
      }),
    }))

    // Pre-create sandbox instance
    const doId = c.env.Sandbox.idFromName(sandboxId)
    c.env.Sandbox.get(doId)

    return c.json({
      sandboxId,
      wsUrl: `/api/stdio/${sandboxId}`,
      expiresIn: 3600,
    })
  } catch (err) {
    console.error('[stdio] Create error:', err)
    return c.json({
      error: 'Failed to create sandbox session',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 500)
  }
})

/**
 * DELETE /stdio/:sandboxId
 * Terminate a sandbox session
 */
app.delete('/:sandboxId', authMiddleware, async (c) => {
  const sandboxId = c.req.param('sandboxId')

  try {
    // Remove from SessionDO
    const sessionDO = getSessionDO(c.env)
    await sessionDO.fetch(new Request('http://do/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: `stdio:${sandboxId}` }),
    }))

    // TODO: Terminate sandbox (Sandbox SDK doesn't have a terminate method yet)

    return c.json({ success: true, sandboxId })
  } catch (err) {
    console.error('[stdio] Delete error:', err)
    return c.json({
      error: 'Failed to terminate sandbox',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 500)
  }
})

/**
 * GET /stdio/:sandboxId/status
 * Get sandbox session status
 */
app.get('/:sandboxId/status', authMiddleware, async (c) => {
  const sandboxId = c.req.param('sandboxId')

  try {
    const sessionDO = getSessionDO(c.env)
    const response = await sessionDO.fetch(new Request('http://do/sessions/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: `stdio:${sandboxId}` }),
    }))

    if (!response.ok) {
      return c.json({ error: 'Session not found' }, 404)
    }

    const session = await response.json()

    return c.json({
      sandboxId,
      session,
      wsUrl: `/api/stdio/${sandboxId}`,
    })
  } catch (err) {
    console.error('[stdio] Status error:', err)
    return c.json({
      error: 'Failed to get session status',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Validate authentication token
 * Returns auth context or null if invalid
 *
 * Supports multiple token formats:
 * - WorkOS session token (wos_...)
 * - JWT token (eyJ...)
 * - Signed session token (signature.base64-payload)
 * - SessionDO tokens
 */
async function validateToken(
  env: Env,
  token: string
): Promise<AuthContext | null> {
  try {
    // Check for TEST_API_KEY (testing/development)
    if (env.TEST_API_KEY && token === env.TEST_API_KEY) {
      return {
        userId: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
        source: 'test_api_key',
      }
    }

    // Try WorkOS session token
    if (token.startsWith('wos_')) {
      // WorkOS session - validate via WorkOS API
      const response = await fetch('https://api.workos.com/user_management/authenticate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WORKOS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_token: token,
          client_id: env.WORKOS_CLIENT_ID,
        }),
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json() as any
      return {
        userId: data.user?.id,
        email: data.user?.email,
        name: data.user?.first_name,
        source: 'workos',
      }
    }

    // Try JWT token (WorkOS access token via oauth.do)
    // JWTs start with 'eyJ' (base64 encoded '{"')
    if (token.startsWith('eyJ')) {
      try {
        const session = decodeOAuthToken(token)
        return {
          userId: session.userId,
          email: session.email,
          name: undefined,
          source: 'jwt',
        }
      } catch {
        // Not a valid JWT, fall through
      }
    }

    // Try signed session token (from /api/auth/token or cookie)
    if (token.includes('.')) {
      const session = await parseSessionToken(token, env.COOKIE_ENCRYPTION_KEY)
      if (session) {
        return {
          userId: session.userId,
          email: session.email,
          name: session.name,
          source: 'token',
        }
      }
    }

    // Try session in SessionDO (handles any token length)
    const sessionDO = getSessionDO(env)
    const response = await sessionDO.fetch(new Request('http://do/sessions/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }))

    if (response.ok) {
      const session = await response.json() as any
      return {
        userId: session.userId,
        email: session.email,
        name: session.name,
        source: 'session',
      }
    }

    return null
  } catch (err) {
    console.error('[stdio] Token validation error:', err)
    return null
  }
}

export default app
