const { ipcMain } = require('electron');
const { request } = require('../httpClient');

function registerRequestIpc() {
  ipcMain.handle('api:request', async (event, { method = 'GET', path, body, query }) => {
    if (!path || !path.startsWith('/api/')) {
      throw new Error(`Forbidden path: only '/api/*' requests are permitted. Got: ${path}`);
    }

    return await request({ method, path, body, query });
  });
}

module.exports = {
  registerRequestIpc,
};

