document.addEventListener('DOMContentLoaded', async () => {
  // Bind connection status listener
  if (window.api && window.api.onConnectionStatus) {
    window.api.onConnectionStatus((status) => {
      State.setConnectionStatus(status);
    });
  }

  // Bind sync events from server
  if (window.api && window.api.onSyncEvent) {
    window.api.onSyncEvent((event) => {
      if (event.type === 'unauthorized') {
        State.setUser(null);
        Router.navigate('login');
      } else if (event.type === 'changed') {
        // Refetch currently visible page data without resetting forms
        if (Router.currentRoute !== 'login') {
          Router.refreshCurrentPage();
        }
      } else if (event.type === 'reconnected') {
        Toast.show('Reconnected to server', 'success');
        Router.refreshCurrentPage();
      }
    });
  }

  // Bind logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await window.api.logout();
      State.setUser(null);
      Router.navigate('login');
    };
  }

  // Check existing session
  try {
    const user = await window.api.me();
    if (user) {
      State.setUser(user);
    }
  } catch (err) {
    console.warn('No active session found:', err);
  }

  // Start router
  Router.init();
});

