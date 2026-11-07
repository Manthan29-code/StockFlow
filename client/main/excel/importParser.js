const ExcelJS = require('exceljs');
const { calculateEntryLedger, toDecimal, DEDUCT_BY } = require('@stockflow/shared');

/**
 * Normalizes Excel cell date to YYYY-MM-DD
 */
function normalizeDate(cellValue) {
  if (!cellValue) return null;
  if (cellValue instanceof Date) {
    const y = cellValue.getUTCFullYear();
    const m = String(cellValue.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cellValue.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(cellValue).trim();

  // Match ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = String(isoMatch[2]).padStart(2, '0');
    const d = String(isoMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  return str;
}

function normalizeText(cellValue) {
  if (cellValue === null || cellValue === undefined) return '';
  if (typeof cellValue === 'object' && cellValue.text) {
    return String(cellValue.text).trim();
  }
  return String(cellValue).trim();
}

function normalizeNumber(cellValue) {
  if (cellValue === null || cellValue === undefined || cellValue === '') return null;
  if (typeof cellValue === 'object') {
    if (cellValue.result !== undefined && cellValue.result !== null) {
      cellValue = cellValue.result;
    } else if (cellValue.formula) {
      return null;
    }
  }
  const clean = String(cellValue).replace(/,/g, '').trim();
  const num = Number(clean);
  return isNaN(num) ? null : clean;
}

/**
 * Parses a material workbook buffer or filePath
 * @param {string|Buffer} source 
 * @param {Object} material - { name, deductBy, specLabel }
 * @param {Object} [customColumnMap] - optional user-adjusted column mapping
 */
async function parseMaterialWorkbook(source, material, customColumnMap = null) {
  const workbook = new ExcelJS.Workbook();
  if (typeof source === 'string') {
    await workbook.xlsx.readFile(source);
  } else {
    await workbook.xlsx.load(source);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Workbook contains no worksheets');
  }

  let headerRowIndex = -1;
  let detectedHeaders = {};

  // 1. Find Header Row
  worksheet.eachRow((row, rowNumber) => {
    if (headerRowIndex !== -1) return;
    const values = row.values;
    for (let colIdx = 1; colIdx < values.length; colIdx++) {
      const text = normalizeText(values[colIdx]).toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.includes('IN DATE') || text === 'DATE IN') {
        headerRowIndex = rowNumber;
        break;
      }
    }
  });

  if (headerRowIndex === -1) {
    throw new Error('Could not find header row (looking for "IN DATE")');
  }

  // 2. Detect Columns
  const headerRow = worksheet.getRow(headerRowIndex);
  const specLabelNorm = (material.specLabel || 'TL').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

  headerRow.eachCell((cell, colNumber) => {
    const rawText = normalizeText(cell.value);
    const text = rawText.toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    if (text.includes('IN DATE') || text === 'DATE IN') {
      detectedHeaders.inDate = colNumber;
    } else if (text.includes('CH NO IN') || text.includes('CHALLAN NO IN') || text.includes('CHALLAN IN') || text === 'CH NO') {
      if (!detectedHeaders.chNoIn) detectedHeaders.chNoIn = colNumber;
    } else if (text.includes('OUT DATE') || text === 'DATE OUT') {
      detectedHeaders.outDate = colNumber;
    } else if (text.includes('CH NO OUT') || text.includes('CHALLAN NO OUT') || text.includes('CHALLAN OUT') || text.includes('CH NO') && text.includes('OUT')) {
      detectedHeaders.chNoOut = colNumber;
    } else if (text === specLabelNorm || text === 'TL' || text.includes('LENGTH') || text.includes('SIZE')) {
      if (!detectedHeaders.specValue) detectedHeaders.specValue = colNumber;
    } else if (text === 'QTY' || text === 'OUT QTY' || text === 'QUANTITY' || text === 'PCS') {
      detectedHeaders.outQty = colNumber;
    } else if (text === 'WIGHT' || text === 'WEIGHT' || text === 'WT' || text.includes('PIECE') || text.includes('PC WT')) {
      if (!detectedHeaders.pieceWeight && detectedHeaders.outQty) {
        detectedHeaders.pieceWeight = colNumber;
      } else if (!detectedHeaders.inQty) {
        detectedHeaders.inQty = colNumber;
      }
    } else if (text.includes('TOTAL')) {
      detectedHeaders.totalWeight = colNumber;
    } else if (text.includes('BALANCE') || text.includes('BAL QTY') || text === 'BAL') {
      detectedHeaders.balance = colNumber;
    } else if (text.includes('IN QTY') || text.includes('QUANTITY') || text === 'WEIGHT' || text === 'WIGHT') {
      if (!detectedHeaders.inQty) detectedHeaders.inQty = colNumber;
    }
  });

  const columnMap = customColumnMap || detectedHeaders;

  if (!columnMap.inDate || !columnMap.chNoIn || !columnMap.inQty || !columnMap.outDate || !columnMap.chNoOut) {
    throw new Error('Could not map required columns from header row');
  }

  // 3. Parse Entries & Outgoing Rows
  const entries = [];
  let currentEntry = null;
  const warnings = [];
  const incomingChallans = new Set();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    const inDateRaw = columnMap.inDate ? row.getCell(columnMap.inDate).value : null;
    const chNoInRaw = columnMap.chNoIn ? row.getCell(columnMap.chNoIn).value : null;
    const inQtyRaw = columnMap.inQty ? row.getCell(columnMap.inQty).value : null;

    const outDateRaw = columnMap.outDate ? row.getCell(columnMap.outDate).value : null;
    const chNoOutRaw = columnMap.chNoOut ? row.getCell(columnMap.chNoOut).value : null;
    const outQtyRaw = columnMap.outQty ? row.getCell(columnMap.outQty).value : null;
    const pieceWeightRaw = columnMap.pieceWeight ? row.getCell(columnMap.pieceWeight).value : null;
    const specValueRaw = columnMap.specValue ? row.getCell(columnMap.specValue).value : null;
    const sheetBalanceRaw = columnMap.balance ? row.getCell(columnMap.balance).value : null;

    const inDate = normalizeDate(inDateRaw);
    const chNoIn = normalizeText(chNoInRaw);
    const inQty = normalizeNumber(inQtyRaw);

    const outDate = normalizeDate(outDateRaw);
    const chNoOut = normalizeText(chNoOutRaw);
    const outQty = normalizeNumber(outQtyRaw);
    const pieceWeight = normalizeNumber(pieceWeightRaw);
    const specValue = normalizeText(specValueRaw);
    const sheetBalance = normalizeNumber(sheetBalanceRaw);

    // Skip stray blank or balance-only rows (e.g. stray 0 row)
    if (!inDate && !outDate) {
      return;
    }

    // New Incoming Entry
    if (inDate && inQty) {
      if (incomingChallans.has(chNoIn)) {
        warnings.push(`Duplicate incoming challan '${chNoIn}' in sheet`);
      }
      incomingChallans.add(chNoIn);

      currentEntry = {
        rowNumber,
        inDate,
        challanNo: chNoIn,
        quantity: inQty,
        sheetBalance,
        outgoingRows: [],
      };
      entries.push(currentEntry);
    }

    // Outgoing Row belonging to current incoming entry
    if (outDate && currentEntry && (outQty || chNoOut)) {
      currentEntry.outgoingRows.push({
        rowNumber,
        outDate,
        challanNo: chNoOut,
        qty: outQty,
        pieceWeight,
        specValue: specValue || null,
        sheetBalance,
      });
    }
  });

  // 4. Validate & calculate balances
  const deductBy = material.deductBy || DEDUCT_BY.DIRECT;
  let totalEntries = entries.length;
  let totalRows = 0;

  for (const entry of entries) {
    totalRows += entry.outgoingRows.length;
    const ledger = calculateEntryLedger(
      { quantity: entry.quantity },
      entry.outgoingRows.map((r, i) => ({
        outDate: r.outDate,
        rowNo: i + 1,
        qty: r.qty,
        pieceWeight: r.pieceWeight,
        specValue: r.specValue,
      })),
      deductBy
    );

    entry.recalculatedBalance = ledger.finalBalance;
    entry.status = ledger.status;

    // Check sheet balance mismatch: only verify against the final transaction row's balance if present.
    // Never fall back to intermediate rows (which haven't had subsequent deductions applied).
    const finalRow = entry.outgoingRows.length > 0
      ? entry.outgoingRows[entry.outgoingRows.length - 1]
      : null;
    const finalSheetBalance = finalRow ? finalRow.sheetBalance : entry.sheetBalance;

    if (finalSheetBalance !== null && finalSheetBalance !== undefined) {
      if (toDecimal(finalSheetBalance).minus(toDecimal(entry.recalculatedBalance)).abs().gt(0.01)) {
        warnings.push(
          `Entry '${entry.challanNo}': sheet balance (${finalSheetBalance}) differs from calculated (${entry.recalculatedBalance})`
        );
      }
    }

    // Check outgoing date ordering & piece weight
    for (const r of entry.outgoingRows) {
      if (r.outDate < entry.inDate) {
        warnings.push(`Outgoing date ${r.outDate} is earlier than incoming date ${entry.inDate} for entry '${entry.challanNo}'`);
      }
      if (deductBy === DEDUCT_BY.QTY_X_PIECE_WEIGHT && (!r.pieceWeight || Number(r.pieceWeight) <= 0)) {
        warnings.push(`Missing piece weight on weight-based material row (Challan: ${r.challanNo})`);
      }
    }

    // Check negative balance / over-issue
    if (toDecimal(entry.recalculatedBalance).lt(0)) {
      warnings.push(`Over-issue detected on entry '${entry.challanNo}' (final balance: ${entry.recalculatedBalance})`);
    }
  }

  return {
    detectedHeaders,
    entries,
    totalEntries,
    totalRows,
    warnings,
  };
}

module.exports = {
  parseMaterialWorkbook,
  normalizeDate,
  normalizeText,
  normalizeNumber,
};

