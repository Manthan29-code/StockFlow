const { ipcMain } = require('electron');
const { getConfig, saveSettings } = require('../config');

function registerSettingsIpc() {
  ipcMain.handle('settings:get', () => {
    return getConfig();
  });

  ipcMain.handle('settings:save', (event, newSettings) => {
    return saveSettings(newSettings);
  });
}

module.exports = {
  registerSettingsIpc,
};

