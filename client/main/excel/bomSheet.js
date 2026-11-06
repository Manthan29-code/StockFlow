const ExcelJS = require('exceljs');
const { EXPORT_HEADERS } = require('@stockflow/shared');

/**
 * Creates the BOM workbook for all parties and products
 * @param {Array} parties - parties list
 * @param {Array} products - products with party and bomLines
 * @param {Map<string, Object>} materialsMap - materialId -> material object
 * @returns {ExcelJS.Workbook}
 */
function createBomWorkbook(parties, products, materialsMap) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('BOM');

  // Headers
  const headers = [
    EXPORT_HEADERS.BOM.PARTY,
    EXPORT_HEADERS.BOM.PRODUCT_NAME,
    EXPORT_HEADERS.BOM.BILL_OF_MATERIAL,
    EXPORT_HEADERS.BOM.CONSUMPTION,
    EXPORT_HEADERS.BOM.UNIT,
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'left' };
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

  sheet.getColumn(1).width = 18; // Party
  sheet.getColumn(2).width = 34; // Product name
  sheet.getColumn(3).width = 36; // Bill of material
  sheet.getColumn(4).width = 16; // Consumption
  sheet.getColumn(5).width = 10; // Unit

  const partyMap = new Map((parties || []).map((p) => [p.id, p]));

  for (const prod of products || []) {
    const party = prod.party || partyMap.get(prod.partyId);
    const partyName = party ? party.name : '';
    const productName = prod.name;
    const bomLines = prod.bomLines || [];

    if (bomLines.length === 0) {
      // Product with no BOM lines yet
      const r = sheet.addRow([partyName, productName, '', '', '']);
      formatBomRow(r);
      continue;
    }

    bomLines.forEach((line, idx) => {
      const material = line.material || materialsMap.get(line.materialId) || {};
      const unitCode = material.unit ? material.unit.code : (material.unitCode || '');

      let bomName = material.name || '';
      if (line.specValue) {
        if (material.specLabel) {
          bomName = `${bomName} ${material.specLabel}${line.specValue}`;
        } else {
          bomName = `${bomName} ${line.specValue}`;
        }
      }

      // Party and Product name only on first row of each product
      const isFirstLine = idx === 0;
      const row = sheet.addRow([
        isFirstLine ? partyName : '',
        isFirstLine ? productName : '',
        bomName,
        Number(line.consumption),
        unitCode,
      ]);
      formatBomRow(row);
    });
  }

  return workbook;
}

function formatBomRow(row) {
  row.eachCell((cell, colNumber) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    };
    if (colNumber === 4 && typeof cell.value === 'number') {
      cell.numFmt = '#,##0.###';
      cell.alignment = { horizontal: 'right' };
    }
  });
}

module.exports = {
  createBomWorkbook,
};

