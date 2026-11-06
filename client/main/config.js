const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEFAULTS = {
  API_BASE_URL: 'http://localhost:3000',
  SYNC_FALLBACK_POLL_MS: 5000,
  BACKUP_CHECK_INTERVAL_MS: 120000,
  BACKUP_DAILY_KEEP: 30,
  BACKUP_FOLDER: '',
};

function getSettingsFilePath() {
  try {
    const userDataPath = app ? app.getPath('userData') : path.resolve(__dirname, '../../.tmp_user_data');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, 'settings.json');
  } catch (err) {
    return path.resolve(__dirname, 'settings.json');
  }
}

function loadSavedSettings() {
  const filePath = getSettingsFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Failed to parse settings.json:', err);
    }
  }
  return {};
}

function saveSettings(newSettings) {
  const filePath = getSettingsFilePath();
  const current = loadSavedSettings();
  const updated = { ...current, ...newSettings };
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

function getConfig() {
  const saved = loadSavedSettings();
  return {
    API_BASE_URL: saved.API_BASE_URL || process.env.API_BASE_URL || DEFAULTS.API_BASE_URL,
    SYNC_FALLBACK_POLL_MS: Number(saved.SYNC_FALLBACK_POLL_MS || process.env.SYNC_FALLBACK_POLL_MS || DEFAULTS.SYNC_FALLBACK_POLL_MS),
    BACKUP_CHECK_INTERVAL_MS: Number(saved.BACKUP_CHECK_INTERVAL_MS || process.env.BACKUP_CHECK_INTERVAL_MS || DEFAULTS.BACKUP_CHECK_INTERVAL_MS),
    BACKUP_DAILY_KEEP: Number(saved.BACKUP_DAILY_KEEP || process.env.BACKUP_DAILY_KEEP || DEFAULTS.BACKUP_DAILY_KEEP),
    BACKUP_FOLDER: saved.BACKUP_FOLDER || DEFAULTS.BACKUP_FOLDER,
  };
}

module.exports = {
  getConfig,
  loadSavedSettings,
  saveSettings,
  getSettingsFilePath,
};

