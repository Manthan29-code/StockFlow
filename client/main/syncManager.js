const { wsClient } = require('./wsClient');
const { request } = require('./httpClient');
const { getConfig } = require('./config');
const { isAuthenticated } = require('./session');

let fallbackInterval = null;
let lastKnownRevision = null;
let currentStatus = 'disconnected'; // 'connected' | 'reconnecting' | 'disconnected'
let statusListeners = new Set();
let syncEventListeners = new Set();

function initSyncManager() {
  wsClient.on('status', (status) => {
    const prevStatus = currentStatus;
    currentStatus = status;

    notifyStatus(status);

    if (status === 'connected') {
      stopFallbackPolling();
      if (prevStatus === 'reconnecting') {
        // Full refresh on reconnect
        notifySyncEvent({ type: 'reconnected' });
      }
    } else if (status === 'reconnecting') {
      startFallbackPolling();
    } else {
      stopFallbackPolling();
    }
  });

  wsClient.on('changed', (event) => {
    lastKnownRevision = event.revision;
    notifySyncEvent(event);
  });
}

function start() {
  if (isAuthenticated()) {
    wsClient.connect();
  }
}

function stop() {
  wsClient.disconnect();
  stopFallbackPolling();
}

function startFallbackPolling() {
  if (fallbackInterval) return;

  const { SYNC_FALLBACK_POLL_MS } = getConfig();
  fallbackInterval = setInterval(async () => {
    if (!isAuthenticated() || currentStatus === 'connected') return;

    try {
      const res = await request({ method: 'GET', path: '/api/sync/revision' });
      if (res && res.revision !== undefined) {
        if (lastKnownRevision !== null && res.revision !== lastKnownRevision) {
          notifySyncEvent({ type: 'changed', revision: res.revision, fallback: true });
        }
        lastKnownRevision = res.revision;
      }
    } catch (err) {
      // Server unreachable during polling
    }
  }, SYNC_FALLBACK_POLL_MS || 5000);
}

function stopFallbackPolling() {
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }
}

function onStatus(callback) {
  statusListeners.add(callback);
  callback(currentStatus);
  return () => statusListeners.delete(callback);
}

function onSyncEvent(callback) {
  syncEventListeners.add(callback);
  return () => syncEventListeners.delete(callback);
}

function notifyStatus(status) {
  for (const cb of statusListeners) {
    try {
      cb(status);
    } catch (err) {
      console.error('Error in status listener:', err);
    }
  }
}

function notifySyncEvent(event) {
  for (const cb of syncEventListeners) {
    try {
      cb(event);
    } catch (err) {
      console.error('Error in syncEvent listener:', err);
    }
  }
}

function getStatus() {
  return currentStatus;
}

module.exports = {
  initSyncManager,
  start,
  stop,
  onStatus,
  onSyncEvent,
  getStatus,
};

