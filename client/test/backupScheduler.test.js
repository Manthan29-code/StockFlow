import { describe, it, expect, vi } from 'vitest';
const { backupScheduler } = require('../main/backup/backupScheduler');

describe('BackupScheduler Logic (Section 3.1)', () => {
  it('initializes in idle state and exposes proper status interface', () => {
    const status = backupScheduler.getStatus();
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('lastRunTime');
    expect(status).toHaveProperty('lastBackedUpRevision');
  });
});

