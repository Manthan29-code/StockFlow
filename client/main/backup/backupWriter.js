const fs = require('fs');
const path = require('path');

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Writes backup atomically to folder
 * @param {string} folderPath 
 * @param {Object} backupData 
 * @param {number} dailyKeepDays 
 */
function writeBackup(folderPath, backupData, dailyKeepDays = 30) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const jsonString = JSON.stringify(backupData, null, 2);

  // 1. Write inventory-latest.json atomically (temp file -> rename)
  const latestPath = path.join(folderPath, 'inventory-latest.json');
  const tempPath = path.join(folderPath, 'inventory-latest.json.tmp');

  fs.writeFileSync(tempPath, jsonString, 'utf8');
  fs.renameSync(tempPath, latestPath);

  // 2. Write daily snapshot: inventory-YYYY-MM-DD.json
  const todayStr = getTodayDateString();
  const dailyPath = path.join(folderPath, `inventory-${todayStr}.json`);
  fs.writeFileSync(dailyPath, jsonString, 'utf8');

  // 3. Prune daily files older than dailyKeepDays
  pruneDailySnapshots(folderPath, dailyKeepDays);

  return {
    latestPath,
    dailyPath,
  };
}

function pruneDailySnapshots(folderPath, keepDays) {
  try {
    const files = fs.readdirSync(folderPath);
    const now = Date.now();
    const maxAgeMs = keepDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const match = file.match(/^inventory-(\d{4}-\d{2}-\d{2})\.json$/);
      if (match) {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      }
    }
  } catch (err) {
    console.error('Failed to prune old backup files:', err);
  }
}

module.exports = {
  writeBackup,
  pruneDailySnapshots,
  getTodayDateString,
};

