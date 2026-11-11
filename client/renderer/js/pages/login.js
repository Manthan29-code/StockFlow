const LoginPage = {
  render(container) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 500px;">
        <div class="card" style="width: 100%; max-width: 400px; padding: 36px 32px; box-shadow: var(--shadow-lg);">
          <div style="text-align: center; margin-bottom: 28px;">
            <h1 style="font-size: 26px; font-weight: 700; color: var(--secondary); margin-bottom: 6px;">StockFlow</h1>
            <p style="color: var(--neutral); font-size: 13.5px; margin: 0;">Manufacturing Inventory & BOM System</p>
          </div>

          <form id="login-form">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" id="login-username" name="username" class="form-control" required autofocus>
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="login-password" name="password" class="form-control" required>
            </div>

            <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-top: 4px; margin-bottom: 20px;">
              <input type="checkbox" id="login-remember" name="remember" style="width: 16px; height: 16px; cursor: pointer;">
              <label for="login-remember" style="font-size: 13px; color: var(--text-secondary); cursor: pointer; user-select: none;">Remember me</label>
            </div>

            <div id="login-error" class="form-error" style="display: none; margin-bottom: 16px;"></div>

            <button type="submit" id="login-submit-btn" class="btn btn-primary" style="width: 100%; height: 42px; font-size: 14px; font-weight: 600;">
              Sign In
            </button>
          </form>
        </div>
      </div>
    `;

    const form = document.getElementById('login-form');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const rememberMe = document.getElementById('login-remember').checked;
      const errorDiv = document.getElementById('login-error');
      const submitBtn = document.getElementById('login-submit-btn');

      errorDiv.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      try {
        const user = await window.api.login({ username, password, rememberMe });
        State.setUser(user);
        Router.navigate('dashboard');
      } catch (err) {
        let msg = (err && err.message) ? String(err.message) : 'Invalid username or password';
        // Clean any Electron IPC prefix wrapper e.g. "Error invoking remote method 'auth:login': Error: ..."
        msg = msg.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '').trim();
        if (!msg || msg === '[object Object]' || msg.includes('INTERNAL_ERROR') || msg.includes('INVALID_CREDENTIALS')) {
          msg = 'Invalid username or password';
        }
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    };
  },
};
