const Api = {
  async request({ method = 'GET', path, body, query }) {
    if (!window.api || !window.api.request) {
      throw new Error('Electron preload API bridge not available');
    }

    // Block saving if offline
    if (method !== 'GET' && !State.isOnline()) {
      Toast.show('Cannot save while disconnected from server', 'error');
      throw new Error('Offline: saving blocked');
    }

    try {
      return await window.api.request({ method, path, body, query });
    } catch (err) {
      if (err.message && err.message.includes("Error invoking remote method 'api:request': Error: ")) {
        err.message = err.message.replace("Error invoking remote method 'api:request': Error: ", '');
      } else if (err.message && err.message.includes("Error invoking remote method 'api:request': ")) {
        err.message = err.message.replace("Error invoking remote method 'api:request': ", '');
      }
      if (err.status === 409 && err.code === 'VERSION_CONFLICT') {
        FormHelper.showConflictPrompt();
      }
      throw err;
    }
  },

  async get(path, query) {
    return this.request({ method: 'GET', path, query });
  },

  async post(path, body) {
    return this.request({ method: 'POST', path, body });
  },

  async patch(path, body) {
    return this.request({ method: 'PATCH', path, body });
  },

  async delete(path) {
    return this.request({ method: 'DELETE', path });
  },
};

