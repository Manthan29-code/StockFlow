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

  // Bind sidebar toggle button
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.getElementById('sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.onclick = () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
    };
    if (localStorage.getItem('sidebar_collapsed') === 'true') {
      sidebar.classList.add('collapsed');
    }
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

  // Bind In-App Auto-Updater
  const updateContainer = document.getElementById('update-container');
  if (updateContainer && window.api && window.api.onUpdateAvailable) {
    // 1. New version available on GitHub
    window.api.onUpdateAvailable((info) => {
      const version = info && info.version ? `v${info.version}` : 'new version';
      updateContainer.style.display = 'block';
      updateContainer.innerHTML = `
        <div class="banner banner-info" style="justify-content: space-between; padding: 10px 24px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 16px;">🚀</span>
            <span>A new update is available (<strong>${version}</strong>)!</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button id="btn-download-update" class="btn btn-sm btn-primary" style="height: 30px; font-weight: 600;">Download Now</button>
            <button id="btn-dismiss-update" class="btn btn-sm btn-secondary" style="height: 30px; padding: 0 8px;" title="Dismiss">✕</button>
          </div>
        </div>
      `;

      const downloadBtn = document.getElementById('btn-download-update');
      const dismissBtn = document.getElementById('btn-dismiss-update');

      if (downloadBtn) {
        downloadBtn.onclick = () => {
          downloadBtn.disabled = true;
          downloadBtn.innerHTML = 'Downloading... 0%';
          window.api.downloadUpdate();
        };
      }

      if (dismissBtn) {
        dismissBtn.onclick = () => {
          updateContainer.style.display = 'none';
        };
      }
    });

    // 2. Real-time download progress
    if (window.api.onUpdateProgress) {
      window.api.onUpdateProgress((progress) => {
        const downloadBtn = document.getElementById('btn-download-update');
        if (downloadBtn) {
          downloadBtn.innerHTML = `Downloading... ${progress.percent}%`;
        }
      });
    }

    // 3. Download finished -> Ready to restart & install
    if (window.api.onUpdateDownloaded) {
      window.api.onUpdateDownloaded((info) => {
        const version = info && info.version ? `v${info.version}` : '';
        updateContainer.style.display = 'block';
        updateContainer.innerHTML = `
          <div class="banner banner-success" style="justify-content: space-between; padding: 10px 24px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 16px;">🎉</span>
              <span>Update downloaded successfully (${version})! Restart now to apply.</span>
            </div>
            <button id="btn-restart-update" class="btn btn-sm" style="height: 30px; font-weight: 600; background-color: #059669; color: #ffffff; border: none; cursor: pointer;">
              Restart & Install
            </button>
          </div>
        `;

        const restartBtn = document.getElementById('btn-restart-update');
        if (restartBtn) {
          restartBtn.onclick = () => {
            restartBtn.disabled = true;
            restartBtn.textContent = 'Restarting...';
            window.api.restartApp();
          };
        }
      });
    }
  }

  // Start router
  Router.init();
});

