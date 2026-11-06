const State = {
  currentUser: null,
  connectionStatus: 'connected', // 'connected' | 'reconnecting' | 'disconnected'
  activeRoute: 'dashboard',
  materialsCache: [],
  unitsCache: [],

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  },

  isOnline() {
    return this.connectionStatus === 'connected';
  },

  setUser(user) {
    this.currentUser = user;
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach((el) => {
      el.style.display = this.isAdmin() ? 'block' : 'none';
    });

    if (user) {
      document.getElementById('user-name').textContent = user.username;
      const avatar = document.getElementById('user-avatar');
      avatar.textContent = user.username.substring(0, 2).toUpperCase();
      avatar.style.backgroundColor = user.color || '#635BFF';
    }
  },

  setConnectionStatus(status) {
    this.connectionStatus = status;
    const dot = document.querySelector('.status-dot');
    const text = document.getElementById('connection-status-text');

    if (dot && text) {
      dot.className = `status-dot ${status}`;
      if (status === 'connected') {
        text.textContent = 'Connected';
        Banner.clear();
      } else if (status === 'reconnecting') {
        text.textContent = 'Reconnecting...';
        Banner.show('Offline — reconnecting to server. Saving is temporarily disabled.', 'warning');
      } else {
        text.textContent = 'Disconnected';
        Banner.show('Disconnected from server. Saving is disabled.', 'error');
      }
    }
  },
};

