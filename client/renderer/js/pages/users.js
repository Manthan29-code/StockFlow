const UsersPage = {
  users: [],

  async render(container) {
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h1 style="font-size: 22px;">User Access & Security</h1>
          <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Manage operator accounts, administrator roles, and permissions</p>
        </div>
        <button class="btn btn-primary btn-sm" id="create-user-btn">+ Create User</button>
      </div>

      <div class="card" style="padding: 0; overflow: hidden;">
        <div id="users-table-container">
          <div style="text-align: center; padding: 30px; color: var(--neutral);">Loading users...</div>
        </div>
      </div>
    `;

    document.getElementById('create-user-btn').onclick = () => this.openCreateUserModal();
    await this.loadUsers();
  },

  async loadUsers() {
    const container = document.getElementById('users-table-container');
    if (!container) return;

    try {
      const users = await Api.get('/api/users');
      this.users = users;

      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created At</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((u) => `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    ${Badge.render(u, u.createdAt)}
                    <span style="font-weight: 600; color: var(--secondary);">${u.username}</span>
                  </div>
                </td>
                <td>
                  <span class="chip ${u.role === 'admin' ? 'chip-success' : 'chip-neutral'}">
                    ${u.role.toUpperCase()}
                  </span>
                </td>
                <td>
                  <span class="chip ${u.isActive ? 'chip-success' : 'chip-error'}">
                    ${u.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>${Format.dateTime(u.createdAt)}</td>
                <td style="text-align: right; white-space: nowrap;">
                  <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
                    <button class="btn btn-secondary btn-sm toggle-role-btn" data-id="${u.id}" data-role="${u.role}">
                      Make ${u.role === 'admin' ? 'Staff' : 'Admin'}
                    </button>
                    <button class="btn btn-secondary btn-sm toggle-active-btn" data-id="${u.id}" data-active="${u.isActive}">
                      ${u.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button class="btn btn-secondary btn-sm reset-pwd-btn" data-id="${u.id}">Reset Password</button>
                    <button class="btn btn-secondary btn-sm delete-user-btn" style="color: var(--error);" data-id="${u.id}" data-username="${u.username}">Delete</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.querySelectorAll('.toggle-role-btn').forEach((btn) => {
        btn.onclick = () => this.toggleUserRole(btn.getAttribute('data-id'), btn.getAttribute('data-role'));
      });

      container.querySelectorAll('.toggle-active-btn').forEach((btn) => {
        btn.onclick = () => this.toggleUserActive(btn.getAttribute('data-id'), btn.getAttribute('data-active') === 'true');
      });

      container.querySelectorAll('.reset-pwd-btn').forEach((btn) => {
        btn.onclick = () => this.openResetPasswordModal(btn.getAttribute('data-id'));
      });

      container.querySelectorAll('.delete-user-btn').forEach((btn) => {
        btn.onclick = () => this.confirmDeleteUser(btn.getAttribute('data-id'), btn.getAttribute('data-username'));
      });
    } catch (err) {
      container.innerHTML = `<div style="color: var(--error); padding: 20px;">${err.message}</div>`;
    }
  },

  openCreateUserModal() {
    Modal.open({
      title: 'Create Operator User',
      bodyHtml: `
        <form id="create-user-form">
          <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" name="username" class="form-control" placeholder="e.g. ramesh" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" name="password" class="form-control" placeholder="Minimum 6 characters" required>
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <select name="role" class="form-control" required>
              <option value="staff">Staff (Issue stock, record incoming, calculate BOM)</option>
              <option value="admin">Administrator (Full control, settings, restore)</option>
            </select>
          </div>
        </form>
      `,
      confirmText: 'Create User',
      onConfirm: async () => {
        const form = document.getElementById('create-user-form');
        await Api.post('/api/users', {
          username: form.username.value.trim(),
          password: form.password.value,
          role: form.role.value,
        });
        Toast.show('User created successfully', 'success');
        await this.loadUsers();
        return true;
      },
    });
  },

  async toggleUserRole(userId, currentRole) {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return;

    const newRole = currentRole === 'admin' ? 'staff' : 'admin';
    try {
      await Api.patch(`/api/users/${userId}`, {
        role: newRole,
        version: user.version,
      });
      Toast.show(`User role changed to ${newRole}`, 'info');
      await this.loadUsers();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  async toggleUserActive(userId, currentlyActive) {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return;

    try {
      await Api.patch(`/api/users/${userId}`, {
        isActive: !currentlyActive,
        version: user.version,
      });
      Toast.show(`User account ${!currentlyActive ? 'enabled' : 'disabled'}`, 'info');
      await this.loadUsers();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  openResetPasswordModal(userId) {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return;

    Modal.open({
      title: `Reset Password for ${user.username}`,
      bodyHtml: `
        <form id="reset-pwd-form">
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input type="password" name="newPassword" class="form-control" placeholder="Minimum 6 characters" required>
          </div>
        </form>
      `,
      confirmText: 'Reset Password',
      onConfirm: async () => {
        const form = document.getElementById('reset-pwd-form');
        await Api.post(`/api/users/${userId}/reset-password`, {
          newPassword: form.newPassword.value,
        });
        Toast.show(`Password reset for ${user.username}`, 'success');
        return true;
      },
    });
  },

  confirmDeleteUser(userId, username) {
    Modal.confirm({
      title: 'Delete User Account',
      messageHtml: `
        <p>Are you sure you want to permanently delete user <strong>${username}</strong>?</p>
        <p style="font-size: 12px; color: var(--neutral); margin-top: 8px;">
          Note: Users who have created inventory records cannot be deleted and should be disabled instead.
        </p>
      `,
      confirmText: 'Delete User',
      danger: true,
      onConfirm: async () => {
        try {
          await Api.delete(`/api/users/${userId}`);
          Toast.show(`User '${username}' deleted successfully`, 'success');
          await this.loadUsers();
          return true;
        } catch (err) {
          Toast.show(err.message || 'Failed to delete user', 'error');
          return true;
        }
      },
    });
  },
};

