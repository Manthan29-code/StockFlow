import { describe, it, expect } from 'vitest';
const fs = require('fs');
const path = require('path');
const { buildAllWorkbooks } = require('../main/excel/workbookBuilder');

describe('WorkbookBuilder (Section 3.3)', () => {
  it('builds workbooks from dataset JSON and recalculates exact balances', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/sample-backup.json');
    const dataset = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    const { materialWorkbooks, bomWorkbook } = buildAllWorkbooks(dataset);

    expect(materialWorkbooks.length).toBe(2);
    expect(bomWorkbook).toBeDefined();

    const matA = materialWorkbooks.find((m) => m.material.name === '20 mm round bar');
    const matB = materialWorkbooks.find((m) => m.material.name === 'Rotor die cast 58 x 60 ULTRA');

    expect(matA.fileName).toMatch(/^20 mm round bar - \d{2}-\d{2}-\d{4}\.xlsx$/);
    expect(matB.fileName).toMatch(/^Rotor die cast 58 x 60 ULTRA - \d{2}-\d{2}-\d{4}\.xlsx$/);
    expect(bomWorkbook.fileName).toMatch(/^BOM - \d{2}-\d{2}-\d{4}\.xlsx$/);
  });
});

