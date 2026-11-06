const { ipcMain, dialog } = require('electron');
const { saveSettings } = require('../config');
const { backupScheduler } = require('../backup/backupScheduler');
const { inspectBackupFile, restoreFromFile } = require('../backup/restoreService');

function registerBackupIpc() {
  ipcMain.handle('backup:chooseFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Backup Storage Directory',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { canceled: true };
    }

    const folderPath = filePaths[0];
    saveSettings({ BACKUP_FOLDER: folderPath });

    // Trigger immediate backup if admin
    backupScheduler.checkAndBackup(true);

    return { canceled: false, folderPath };
  });

  ipcMain.handle('backup:getStatus', () => {
    return backupScheduler.getStatus();
  });

  ipcMain.handle('backup:runNow', async () => {
    await backupScheduler.checkAndBackup(true);
    return backupScheduler.getStatus();
  });

  ipcMain.handle('backup:inspectFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Backup File to Restore',
      filters: [{ name: 'JSON Backup Files', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = filePaths[0];
    try {
      const info = inspectBackupFile(filePath);
      return {
        canceled: false,
        filePath,
        info,
      };
    } catch (err) {
      return {
        canceled: false,
        error: err.message,
      };
    }
  });

  ipcMain.handle('backup:confirmRestore', async (event, { filePath }) => {
    return await restoreFromFile(filePath);
  });
}

module.exports = {
  registerBackupIpc,
};

