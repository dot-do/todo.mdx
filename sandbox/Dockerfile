# Dockerfile for Cloudflare Sandbox with stdio WebSocket bridge
#
# This container runs the stdio-ws bridge on port 8080, enabling
# CLI and browser clients to interact with processes via WebSocket.

FROM docker.io/cloudflare/sandbox:0.3.3

# Copy stdio WebSocket bridge
COPY stdio-ws.ts /workspace/stdio-ws.ts

# Copy startup script
COPY startup.sh /container-server/startup.sh
RUN chmod +x /container-server/startup.sh

# Install common development tools (optional, can be customized)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    wget \
    vim \
    less \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Set up workspace directory
WORKDIR /workspace

# Default environment for terminals
ENV TERM=xterm-256color
ENV COLORTERM=truecolor
ENV FORCE_COLOR=1

# Expose the stdio WebSocket port (for local dev)
EXPOSE 8080

# Note: The actual entry point is managed by Cloudflare Sandbox SDK
# The startup.sh script starts our stdio-ws bridge before the control plane
