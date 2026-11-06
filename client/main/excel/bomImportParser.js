const ExcelJS = require('exceljs');
const { normalizeText, normalizeNumber } = require('./importParser');

/**
 * Parses BOM workbook
 * @param {string|Buffer} source 
 * @param {Array} existingMaterials - list of existing materials for auto-suggestion
 */
async function parseBomWorkbook(source, existingMaterials = []) {
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
  const colMap = {};

  // Find header row
  worksheet.eachRow((row, rowNumber) => {
    if (headerRowIndex !== -1) return;
    const values = row.values;
    for (let c = 1; c < values.length; c++) {
      const text = normalizeText(values[c]).toLowerCase();
      if (text.includes('party') || text.includes('product') || text.includes('bill of material')) {
        headerRowIndex = rowNumber;
        break;
      }
    }
  });

  if (headerRowIndex === -1) {
    throw new Error('Could not find BOM header row (looking for Party/Product name/Bill of material)');
  }

  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.eachCell((cell, colNumber) => {
    const text = normalizeText(cell.value).toLowerCase();
    if (text.includes('party')) colMap.party = colNumber;
    else if (text.includes('product')) colMap.product = colNumber;
    else if (text.includes('bill of material') || text.includes('material') || text.includes('bom')) colMap.bom = colNumber;
    else if (text.includes('consumption') || text.includes('cunsption') || text.includes('cunsuption') || text.includes('qty')) colMap.consumption = colNumber;
    else if (text.includes('unit')) colMap.unit = colNumber;
  });

  const parsedItems = [];
  let currentParty = '';
  let currentProduct = '';
  const warnings = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    const partyVal = colMap.party ? normalizeText(row.getCell(colMap.party).value) : '';
    const prodVal = colMap.product ? normalizeText(row.getCell(colMap.product).value) : '';
    const bomText = colMap.bom ? normalizeText(row.getCell(colMap.bom).value) : '';
    const consumption = colMap.consumption ? normalizeNumber(row.getCell(colMap.consumption).value) : null;
    const unit = colMap.unit ? normalizeText(row.getCell(colMap.unit).value).toLowerCase() : '';

    if (partyVal) currentParty = partyVal;
    if (prodVal) currentProduct = prodVal;

    if (!bomText && !consumption) {
      return; // Skip empty row
    }

    if (!currentParty) {
      warnings.push(`Row ${rowNumber}: Material '${bomText}' has no associated Party`);
    }
    if (!currentProduct) {
      warnings.push(`Row ${rowNumber}: Material '${bomText}' has no associated Product`);
    }
    if (!consumption || Number(consumption) <= 0) {
      warnings.push(`Row ${rowNumber}: Missing or invalid consumption for '${bomText}'`);
    }

    // Auto-suggest matching material and specification value
    let suggestedMaterialId = null;
    let suggestedSpecValue = null;

    if (bomText && existingMaterials.length > 0) {
      const lowerBom = bomText.toLowerCase();
      // Find material that best matches start of string
      const match = existingMaterials
        .filter((m) => lowerBom.startsWith(m.name.toLowerCase()))
        .sort((a, b) => b.name.length - a.name.length)[0];

      if (match) {
        suggestedMaterialId = match.id;
        const remaining = bomText.substring(match.name.length).trim();
        if (remaining) {
          // If material has specLabel, strip it if present at start
          let spec = remaining;
          if (match.specLabel && spec.toLowerCase().startsWith(match.specLabel.toLowerCase())) {
            spec = spec.substring(match.specLabel.length).trim();
          }
          suggestedSpecValue = spec;
        }
      }
    }

    parsedItems.push({
      rowNumber,
      partyName: currentParty,
      productName: currentProduct,
      rawBomText: bomText,
      consumption,
      unit,
      suggestedMaterialId,
      suggestedSpecValue,
    });
  });

  return {
    items: parsedItems,
    warnings,
  };
}

module.exports = {
  parseBomWorkbook,
};

