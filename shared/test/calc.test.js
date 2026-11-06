import { describe, it, expect } from 'vitest';
const {
  calculateDeducted,
  calculateEntryLedger,
  validateRunningBalances,
  calculateMaterialStock,
  calculateBomRequirements,
  DEDUCT_BY,
  ENTRY_STATUS,
} = require('../index');

describe('shared/calc - Example Material A (Round Bar 20mm)', () => {
  it('should accurately calculate deducted amount for 235 x 0.59 = 138.65', () => {
    const result = calculateDeducted({
      deductBy: DEDUCT_BY.QTY_X_PIECE_WEIGHT,
      qty: '235',
      pieceWeight: '0.59',
    });
    expect(result.deducted).toBe('138.65');
    expect(result.totalWeight).toBe('138.65');
  });

  it('should compute exact running balances for Material A sample rows', () => {
    const incomingEntry = {
      quantity: '650',
      deductBy: DEDUCT_BY.QTY_X_PIECE_WEIGHT,
    };

    const outgoingRows = [
      { outDate: '2024-11-25', rowNo: 1, challanNo: '690', specValue: '271', qty: 85, pieceWeight: '0.7' },
      { outDate: '2024-11-27', rowNo: 1, challanNo: '695', specValue: '271', qty: 100, pieceWeight: '0.7' },
      { outDate: '2024-11-28', rowNo: 1, challanNo: '698', specValue: '271', qty: 115, pieceWeight: '0.7' },
      { outDate: '2024-11-28', rowNo: 2, challanNo: '698', specValue: '225.5', qty: 235, pieceWeight: '0.59' },
      { outDate: '2024-11-29', rowNo: 1, challanNo: '703', specValue: '271', qty: 104, pieceWeight: '0.7' },
      { outDate: '2024-12-04', rowNo: 1, challanNo: '714', specValue: '271', qty: 124, pieceWeight: '0.7' },
      { outDate: '2024-12-09', rowNo: 1, challanNo: '727', specValue: '225.5', qty: 240, pieceWeight: '0.59' },
    ];

    const ledger = calculateEntryLedger(incomingEntry, outgoingRows, DEDUCT_BY.QTY_X_PIECE_WEIGHT);

    expect(ledger.rows.map((r) => r.runningBalance)).toEqual([
      '590.5',
      '520.5',
      '440',
      '301.35',
      '228.55',
      '141.75',
      '0.15',
    ]);
    expect(ledger.finalBalance).toBe('0.15');
    expect(ledger.status).toBe(ENTRY_STATUS.PARTIAL);
  });
});

describe('shared/calc - Example Material B (Rotor Die Cast 58x60 ULTRA)', () => {
  it('should compute exact running balances for all 3 entries of Material B', () => {
    // Entry 1
    const entry1 = { quantity: '500' };
    const rows1 = [
      { outDate: '2024-11-28', rowNo: 1, challanNo: '698', qty: 235 },
      { outDate: '2024-12-09', rowNo: 1, challanNo: '727', qty: 264 },
      { outDate: '2024-12-16', rowNo: 1, challanNo: '747', qty: 1 },
    ];
    const ledger1 = calculateEntryLedger(entry1, rows1, DEDUCT_BY.DIRECT);
    expect(ledger1.rows.map((r) => r.runningBalance)).toEqual(['265', '1', '0']);
    expect(ledger1.finalBalance).toBe('0');
    expect(ledger1.status).toBe(ENTRY_STATUS.CLOSED);

    // Entry 2
    const entry2 = { quantity: '620' };
    const rows2 = [
      { outDate: '2024-12-16', rowNo: 1, challanNo: '747', qty: 315 },
      { outDate: '2024-12-18', rowNo: 1, challanNo: '751', qty: 55 },
      { outDate: '2024-12-27', rowNo: 1, challanNo: '776', qty: 250 },
    ];
    const ledger2 = calculateEntryLedger(entry2, rows2, DEDUCT_BY.DIRECT);
    expect(ledger2.rows.map((r) => r.runningBalance)).toEqual(['305', '250', '0']);
    expect(ledger2.finalBalance).toBe('0');
    expect(ledger2.status).toBe(ENTRY_STATUS.CLOSED);

    // Entry 3
    const entry3 = { quantity: '541' };
    const rows3 = [
      { outDate: '2025-01-02', rowNo: 1, challanNo: '788', qty: 20 },
      { outDate: '2025-01-04', rowNo: 1, challanNo: '793', qty: 180 },
      { outDate: '2025-01-10', rowNo: 1, challanNo: '810', qty: 341 },
    ];
    const ledger3 = calculateEntryLedger(entry3, rows3, DEDUCT_BY.DIRECT);
    expect(ledger3.rows.map((r) => r.runningBalance)).toEqual(['521', '341', '0']);
    expect(ledger3.finalBalance).toBe('0');
    expect(ledger3.status).toBe(ENTRY_STATUS.CLOSED);
  });
});

describe('shared/calc - Material stock & BOM requirements', () => {
  it('should sum all entry balances for material total stock', () => {
    const entries = [
      { balance: '500' },
      { balance: '0.15' },
      { balance: '120.75' },
    ];
    expect(calculateMaterialStock(entries)).toBe('620.9');
  });

  it('should calculate BOM requirements and shortfalls correctly', () => {
    const bomLines = [
      { materialId: 'mat-a', consumption: '0.700' },
      { materialId: 'mat-b', consumption: '1' },
    ];

    const stockByMaterial = {
      'mat-a': '50',
      'mat-b': '150',
    };

    const requirements = calculateBomRequirements(bomLines, '100', stockByMaterial);

    // mat-a needs 70, stock is 50 -> shortfall 20
    expect(requirements[0].required).toBe('70');
    expect(requirements[0].availableStock).toBe('50');
    expect(requirements[0].shortfall).toBe('20');
    expect(requirements[0].isShort).toBe(true);

    // mat-b needs 100, stock is 150 -> shortfall 0
    expect(requirements[1].required).toBe('100');
    expect(requirements[1].availableStock).toBe('150');
    expect(requirements[1].shortfall).toBe('0');
    expect(requirements[1].isShort).toBe(false);
  });

  it('validates running balances and detects over-issue', () => {
    const rows = [
      { outDate: '2024-01-01', rowNo: 1, qty: '50' },
      { outDate: '2024-01-02', rowNo: 1, qty: '60' },
    ];
    const validation = validateRunningBalances('100', rows, DEDUCT_BY.DIRECT);
    expect(validation.valid).toBe(false);
    expect(validation.failedAtRowIndex).toBe(1);
    expect(validation.minBalance).toBe('-10');
  });

  it('handles generic materials with other units and modes', () => {
    const genericEntry = { quantity: '1000' };
    const genericRows = [
      { outDate: '2026-03-01', rowNo: 1, qty: '250.5' },
      { outDate: '2026-03-02', rowNo: 1, qty: '120' },
    ];
    const ledger = calculateEntryLedger(genericEntry, genericRows, DEDUCT_BY.DIRECT);
    expect(ledger.finalBalance).toBe('629.5');
    expect(ledger.status).toBe(ENTRY_STATUS.PARTIAL);
  });
});

