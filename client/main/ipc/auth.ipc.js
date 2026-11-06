const { ipcMain } = require('electron');
const { request } = require('../httpClient');
const { setSession, clearSession, getCurrentUser, isAuthenticated } = require('../session');
const { wsClient } = require('../wsClient');
const { backupScheduler } = require('../backup/backupScheduler');
const { ROLES } = require('@stockflow/shared');

function registerAuthIpc() {
  ipcMain.handle('auth:login', async (event, { username, password, rememberMe }) => {
    const res = await request({
      method: 'POST',
      path: '/api/auth/login',
      body: { username, password },
    });

    if (res && res.token && res.user) {
      await setSession(res.token, res.user, rememberMe);
      wsClient.connect();
      if (res.user.role === ROLES.ADMIN) {
        backupScheduler.start();
      }
    }
    return res.user;
  });

  ipcMain.handle('auth:logout', async () => {
    clearSession();
    wsClient.disconnect();
    backupScheduler.stop();
    return { success: true };
  });

  ipcMain.handle('auth:me', async () => {
    if (!isAuthenticated()) {
      return null;
    }
    try {
      const res = await request({ method: 'GET', path: '/api/auth/me' });
      return res.user;
    } catch (err) {
      clearSession();
      wsClient.disconnect();
      return null;
    }
  });
}

module.exports = {
  registerAuthIpc,
};

