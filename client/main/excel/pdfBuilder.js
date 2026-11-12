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

function buildMaterialPdfHtml(material, entriesWithLedger = []) {
  const isWeightBased = material.deductBy === 'qty_x_piece_weight';
  const unitCode = material.unit ? material.unit.code : (isWeightBased ? 'kg' : 'nos');
  const hasSpec = Boolean(material.specLabel);
  const specLabel = material.specLabel || 'TL';

  let totalInQty = 0;
  let totalDeducted = 0;
  let currentBalance = 0;

  let rowsHtml = '';

  for (const entry of entriesWithLedger) {
    const entryQty = Number(entry.quantity) || 0;
    totalInQty += entryQty;
    const outgoingRows = entry.outgoingRows || [];

    // Inward entry header row
    const entryBalance = Number(entry.balance ?? entry.finalBalance ?? entryQty);
    currentBalance += entryBalance;

    rowsHtml += `
      <tr class="inward-row">
        <td><strong>${convertDateToDDMMYYYY(entry.inDate)}</strong></td>
        <td><strong>${entry.challanNo}</strong></td>
        <td class="num font-bold">${formatNum(entry.quantity)}</td>
        <td></td>
        <td></td>
        ${hasSpec ? '<td></td>' : ''}
        <td></td>
        <td></td>
        <td class="num font-bold balance-cell">${formatNum(entry.balance ?? entry.finalBalance)}</td>
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
          <td>${convertDateToDDMMYYYY(outRow.outDate)}</td>
          <td class="mono font-bold">${outRow.challanNo}</td>
          ${hasSpec ? `<td>${outRow.specValue || '-'}</td>` : ''}
          <td class="num">${formatNum(outRow.qty)}</td>
          <td class="num font-bold">${formatNum(outRow.totalWeight || outRow.deducted)}</td>
          <td class="num font-bold ${Number(outRow.runningBalance) < 0 ? 'negative' : ''}">${formatNum(outRow.runningBalance)}</td>
        </tr>
      `;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${material.name} - Stock Records</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1a202c;
      margin: 0;
      padding: 0;
      font-size: 11px;
    }
    .header {
      text-align: center;
      margin-bottom: 14px;
      border-bottom: 2px solid #2b6cb0;
      padding-bottom: 8px;
    }
    .header h1 {
      margin: 0 0 4px 0;
      font-size: 18px;
      color: #2b6cb0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header .meta {
      font-size: 11px;
      color: #718096;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th, td {
      border: 1px solid #cbd5e0;
      padding: 5px 8px;
      vertical-align: middle;
    }
    th {
      background-color: #edf2f7;
      font-weight: 700;
      text-align: left;
      font-size: 10.5px;
      color: #2d3748;
      text-transform: uppercase;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .mono {
      font-family: Consolas, "Courier New", monospace;
    }
    .font-bold {
      font-weight: 700;
    }
    .inward-row {
      background-color: #f7fafc;
      border-top: 2px solid #cbd5e0;
    }
    .inward-row td {
      color: #2b6cb0;
    }
    .outward-row td {
      color: #2d3748;
    }
    .balance-cell {
      background-color: #edf2f7;
    }
    .negative {
      color: #e53e3e !important;
      font-weight: bold;
    }
    .summary-box {
      margin-top: 14px;
      display: flex;
      justify-content: flex-end;
      gap: 20px;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 12px;
      background: #f7fafc;
      border: 1px solid #cbd5e0;
      border-radius: 4px;
    }
    .summary-box span strong {
      color: #2b6cb0;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${material.name} ${isWeightBased ? 'DISPATCH REPORT' : 'INVENTORY REPORT'}</h1>
    <div class="meta">
      Unit of Measure: <strong>${unitCode}</strong> &bull; Generated: <strong>${new Date().toLocaleDateString('en-GB')}</strong>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 11%;">IN DATE</th>
        <th style="width: 13%;">INWARD NO</th>
        <th style="width: 11%;" class="num">IN QUANTITY</th>
        <th style="width: 11%;">OUT DATE</th>
        <th style="width: 13%;">OUTWARD NO</th>
        ${hasSpec ? `<th style="width: 10%;">${specLabel}</th>` : ''}
        <th style="width: 9%;" class="num">QTY</th>
        <th style="width: 11%;" class="num">TOTAL WT</th>
        <th style="width: 11%;" class="num">BALANCE</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="summary-box">
    <span>Total Inward: <strong>${formatNum(totalInQty)} ${unitCode}</strong></span>
    <span>Total Outward: <strong>${formatNum(totalDeducted)} ${unitCode}</strong></span>
    <span>Current Balance: <strong>${formatNum(currentBalance)} ${unitCode}</strong></span>
  </div>
</body>
</html>
  `;
}

module.exports = {
  buildMaterialPdfHtml,
};

