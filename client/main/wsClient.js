const WebSocket = require('ws');
const { getConfig } = require('./config');
const { getToken } = require('./session');

class WsClient {
  constructor() {
    this.ws = null;
    this.status = 'disconnected'; // 'connected' | 'reconnecting' | 'disconnected'
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.isExplicitlyClosed = false;
    this.listeners = {
      status: new Set(),
      changed: new Set(),
    };
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].add(callback);
    }
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      for (const cb of this.listeners[event]) {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in ${event} listener:`, err);
        }
      }
    }
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.emit('status', newStatus);
    }
  }

  getWsUrl() {
    const { API_BASE_URL } = getConfig();
    const wsBase = API_BASE_URL.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://').replace(/\/+$/, '');
    return `${wsBase}/ws`;
  }

  connect() {
    const token = getToken();
    if (!token) {
      this.setStatus('disconnected');
      return;
    }

    this.isExplicitlyClosed = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = this.getWsUrl();
    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      this.handleDisconnect();
      return;
    }

    this.ws.on('open', () => {
      // Send auth payload
      const currentToken = getToken();
      if (currentToken) {
        this.ws.send(JSON.stringify({ type: 'auth', token: currentToken }));
      }
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'authenticated') {
          this.reconnectAttempts = 0;
          this.setStatus('connected');
        } else if (msg.type === 'changed') {
          this.emit('changed', msg);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket incoming message:', err);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.handleDisconnect();
    });

    this.ws.on('error', (err) => {
      this.handleDisconnect();
    });
  }

  handleDisconnect() {
    if (this.isExplicitlyClosed) {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('reconnecting');
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;

    // Backoff intervals: 1s, 2s, 5s, 10s, max 30s
    const backoffs = [1000, 2000, 5000, 10000, 30000];
    const delay = backoffs[Math.min(this.reconnectAttempts, backoffs.length - 1)];
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isExplicitlyClosed && getToken()) {
        this.connect();
      }
    }, delay);
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (err) {}
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.setStatus('disconnected');
  }
}

const wsClient = new WsClient();

module.exports = {
  wsClient,
};

