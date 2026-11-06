const ExcelJS = require('exceljs');
const { DEDUCT_BY, EXPORT_HEADERS } = require('@stockflow/shared');

function convertDateToDDMMYYYY(str) {
  if (!str) return '';
  const match = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return String(str);
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

/**
 * Builds a workbook for a single material
 * @param {Object} material
 * @param {Array} entriesWithLedger - incoming entries with outgoing rows and computed running balances
 * @returns {ExcelJS.Workbook}
 */
function createMaterialWorkbook(material, entriesWithLedger = []) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(material.name.substring(0, 31));

  const isWeightBased = material.deductBy === DEDUCT_BY.QTY_X_PIECE_WEIGHT;
  const hasSpecLabel = Boolean(material.specLabel);
  const specLabel = material.specLabel || 'TL';

  // Check if any row has piece weight for direct material
  let hasPieceWeight = false;
  if (!isWeightBased) {
    for (const entry of entriesWithLedger) {
      for (const row of entry.outgoingRows || []) {
        if (row.pieceWeight !== null && row.pieceWeight !== undefined && row.pieceWeight !== '') {
          hasPieceWeight = true;
          break;
        }
      }
      if (hasPieceWeight) break;
    }
  }

  // 1. Title Row
  const titleRow = sheet.addRow([material.name.toUpperCase() + (isWeightBased ? ' DISPATCH REPORT' : ' INVENTORY REPORT')]);
  titleRow.font = { bold: true, size: 14 };
  titleRow.alignment = { horizontal: 'center' };

  // 2. Build Column Definitions
  const columns = [];
  const headers = isWeightBased ? EXPORT_HEADERS.QTY_X_PIECE_WEIGHT : EXPORT_HEADERS.DIRECT;

  columns.push({ header: headers.IN_DATE, key: 'inDate', width: 14 });
  columns.push({ header: headers.CH_NO_IN, key: 'chNoIn', width: 14 });
  columns.push({ header: isWeightBased ? headers.WEIGHT : headers.IN_QTY, key: 'inQty', width: 12 });
  columns.push({ header: headers.OUT_DATE, key: 'outDate', width: 14 });
  columns.push({ header: headers.CH_NO_OUT, key: 'chNoOut', width: 14 });

  if (hasSpecLabel) {
    columns.push({ header: specLabel, key: 'specValue', width: 12 });
  }

  columns.push({ header: isWeightBased ? headers.QTY : headers.OUT_QTY, key: 'outQty', width: 12 });

  if (isWeightBased || hasPieceWeight) {
    columns.push({ header: headers.PIECE_WEIGHT, key: 'pieceWeight', width: 12 });
    columns.push({ header: headers.TOTAL_WEIGHT, key: 'totalWeight', width: 14 });
  }

  columns.push({ header: isWeightBased ? headers.BALANCE : headers.BAL_QTY, key: 'balance', width: 14 });

  // Merge title across all columns
  sheet.mergeCells(1, 1, 1, columns.length);

  // 3. Add Header Row
  const headerRow = sheet.addRow(columns.map((c) => c.header));
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' },
    };
  });

  // Set column widths
  columns.forEach((col, idx) => {
    sheet.getColumn(idx + 1).width = col.width;
  });

  // 4. Data Rows per incoming entry
  for (const entry of entriesWithLedger) {
    const inQtyNum = parseNumber(entry.quantity);
    const inDateFormatted = convertDateToDDMMYYYY(entry.inDate);

    // Initial incoming row
    const firstRowValues = {
      inDate: inDateFormatted,
      chNoIn: String(entry.challanNo),
      inQty: inQtyNum,
      outDate: '',
      chNoOut: '',
      specValue: '',
      outQty: '',
      pieceWeight: '',
      totalWeight: isWeightBased ? 0 : '',
      balance: inQtyNum,
    };

    const rowObj = [];
    columns.forEach((col) => {
      rowObj.push(firstRowValues[col.key] !== undefined ? firstRowValues[col.key] : '');
    });

    const addedFirstRow = sheet.addRow(rowObj);
    formatDataRow(addedFirstRow, columns);

    // Outgoing rows beneath
    const outgoingRows = entry.outgoingRows || [];
    for (const outRow of outgoingRows) {
      const outValues = {
        inDate: '',
        chNoIn: '',
        inQty: '',
        outDate: convertDateToDDMMYYYY(outRow.outDate),
        chNoOut: String(outRow.challanNo),
        specValue: outRow.specValue || '',
        outQty: parseNumber(outRow.qty),
        pieceWeight: parseNumber(outRow.pieceWeight),
        totalWeight: parseNumber(outRow.totalWeight || outRow.deducted),
        balance: parseNumber(outRow.runningBalance),
      };

      const outRowArr = [];
      columns.forEach((col) => {
        outRowArr.push(outValues[col.key] !== undefined ? outValues[col.key] : '');
      });

      const addedOutRow = sheet.addRow(outRowArr);
      formatDataRow(addedOutRow, columns);
    }
  }

  return workbook;
}

function formatDataRow(row, columns) {
  row.eachCell((cell, colNumber) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    };

    const col = columns[colNumber - 1];
    if (typeof cell.value === 'number') {
      cell.numFmt = '#,##0.###';
      cell.alignment = { horizontal: 'right' };
    } else if (col && (col.key === 'inDate' || col.key === 'outDate')) {
      cell.alignment = { horizontal: 'center' };
    } else if (col && (col.key === 'chNoIn' || col.key === 'chNoOut')) {
      cell.alignment = { horizontal: 'center' };
    }
  });
}

module.exports = {
  createMaterialWorkbook,
  convertDateToDDMMYYYY,
};

