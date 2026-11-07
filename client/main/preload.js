const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),
  me: () => ipcRenderer.invoke('auth:me'),

  // Generic secure API request (only /api/* permitted)
  request: (options) => ipcRenderer.invoke('api:request', options),

  // Calculation preview helper
  calcDeducted: (options) => ipcRenderer.invoke('calc:deducted', options),

  // Sync & Realtime events
  onSyncEvent: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('sync:event', handler);
    return () => ipcRenderer.removeListener('sync:event', handler);
  },
  onConnectionStatus: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('sync:status', handler);
    return () => ipcRenderer.removeListener('sync:status', handler);
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // Excel Part 3 functions
  exportMaterial: (materialId) => ipcRenderer.invoke('excel:exportMaterial', { materialId }),
  exportPartyBom: (partyId) => ipcRenderer.invoke('excel:exportPartyBom', { partyId }),
  exportAll: () => ipcRenderer.invoke('excel:exportAll'),
  exportFromBackup: () => ipcRenderer.invoke('excel:exportFromBackup'),
  parseMaterialSheet: (material, customColumnMap) => ipcRenderer.invoke('excel:parseMaterialSheet', { material, customColumnMap }),
  parseBomSheet: (existingMaterials) => ipcRenderer.invoke('excel:parseBomSheet', { existingMaterials }),

  // Backup & Restore Part 3 functions
  chooseBackupFolder: () => ipcRenderer.invoke('backup:chooseFolder'),
  getBackupStatus: () => ipcRenderer.invoke('backup:getStatus'),
  runBackupNow: () => ipcRenderer.invoke('backup:runNow'),
  inspectRestoreFile: () => ipcRenderer.invoke('backup:inspectFile'),
  confirmRestore: (filePath) => ipcRenderer.invoke('backup:confirmRestore', { filePath }),
});

