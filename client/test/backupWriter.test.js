import { describe, it, expect, beforeEach, afterEach } from 'vitest';
const fs = require('fs');
const path = require('path');
const { writeBackup, pruneDailySnapshots } = require('../main/backup/backupWriter');

describe('BackupWriter Atomic Write & Rotation (Section 3.1)', () => {
  const testDir = path.resolve(__dirname, '../../.tmp_backup_test');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('performs atomic write (temp -> rename) leaving valid inventory-latest.json', () => {
    const data1 = { formatVersion: 1, revision: 1, data: { test: 'initial' } };
    writeBackup(testDir, data1, 30);

    const latestFile = path.join(testDir, 'inventory-latest.json');
    expect(fs.existsSync(latestFile)).toBe(true);
    expect(JSON.parse(fs.readFileSync(latestFile, 'utf8')).data.test).toBe('initial');

    // Simulate update
    const data2 = { formatVersion: 1, revision: 2, data: { test: 'updated' } };
    writeBackup(testDir, data2, 30);
    expect(JSON.parse(fs.readFileSync(latestFile, 'utf8')).data.test).toBe('updated');

    // Verify temp file is cleaned up after rename
    expect(fs.existsSync(path.join(testDir, 'inventory-latest.json.tmp'))).toBe(false);
  });

  it('removes daily snapshot files older than keep limit', () => {
    // Create an old daily backup file
    const oldDateStr = '2025-01-01';
    const oldFilePath = path.join(testDir, `inventory-${oldDateStr}.json`);
    fs.writeFileSync(oldFilePath, JSON.stringify({ formatVersion: 1, revision: 1 }));

    // Backdate mtime to 60 days ago
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    fs.utimesSync(oldFilePath, new Date(sixtyDaysAgo), new Date(sixtyDaysAgo));

    expect(fs.existsSync(oldFilePath)).toBe(true);

    // Prune with keep limit of 30 days
    pruneDailySnapshots(testDir, 30);

    // The old file should be deleted
    expect(fs.existsSync(oldFilePath)).toBe(false);
  });
});

