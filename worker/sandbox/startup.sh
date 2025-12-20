#!/bin/bash
set -euo pipefail

echo "[startup] Starting sandbox services..."

# Start stdio WebSocket bridge in background
echo "[startup] Starting stdio-ws server on port 8080..."
bun /workspace/stdio-ws.ts &
STDIO_PID=$!

# Wait a moment for stdio-ws to start
sleep 0.5

# Check if stdio-ws is running
if ! kill -0 $STDIO_PID 2>/dev/null; then
  echo "[startup] ERROR: stdio-ws failed to start"
  exit 1
fi

echo "[startup] stdio-ws started (PID: $STDIO_PID)"

# Start SDK control plane (required for Sandbox SDK APIs like exec, execStream)
echo "[startup] Starting SDK control plane..."
exec bun dist/index.js
