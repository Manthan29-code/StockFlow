const { safeStorage } = require('electron');
const { loadSavedSettings, saveSettings } = require('./config');

let currentToken = null;
let currentUser = null;

function encryptToken(token) {
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(token).toString('base64');
  }
  return Buffer.from(token, 'utf8').toString('base64');
}

function decryptToken(encryptedBase64) {
  try {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buffer);
    }
    return buffer.toString('utf8');
  } catch (err) {
    console.error('Failed to decrypt saved token:', err);
    return null;
  }
}

function setSession(token, user, remember = false) {
  currentToken = token;
  currentUser = user;

  if (remember && token) {
    const encrypted = encryptToken(token);
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

function getToken() {
  if (currentToken) return currentToken;

  const saved = loadSavedSettings();
  if (saved.savedToken) {
    currentToken = decryptToken(saved.savedToken);
    currentUser = saved.savedUser || null;
  }
  return currentToken;
}

function getCurrentUser() {
  if (currentUser) return currentUser;
  const saved = loadSavedSettings();
  return saved.savedUser || null;
}

function isAuthenticated() {
  return Boolean(getToken());
}

module.exports = {
  setSession,
  clearSession,
  getToken,
  getCurrentUser,
  isAuthenticated,
};

