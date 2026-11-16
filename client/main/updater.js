const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

let isUpdaterInitialized = false;

/**
 * Initializes electron-updater and binds IPC channels with the renderer UI.
 * @param {BrowserWindow} mainWindow
 */
function initUpdater(mainWindow) {
  if (isUpdaterInitialized) return;
  isUpdaterInitialized = true;

  // Require user approval before downloading the update
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Fired when a newer release is detected on GitHub
  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:available', {
        version: info.version,
        releaseDate: info.releaseDate,
      });
    }
  });

  // Track real-time download progress
  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:progress', {
        percent: Math.floor(progressObj.percent),
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
      });
    }
  });

  // Fired when the installer has finished downloading in the background
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:downloaded', {
        version: info.version,
      });
    }
  });

  // Gracefully handle errors (e.g. offline, no release yet)
  autoUpdater.on('error', (err) => {
    console.warn('AutoUpdater warning:', err ? err.message : err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:error', {
        message: err ? err.message : 'Update check failed',
      });
    }
  });

  // User clicked "Download Now"
  ipcMain.on('update:download', () => {
    autoUpdater.downloadUpdate().catch((err) => {
      console.warn('Failed to start update download:', err);
    });
  });

  // User clicked "Restart & Install"
  ipcMain.on('update:restart', () => {
    autoUpdater.quitAndInstall();
  });

  // Check for updates command
  ipcMain.on('update:check', () => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('Update check failed:', err);
      });
    }
  });

  // Check for updates 3 seconds after launch in production (.exe)
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('Startup update check failed:', err);
      });
    }, 3000);
  }
}

module.exports = {
  initUpdater,
};

