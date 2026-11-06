const fs = require('fs');
const { request } = require('../httpClient');

/**
 * Validates a backup JSON file and restores it to the server
 * @param {string} filePath 
 * @returns {Promise<any>}
 */
async function restoreFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Backup file does not exist');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let backupPayload;
  try {
    backupPayload = JSON.parse(raw);
  } catch (err) {
    throw new Error('File is not valid JSON');
  }

  if (!backupPayload || backupPayload.formatVersion !== 1 || !backupPayload.data) {
    throw new Error('Unsupported backup file format. Expected formatVersion 1.');
  }

  return await request({
    method: 'POST',
    path: '/api/admin/restore',
    body: backupPayload,
  });
}

function inspectBackupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Backup file does not exist');
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const backup = JSON.parse(raw);

  if (backup.formatVersion !== 1) {
    throw new Error(`Invalid formatVersion (${backup.formatVersion})`);
  }

  const data = backup.data || {};
  return {
    formatVersion: backup.formatVersion,
    exportedAt: backup.exportedAt,
    revision: backup.revision,
    counts: {
      materials: (data.materials || []).length,
      incomingEntries: (data.incoming_entries || []).length,
      outgoingTransactions: (data.outgoing_transactions || []).length,
      parties: (data.parties || []).length,
      products: (data.products || []).length,
      users: (data.users || []).length,
    },
  };
}

module.exports = {
  restoreFromFile,
  inspectBackupFile,
};

