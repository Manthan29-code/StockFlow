const { ipcMain } = require('electron');
const { request } = require('../httpClient');

function registerRequestIpc() {
  ipcMain.handle('api:request', async (event, { method = 'GET', path, body, query }) => {
    if (!path || !path.startsWith('/api/')) {
      throw new Error(`Forbidden path: only '/api/*' requests are permitted. Got: ${path}`);
    }

    try {
      return await request({ method, path, body, query });
    } catch (err) {
      const msg = err.message || (typeof err === 'string' ? err : 'Request failed');
      const error = new Error(msg);
      error.code = err.code || 'REQUEST_FAILED';
      error.status = err.status || 500;
      error.details = err.details || {};
      throw error;
    }
  });
}

module.exports = {
  registerRequestIpc,
};

