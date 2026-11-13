function convertDateToDDMMYYYY(str) {
  if (!str) return '';
  const match = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return String(str);
}

function formatNum(val) {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  return isNaN(num) ? '' : num.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

function getReportTitle(material, isWeightBased) {
  const rawName = (material.name || '').trim();
  const suffix = isWeightBased ? 'DISPATCH REPORT' : 'INVENTORY REPORT';
  if (rawName.toUpperCase().endsWith('REPORT')) {
    return rawName.toUpperCase();
  }
  return `${rawName.toUpperCase()} ${suffix}`;
}

function buildMaterialPdfHtml(material, entriesWithLedger = []) {
  const isWeightBased = material.deductBy === 'qty_x_piece_weight';
  const unitCode = material.unit ? material.unit.code : (isWeightBased ? 'kg' : 'nos');
  const hasSpec = Boolean(material.specLabel);
  const specLabel = material.specLabel || 'TL';
  const specColWidth = Math.max((specLabel || '').length + 2, 8);

  const reportTitle = getReportTitle(material, isWeightBased);

  let totalInQty = 0;
  let totalDeducted = 0;
  let currentBalance = 0;

  let rowsHtml = '';

  for (const entry of entriesWithLedger) {
    const entryQty = Number(entry.quantity) || 0;
    totalInQty += entryQty;
    const outgoingRows = entry.outgoingRows || [];

    const entryBalance = Number(entry.balance ?? entry.finalBalance ?? entryQty);
    currentBalance += entryBalance;

    // Incoming shipment row
    if (isWeightBased) {
      rowsHtml += `
        <tr class="inward-row">
          <td class="center font-bold">${convertDateToDDMMYYYY(entry.inDate)}</td>
          <td class="center font-bold mono">${entry.challanNo}</td>
          <td class="num font-bold">${formatNum(entry.quantity)}</td>
          <td></td>
          <td></td>
          ${hasSpec ? '<td></td>' : ''}
          <td></td>
          <td></td>
          <td class="num font-bold">${formatNum(entry.quantity)}</td>
        </tr>
      `;

      for (const outRow of outgoingRows) {
        const outDeducted = Number(outRow.deducted || outRow.totalWeight || 0);
        totalDeducted += outDeducted;

        rowsHtml += `
          <tr class="outward-row">
            <td></td>
            <td></td>
            <td></td>
            <td class="center">${convertDateToDDMMYYYY(outRow.outDate)}</td>
            <td class="center mono">${outRow.challanNo}</td>
            ${hasSpec ? `<td class="center">${outRow.specValue || '-'}</td>` : ''}
            <td class="num">${formatNum(outRow.qty)}</td>
            <td class="num font-bold">${formatNum(outRow.totalWeight || outRow.deducted)}</td>
            <td class="num font-bold ${Number(outRow.runningBalance) < 0 ? 'negative' : ''}">${formatNum(outRow.runningBalance)}</td>
          </tr>
        `;
      }
    } else {
      // Direct count (nos) mode - matching Excel sheet (Image 2)
      rowsHtml += `
        <tr class="inward-row">
          <td class="center font-bold">${convertDateToDDMMYYYY(entry.inDate)}</td>
          <td class="center font-bold mono">${entry.challanNo}</td>
          <td class="num font-bold">${formatNum(entry.quantity)}</td>
          <td></td>
          <td></td>
          ${hasSpec ? '<td></td>' : ''}
          <td></td>
          <td class="num font-bold">${formatNum(entry.quantity)}</td>
        </tr>
      `;

      for (const outRow of outgoingRows) {
        const outDeducted = Number(outRow.deducted || outRow.qty || 0);
        totalDeducted += outDeducted;

        rowsHtml += `
          <tr class="outward-row">
            <td></td>
            <td></td>
            <td></td>
            <td class="center">${convertDateToDDMMYYYY(outRow.outDate)}</td>
            <td class="center mono">${outRow.challanNo}</td>
            ${hasSpec ? `<td class="center">${outRow.specValue || '-'}</td>` : ''}
            <td class="num">${formatNum(outRow.qty)}</td>
            <td class="num font-bold ${Number(outRow.runningBalance) < 0 ? 'negative' : ''}">${formatNum(outRow.runningBalance)}</td>
          </tr>
        `;
      }
    }
  }

  // Header column definitions according to mode
  const theadHtml = isWeightBased ? `
    <thead>
      <tr>
        <th style="width: 12ch; min-width: 12ch; max-width: 12ch;">IN DATE</th>
        <th style="width: 11ch; min-width: 11ch; max-width: 11ch;">INWARD NO</th>
        <th style="width: 13ch; min-width: 13ch; max-width: 13ch;">IN QUANTITY</th>
        <th style="width: 12ch; min-width: 12ch; max-width: 12ch;">OUT DATE</th>
        <th style="width: 12ch; min-width: 12ch; max-width: 12ch;">OUTWARD NO</th>
        ${hasSpec ? `<th style="width: ${specColWidth}ch; min-width: ${specColWidth}ch; max-width: ${specColWidth}ch;">${specLabel}</th>` : ''}
        <th style="width: 8ch; min-width: 8ch; max-width: 8ch;">QTY</th>
        <th style="width: 11ch; min-width: 11ch; max-width: 11ch;">TOTAL WT</th>
        <th style="width: 11ch; min-width: 11ch; max-width: 11ch;">BALANCE</th>
      </tr>
    </thead>
  ` : `
    <thead>
      <tr>
        <th style="width: 12ch; min-width: 12ch; max-width: 12ch;">IN DATE</th>
        <th style="width: 11ch; min-width: 11ch; max-width: 11ch;">INWARD NO</th>
        <th style="width: 10ch; min-width: 10ch; max-width: 10ch;">IN QTY</th>
        <th style="width: 12ch; min-width: 12ch; max-width: 12ch;">OUT DATE</th>
        <th style="width: 12ch; min-width: 12ch; max-width: 12ch;">OUTWARD NO</th>
        ${hasSpec ? `<th style="width: ${specColWidth}ch; min-width: ${specColWidth}ch; max-width: ${specColWidth}ch;">${specLabel}</th>` : ''}
        <th style="width: 10ch; min-width: 10ch; max-width: 10ch;">OUT QTY</th>
        <th style="width: 10ch; min-width: 10ch; max-width: 10ch;">BAL QTY</th>
      </tr>
    </thead>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${reportTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 10mm;
    }
    body {
      font-family: Calibri, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #000000;
      margin: 0;
      padding: 0;
      font-size: 11px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 2px;
    }
    .header h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .table-container {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    table {
      margin: 0 auto;
      border-collapse: collapse;
      border: 1px solid #000000;
      background-color: #ffffff;
    }
    th, td {
      border: 1px solid #000000;
      padding: 4px 6px;
      vertical-align: middle;
      font-size: 10.5px;
      background-color: #ffffff;
      color: #000000;
      white-space: nowrap;
    }
    th {
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
    }
    .center {
      text-align: center;
    }
    .num {
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .mono {
      font-family: Consolas, "Courier New", monospace;
    }
    .font-bold {
      font-weight: 700;
    }
    .inward-row td {
      color: #000000;
    }
    .outward-row td {
      color: #000000;
    }
    .negative {
      color: #c53030 !important;
      font-weight: bold;
    }
    .summary-box {
      margin: 12px auto 0 auto;
      display: flex;
      justify-content: flex-end;
      gap: 20px;
      font-size: 11px;
      font-weight: 600;
      padding: 6px 12px;
      background: #ffffff;
      border: 1px solid #000000;
      width: fit-content;
    }
    .summary-box span strong {
      color: #000000;
      font-size: 11.5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${reportTitle}</h1>
  </div>

  <div class="table-container">
    <table>
      ${theadHtml}
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>

  <div class="summary-box">
    <span>Total Inward: <strong>${formatNum(totalInQty)} ${unitCode}</strong></span>
    <span>Total Outward: <strong>${formatNum(totalDeducted)} ${unitCode}</strong></span>
    <span>Current Balance: <strong>${formatNum(currentBalance)} ${unitCode}</strong></span>
  </div>
</body>
</html>
  `;
}

function buildPartyBomPdfHtml(party, products = [], materialsMap = new Map()) {
  const partyTitle = party ? `${party.name.toUpperCase()} - BILL OF MATERIALS (BOM)` : 'BILL OF MATERIALS (BOM) REPORT';

  let rowsHtml = '';
  for (const prod of products) {
    const partyName = party ? party.name : (prod.party ? prod.party.name : '');
    const productName = prod.name;
    const bomLines = prod.bomLines || [];

    if (bomLines.length === 0) {
      rowsHtml += `
        <tr>
          <td class="center font-bold">${partyName}</td>
          <td class="center font-bold">${productName}</td>
          <td class="center">-</td>
          <td class="center">-</td>
          <td class="center">-</td>
        </tr>
      `;
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

      const isFirst = idx === 0;
      rowsHtml += `
        <tr>
          <td class="center ${isFirst ? 'font-bold' : ''}">${isFirst ? partyName : ''}</td>
          <td class="center ${isFirst ? 'font-bold' : ''}">${isFirst ? productName : ''}</td>
          <td class="center">${bomName}</td>
          <td class="center font-bold">${formatNum(line.consumption)}</td>
          <td class="center">${unitCode}</td>
        </tr>
      `;
    });
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${partyTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 10mm;
    }
    body {
      font-family: Calibri, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #000000;
      margin: 0;
      padding: 0;
      font-size: 11px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      text-align: center;
      margin-bottom: 14px;
      padding-bottom: 2px;
    }
    .header h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .table-container {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    table {
      margin: 0 auto;
      border-collapse: collapse;
      border: 1px solid #000000;
      background-color: #ffffff;
    }
    th, td {
      border: 1px solid #000000;
      padding: 5px 8px;
      vertical-align: middle;
      font-size: 10.5px;
      background-color: #ffffff;
      color: #000000;
      white-space: nowrap;
    }
    th {
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
    }
    .center {
      text-align: center;
    }
    .font-bold {
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${partyTitle}</h1>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th style="width: 18ch; min-width: 18ch;">PARTY</th>
          <th style="width: 28ch; min-width: 28ch;">PRODUCT NAME</th>
          <th style="width: 32ch; min-width: 32ch;">BILL OF MATERIAL</th>
          <th style="width: 14ch; min-width: 14ch;">CONSUMPTION</th>
          <th style="width: 10ch; min-width: 10ch;">UNIT</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>
</body>
</html>
  `;
}

module.exports = {
  buildMaterialPdfHtml,
  buildPartyBomPdfHtml,
};
