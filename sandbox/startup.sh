#!/bin/bash
set -euo pipefail

echo "[startup] Starting sandbox services..."

# Start stdio WebSocket bridge in background
echo "[startup] Starting stdio-ws bridge on port 8080..."
bun /workspace/stdio-ws.ts &
STDIO_PID=$!

# Wait for stdio-ws to be ready
for i in {1..30}; do
  if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "[startup] stdio-ws bridge is ready"
    break
  fi
  sleep 0.1
done

# Start SDK control plane (required for Sandbox SDK APIs)
echo "[startup] Starting SDK control plane..."
exec bun dist/index.js
