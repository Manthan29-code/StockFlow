const { getConfig, saveSettings } = require('../config');
const { request } = require('../httpClient');
const { getCurrentUser } = require('../session');
const { writeBackup } = require('./backupWriter');
const { ROLES } = require('@stockflow/shared');

class BackupScheduler {
  constructor() {
    this.timer = null;
    this.isRunning = false;
    this.status = {
      lastRunTime: null,
      lastBackedUpRevision: null,
      status: 'idle', // 'idle' | 'running' | 'ok' | 'error'
      lastError: null,
    };
  }

  start() {
    this.stop();
    const config = getConfig();
    const intervalMs = config.BACKUP_CHECK_INTERVAL_MS || 120000;

    // Run first check soon after starting
    setTimeout(() => this.checkAndBackup(), 5000);

    this.timer = setInterval(() => {
      this.checkAndBackup();
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async checkAndBackup(force = false) {
    if (this.isRunning) return;

    const user = getCurrentUser();
    if (!user || user.role !== ROLES.ADMIN) {
      return;
    }

    const config = getConfig();
    if (!config.BACKUP_FOLDER) {
      this.status.status = 'idle';
      this.status.lastError = 'No backup folder selected';
      return;
    }

    this.isRunning = true;
    this.status.status = 'running';

    try {
      // 1. Check revision
      const revRes = await request({ method: 'GET', path: '/api/sync/revision' });
      const currentRev = revRes.revision;

      const lastBackedUpRevision = this.status.lastBackedUpRevision;

      // Only backup if revision is higher, or if forced
      if (force || lastBackedUpRevision === null || currentRev > lastBackedUpRevision) {
        // 2. Fetch full backup JSON
        const backupData = await request({ method: 'GET', path: '/api/admin/backup' });

        // 3. Write files
        writeBackup(config.BACKUP_FOLDER, backupData, config.BACKUP_DAILY_KEEP);

        this.status.lastRunTime = new Date().toISOString();
        this.status.lastBackedUpRevision = currentRev;
        this.status.status = 'ok';
        this.status.lastError = null;

        saveSettings({
          lastBackedUpRevision: currentRev,
          lastBackupTime: this.status.lastRunTime,
        });
      } else {
        this.status.status = 'ok';
        this.status.lastError = null;
      }
    } catch (err) {
      this.status.status = 'error';
      this.status.lastError = err.message || 'Backup failed';
      console.error('BackupScheduler error:', err);
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      ...this.status,
      backupFolder: getConfig().BACKUP_FOLDER,
    };
  }
}

const backupScheduler = new BackupScheduler();

module.exports = {
  backupScheduler,
};

