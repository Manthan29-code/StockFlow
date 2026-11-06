import { describe, it, expect } from 'vitest';
const { normalizeDate, normalizeText, normalizeNumber } = require('../main/excel/importParser');

describe('ImportParser Normalization Functions (Section 3.4)', () => {
  it('normalizes various date formats to YYYY-MM-DD', () => {
    expect(normalizeDate('25-11-2024')).toBe('2024-11-25');
    expect(normalizeDate('25/11/2024')).toBe('2024-11-25');
    expect(normalizeDate('2024-11-25')).toBe('2024-11-25');

    const d = new Date(Date.UTC(2025, 0, 2));
    expect(normalizeDate(d)).toBe('2025-01-02');
  });

  it('normalizes text and preserves alphanumeric challans', () => {
    expect(normalizeText(' 24/1596 ')).toBe('24/1596');
    expect(normalizeText({ text: '698' })).toBe('698');
  });

  it('normalizes numbers stripping commas and formatting', () => {
    expect(normalizeNumber(' 1,234.50 ')).toBe('1234.50');
    expect(normalizeNumber('0.59')).toBe('0.59');
    expect(normalizeNumber(null)).toBeNull();
  });
});

