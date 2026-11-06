const LoginPage = {
  render(container) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 500px;">
        <div class="card" style="width: 100%; max-width: 420px; padding: 32px; box-shadow: var(--shadow-lg);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 26px; font-weight: 700; color: var(--secondary);">StockFlow</h1>
            <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Manufacturing Inventory & BOM System</p>
          </div>

          <form id="login-form">
            <div class="form-group">
              <label class="form-label">Server URL</label>
              <input type="text" id="login-server-url" name="serverUrl" class="form-control" value="http://localhost:3000" required>
              <div id="server-url-warning" class="form-error" style="display: none; color: var(--warning);">
                Warning: Plain HTTP URL is insecure for production. Use HTTPS.
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" id="login-username" name="username" class="form-control" placeholder="Enter username" required autofocus>
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="login-password" name="password" class="form-control" placeholder="Enter password" required>
            </div>

            <div class="form-group" style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="login-remember" name="remember" style="width: 16px; height: 16px;">
              <label for="login-remember" style="font-size: 13px; color: var(--text-secondary); cursor: pointer;">Remember me</label>
            </div>

            <div id="login-error" class="form-error" style="display: none; margin-bottom: 16px;"></div>

            <button type="submit" id="login-submit-btn" class="btn btn-primary" style="width: 100%; height: 42px; font-size: 14px;">
              Sign In
            </button>
          </form>
        </div>
      </div>
    `;

    // Load saved server URL
    if (window.api && window.api.getSettings) {
      window.api.getSettings().then((cfg) => {
        if (cfg && cfg.API_BASE_URL) {
          const input = document.getElementById('login-server-url');
          if (input) input.value = cfg.API_BASE_URL;
        }
      });
    }

    const form = document.getElementById('login-form');
    const serverInput = document.getElementById('login-server-url');
    const warning = document.getElementById('server-url-warning');

    serverInput.addEventListener('input', () => {
      const val = serverInput.value.trim();
      if (val.startsWith('http://') && !val.includes('localhost') && !val.includes('127.0.0.1')) {
        warning.style.display = 'block';
      } else {
        warning.style.display = 'none';
      }
    });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const serverUrl = serverInput.value.trim();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const rememberMe = document.getElementById('login-remember').checked;
      const errorDiv = document.getElementById('login-error');
      const submitBtn = document.getElementById('login-submit-btn');

      errorDiv.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      try {
        if (window.api && window.api.saveSettings) {
          await window.api.saveSettings({ API_BASE_URL: serverUrl });
        }

        const user = await window.api.login({ username, password, rememberMe });
        State.setUser(user);
        Router.navigate('dashboard');
      } catch (err) {
        errorDiv.textContent = err.message || 'Invalid username or password';
        errorDiv.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    };
  },
};

