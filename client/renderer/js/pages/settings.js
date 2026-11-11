const SettingsPage = {
  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px;">System Settings & Data Resilience</h1>
        <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Automated local backups, server connectivity, and disaster recovery restore</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 24px; max-width: 800px;">
        <!-- Server Connection -->
        <div class="card">
          <h3 class="card-title" style="margin-bottom: 8px;">API Server Connection</h3>
          <p style="color: var(--neutral); font-size: 13px; margin-bottom: 16px;">
            The central StockFlow API backend URL this desktop client communicates with.
          </p>
          <div class="form-row">
            <div class="form-group" style="flex: 3;">
              <input type="text" id="settings-server-url" class="form-control" value="http://localhost:3000">
            </div>
            <div style="flex: 1;">
              <button class="btn btn-secondary" id="save-server-url-btn" style="height: 38px; width: 100%;">Save URL</button>
            </div>
          </div>
        </div>

        <!-- Automated Local Backup (Admin only) -->
        <div class="card admin-only">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h3 class="card-title">Automated Local JSON Backup</h3>
            <span id="backup-badge-status" class="chip chip-neutral">Checking...</span>
          </div>
          <p style="color: var(--neutral); font-size: 13px; margin-bottom: 16px;">
            Automatically creates snapshots of your entire inventory, ledgers, users, and BOM to your local disk whenever data changes. Stored locally on your machine for privacy and safety.
          </p>

          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 12.5px; color: var(--neutral); font-weight: 500;">Designated Storage Folder:</span>
              <button class="btn btn-secondary btn-sm" id="choose-backup-folder-btn">Choose Backup Folder</button>
            </div>
            <div id="backup-folder-path" class="mono" style="font-size: 12.5px; word-break: break-all; color: var(--secondary);">
              Not configured
            </div>

            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; gap: 24px; font-size: 12px; color: var(--text-secondary);">
              <div>Last backup run: <strong id="backup-last-time">-</strong></div>
              <div>Backed-up revision: <strong id="backup-last-rev">-</strong></div>
            </div>
          </div>

          <button class="btn btn-primary" id="run-backup-now-btn">
            Run Backup Now
          </button>
        </div>

        <!-- Disaster Recovery Restore (Admin only) -->
        <div class="card admin-only" style="border-color: #FED7D7;">
          <h3 class="card-title" style="color: #9B2C2C; margin-bottom: 8px;">Disaster Recovery Restore</h3>
          <p style="color: var(--neutral); font-size: 13px; margin-bottom: 16px;">
            Replace all data in the database from a verified JSON backup snapshot. Restores users, units, materials, incoming challans, and outgoing rows in a single atomic transaction.
          </p>

          <div style="background: #FFF5F5; border: 1px solid #FEB2B2; border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px; font-size: 12.5px; color: #9B2C2C;">
            &excl; <strong>Warning:</strong> Restoring will wipe existing database records and replace them with the backup's state. Typing <code>RESTORE</code> will be required to confirm.
          </div>

          <button class="btn btn-danger" id="start-restore-btn">
            Restore From Backup File 
          </button>
        </div>
      </div>
    `;

    document.getElementById('choose-backup-folder-btn').onclick = () => this.chooseBackupFolder();
    document.getElementById('run-backup-now-btn').onclick = () => this.runBackupNow();
    document.getElementById('start-restore-btn').onclick = () => this.startRestoreFlow();
    document.getElementById('save-server-url-btn').onclick = () => this.saveServerUrl();

    await this.loadConfig();
  },

  async loadConfig() {
    if (!window.api) return;

    const cfg = await window.api.getSettings();
    if (cfg && cfg.API_BASE_URL) {
      const input = document.getElementById('settings-server-url');
      if (input) input.value = cfg.API_BASE_URL;
    }

    if (window.api.getBackupStatus) {
      const status = await window.api.getBackupStatus();
      this.updateBackupDisplay(status);
    }
  },

  updateBackupDisplay(status) {
    const folderEl = document.getElementById('backup-folder-path');
    const timeEl = document.getElementById('backup-last-time');
    const revEl = document.getElementById('backup-last-rev');
    const badge = document.getElementById('backup-badge-status');
    if (!folderEl) return;

    folderEl.textContent = status.backupFolder || 'No folder selected. Please choose a folder to enable backups.';
    timeEl.textContent = status.lastRunTime ? Format.dateTime(status.lastRunTime) : 'Never';
    revEl.textContent = status.lastBackedUpRevision !== null ? status.lastBackedUpRevision : '-';

    if (status.status === 'ok') {
      badge.className = 'chip chip-success';
      badge.textContent = 'Active & Up to Date';
    } else if (status.status === 'error') {
      badge.className = 'chip chip-error';
      badge.textContent = status.lastError || 'Error';
    } else if (status.status === 'running') {
      badge.className = 'chip chip-warning';
      badge.textContent = 'Backing up...';
    } else {
      badge.className = 'chip chip-neutral';
      badge.textContent = 'Idle (No Folder)';
    }
  },

  async chooseBackupFolder() {
    const res = await window.api.chooseBackupFolder();
    if (!res.canceled) {
      Toast.show(`Backup folder set to: ${res.folderPath}`, 'success');
      const status = await window.api.getBackupStatus();
      this.updateBackupDisplay(status);
    }
  },

  async runBackupNow() {
    const btn = document.getElementById('run-backup-now-btn');
    btn.disabled = true;
    btn.textContent = 'Backing up...';

    try {
      const status = await window.api.runBackupNow();
      this.updateBackupDisplay(status);
      if (status.status === 'ok') {
        Toast.show('Backup completed successfully!', 'success');
      } else {
        Toast.show(status.lastError || 'Backup failed', 'error');
      }
    } catch (err) {
      Toast.show(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Run Backup Now';
    }
  },

  async saveServerUrl() {
    const input = document.getElementById('settings-server-url');
    const newUrl = input.value.trim();
    if (!newUrl) return;

    await window.api.saveSettings({ API_BASE_URL: newUrl });
    Toast.show('Server URL updated', 'success');
  },

  async startRestoreFlow() {
    const inspectRes = await window.api.inspectRestoreFile();
    if (inspectRes.canceled) return;

    if (inspectRes.error) {
      Toast.show(`Invalid backup: ${inspectRes.error}`, 'error');
      return;
    }

    const { filePath, info } = inspectRes;
    const { counts } = info;

    Modal.open({
      title: 'Confirm Database Restore',
      bodyHtml: `
        <div>
          <p style="margin-bottom: 12px; font-size: 13.5px; color: var(--text-secondary);">
            Snapshot Exported: <strong>${Format.dateTime(info.exportedAt)}</strong> &bull; Revision: <strong>${info.revision}</strong>
          </p>

          <div style="background: var(--surface); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border); font-size: 12.5px; margin-bottom: 16px;">
            &bull; Materials: <strong>${counts.materials}</strong><br>
            &bull; Incoming entries: <strong>${counts.incomingEntries}</strong><br>
            &bull; Outgoing transactions: <strong>${counts.outgoingTransactions}</strong><br>
            &bull; Parties: <strong>${counts.parties}</strong> | Products: <strong>${counts.products}</strong><br>
            &bull; Users: <strong>${counts.users}</strong>
          </div>

          <div class="form-group">
            <label class="form-label" style="color: var(--error);">Type "RESTORE" to confirm complete database overwrite:</label>
            <input type="text" id="restore-confirm-input" class="form-control" placeholder="RESTORE" autocomplete="off">
          </div>
        </div>
      `,
      confirmText: 'Restore All Data',
      onConfirm: async () => {
        const input = document.getElementById('restore-confirm-input');
        if (input.value.trim() !== 'RESTORE') {
          Toast.show('You must type RESTORE exactly to proceed', 'error');
          return false;
        }

        const res = await window.api.confirmRestore(filePath);
        if (res.success) {
          Toast.show('Database restore completed successfully!', 'success', 6000);
          Router.navigate('dashboard');
          return true;
        }
        return false;
      },
    });
  },
};

