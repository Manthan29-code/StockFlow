const LoginPage = {
  render(container) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 580px; width: 100%; background: radial-gradient(circle at 50% 40%, #f8faff 0%, #edf2f9 100%); padding: 24px;">
        <div class="card" style="width: 100%; max-width: 420px; padding: 42px 36px 38px; border-radius: 20px; border: 1px solid rgba(226, 232, 240, 0.8); background: #ffffff; box-shadow: 0 20px 45px -12px rgba(99, 102, 241, 0.12), 0 8px 24px -4px rgba(15, 23, 42, 0.05);">
          
          <!-- Logo & Header -->
          <div style="text-align: center; margin-bottom: 26px;">
            <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 14px;">
              <img src="assets/logo.png" onerror="this.onerror=null; this.src='../build/icon.png';" alt="FineTech Logo" style="width: 86px; height: auto; max-height: 86px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.04));">
            </div>
            <h1 style="font-size: 28px; font-weight: 800; color: #0a192f; margin: 0 0 4px; letter-spacing: -0.6px; line-height: 1.2;">FineTech</h1>
            <p style="color: #64748b; font-size: 14px; font-weight: 500; margin: 0; letter-spacing: 0.2px;">Inventory System</p>
          </div>

          <!-- Login Form -->
          <form id="login-form">
            <div class="form-group" style="margin-bottom: 18px;">
              <label class="form-label" style="font-size: 13.5px; font-weight: 600; color: #1e293b; margin-bottom: 6px; display: block;">Username</label>
              <input type="text" id="login-username" name="username" class="form-control" required autofocus placeholder="" style="height: 44px; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 14px; padding: 0 14px; background: #ffffff; width: 100%; transition: border-color 0.2s, box-shadow 0.2s;">
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label" style="font-size: 13.5px; font-weight: 600; color: #1e293b; margin-bottom: 6px; display: block;">Password</label>
              <input type="password" id="login-password" name="password" class="form-control" required placeholder="" style="height: 44px; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 14px; padding: 0 14px; background: #ffffff; width: 100%; transition: border-color 0.2s, box-shadow 0.2s;">
            </div>

            <div class="form-group" style="display: flex; align-items: center; gap: 9px; margin-top: 4px; margin-bottom: 22px;">
              <input type="checkbox" id="login-remember" name="remember" style="width: 17px; height: 17px; cursor: pointer; accent-color: #635bff; border-radius: 4px;">
              <label for="login-remember" style="font-size: 13.5px; font-weight: 500; color: #64748b; cursor: pointer; user-select: none;">Remember me</label>
            </div>

            <div id="login-error" class="form-error" style="display: none; margin-bottom: 16px; padding: 10px 14px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 13px; text-align: center;"></div>

            <button type="submit" id="login-submit-btn" class="btn btn-primary" style="width: 100%; height: 46px; font-size: 15px; font-weight: 600; border-radius: 10px; background: linear-gradient(135deg, #635bff 0%, #4f46e5 100%); border: none; color: #ffffff; cursor: pointer; box-shadow: 0 4px 14px rgba(99, 91, 255, 0.35); transition: opacity 0.2s, transform 0.1s;">
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
