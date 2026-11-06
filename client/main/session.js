const { safeStorage } = require('electron');
const { loadSavedSettings, saveSettings } = require('./config');

let currentToken = null;
let currentUser = null;

async function encryptToken(token) {
  try {
    if (safeStorage) {
      if (typeof safeStorage.isAsyncEncryptionAvailable === 'function' && typeof safeStorage.encryptStringAsync === 'function') {
        const available = await safeStorage.isAsyncEncryptionAvailable();
        if (available) {
          const buf = await safeStorage.encryptStringAsync(token);
          return buf.toString('base64');
        }
      } else if (typeof safeStorage.isEncryptionAvailable === 'function') {
        if (safeStorage.isEncryptionAvailable()) {
          return safeStorage.encryptString(token).toString('base64');
        }
      }
    }
  } catch (err) {
    console.error('Failed to encrypt token with safeStorage:', err);
  }
  return Buffer.from(token, 'utf8').toString('base64');
}

async function decryptToken(encryptedBase64) {
  try {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    if (safeStorage) {
      if (typeof safeStorage.isAsyncEncryptionAvailable === 'function' && typeof safeStorage.decryptStringAsync === 'function') {
        const available = await safeStorage.isAsyncEncryptionAvailable();
        if (available) {
          return await safeStorage.decryptStringAsync(buffer);
        }
      } else if (typeof safeStorage.isEncryptionAvailable === 'function') {
        if (safeStorage.isEncryptionAvailable()) {
          return safeStorage.decryptString(buffer);
        }
      }
    }
    return buffer.toString('utf8');
  } catch (err) {
    console.error('Failed to decrypt saved token:', err);
    return null;
  }
}

async function setSession(token, user, remember = false) {
  currentToken = token;
  currentUser = user;

  if (remember && token) {
    const encrypted = await encryptToken(token);
    saveSettings({ savedToken: encrypted, savedUser: user });
  } else if (!remember) {
    saveSettings({ savedToken: null, savedUser: null });
  }
}

function clearSession() {
  currentToken = null;
  currentUser = null;
  saveSettings({ savedToken: null, savedUser: null });
}

async function initSession() {
  const saved = loadSavedSettings();
  if (saved.savedToken) {
    currentToken = await decryptToken(saved.savedToken);
    currentUser = saved.savedUser || null;
  }
}

function getToken() {
  if (currentToken) return currentToken;
  // Fallback if not initialized yet
  const saved = loadSavedSettings();
  if (saved.savedToken) {
    try {
      const buffer = Buffer.from(saved.savedToken, 'base64');
      return buffer.toString('utf8');
    } catch (e) {
      return null;
    }
  }
  return null;
}

function getCurrentUser() {
  if (currentUser) return currentUser;
  const saved = loadSavedSettings();
  return saved.savedUser || null;
}

function isAuthenticated() {
  return Boolean(currentToken);
}

module.exports = {
  initSession,
  setSession,
  clearSession,
  getToken,
  getCurrentUser,
  isAuthenticated,
};
