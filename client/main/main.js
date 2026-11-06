const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { registerAllIpc } = require('./ipc');
const { initSyncManager, start: startSync, stop: stopSync, onStatus, onSyncEvent } = require('./syncManager');
const { setOnUnauthorized } = require('./httpClient');

let mainWindow = null;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'StockFlow - Manufacturing Inventory & BOM',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Strict CSP
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:;",
        ],
      },
    });
  });

  // Register all IPC handlers
  registerAllIpc();

  // Initialize Sync Manager
  initSyncManager();

  // Forward connection status and sync events to renderer
  onStatus((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync:status', status);
    }
  });

  onSyncEvent((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync:event', event);
    }
  });

  // On 401 unauthorized, notify renderer to redirect to login
  setOnUnauthorized(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync:event', { type: 'unauthorized' });
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    stopSync();
    mainWindow = null;
  });

  startSync();
}

app.on('window-all-closed', () => {
  stopSync();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

