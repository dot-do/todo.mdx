/**
 * Terminal Widget JavaScript
 * Handles xterm.js initialization and WebSocket connection
 */

class TerminalWidget {
  constructor(options = {}) {
    this.containerId = options.containerId || 'terminal-container';
    this.statusBarId = options.statusBarId || 'status-bar';
    this.wsUrl = options.wsUrl;
    this.terminal = null;
    this.ws = null;
    this.fitAddon = null;
    this.status = 'disconnected';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onComplete = options.onComplete || (() => {});
  }

  async init() {
    // Load xterm.js dynamically
    await this.loadScript('https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js');
    await this.loadScript('https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js');
    await this.loadCSS('https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css');

    // Initialize terminal
    this.terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#dcdcaa',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#f44747',
        brightGreen: '#6a9955',
        brightYellow: '#dcdcaa',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff',
      },
    });

    // Add fit addon
    this.fitAddon = new FitAddon.FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    // Open terminal in container
    const container = document.getElementById(this.containerId);
    this.terminal.open(container);
    this.fitAddon.fit();

    // Handle resize
    window.addEventListener('resize', () => {
      this.fitAddon.fit();
      this.sendResize();
    });

    // Handle terminal input
    this.terminal.onData((data) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'stdin', data }));
      }
    });

    return this;
  }

  async connect(wsUrl) {
    this.wsUrl = wsUrl || this.wsUrl;
    if (!this.wsUrl) {
      throw new Error('WebSocket URL required');
    }

    this.setStatus('connecting');

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.sendResize();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'stdout':
            case 'stderr':
              this.terminal.write(msg.data);
              break;
            case 'complete':
              this.setStatus('completed');
              this.onComplete(msg.exitCode || 0);
              break;
            case 'error':
              this.terminal.write(`\r\n\x1b[31mError: ${msg.error}\x1b[0m\r\n`);
              this.setStatus('error');
              break;
          }
        } catch (e) {
          // Raw data, write directly
          this.terminal.write(event.data);
        }
      };

      this.ws.onclose = (event) => {
        if (this.status !== 'completed') {
          this.setStatus('disconnected');
          this.tryReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });
  }

  tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.terminal.write('\r\n\x1b[31mConnection lost. Refresh to reconnect.\x1b[0m\r\n');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.terminal.write(`\r\n\x1b[33mReconnecting in ${delay/1000}s...\x1b[0m\r\n`);

    setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  sendResize() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.terminal) {
      this.ws.send(JSON.stringify({
        type: 'resize',
        cols: this.terminal.cols,
        rows: this.terminal.rows,
      }));
    }
  }

  setStatus(status) {
    this.status = status;
    const statusBar = document.getElementById(this.statusBarId);
    if (statusBar) {
      statusBar.className = 'status-bar ' + status;
      statusBar.textContent = this.getStatusText(status);
    }
    this.onStatusChange(status);
  }

  getStatusText(status) {
    switch (status) {
      case 'connecting': return '⟳ Connecting...';
      case 'connected': return '● Connected';
      case 'disconnected': return '○ Disconnected';
      case 'completed': return '✓ Completed';
      case 'error': return '✕ Error';
      default: return status;
    }
  }

  write(data) {
    if (this.terminal) {
      this.terminal.write(data);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  loadCSS(href) {
    return new Promise((resolve) => {
      if (document.querySelector(`link[href="${href}"]`)) {
        resolve();
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      document.head.appendChild(link);
    });
  }
}

// Export for use
window.TerminalWidget = TerminalWidget;
