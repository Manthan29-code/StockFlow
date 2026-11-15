const Decimal = require('decimal.js');
const { DEDUCT_BY, ENTRY_STATUS } = require('./constants');

// Configure Decimal for financial / inventory accuracy
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Normalizes input to string representation of Decimal
 * @param {string|number|Decimal} val 
 * @returns {Decimal}
 */
function toDecimal(val) {
  if (val === null || val === undefined || val === '') {
    return new Decimal(0);
  }
  return new Decimal(val);
}

/**
 * Formats a Decimal or numeric string to fixed decimals, removing trailing zeroes if requested
 * @param {string|number|Decimal} val 
 * @param {number} [decimalPlaces]
 * @returns {string}
 */
function formatNumber(val, decimalPlaces = null) {
  const d = toDecimal(val);
  if (decimalPlaces !== null && decimalPlaces !== undefined) {
    return d.toFixed(decimalPlaces);
  }
  return d.toString();
}

/**
 * Calculates deducted amount and total weight for an outgoing row
 * @param {Object} params
 * @param {string} params.deductBy - 'direct' or 'qty_x_piece_weight'
 * @param {string|number} params.qty - quantity issued
 * @param {string|number|null} [params.pieceWeight] - weight per piece
 * @returns {{ deducted: string, totalWeight: string | null }}
 */
function calculateDeducted({ deductBy, qty, pieceWeight }) {
  if (qty === null || qty === undefined || qty === '') {
    throw new Error('Quantity is required');
  }

  const dQty = toDecimal(qty);
  if (dQty.lte(0)) {
    throw new Error('Quantity must be greater than zero');
  }

  if (deductBy === DEDUCT_BY.QTY_X_PIECE_WEIGHT) {
    if (pieceWeight === null || pieceWeight === undefined || pieceWeight === '') {
      throw new Error('Piece weight is required for qty_x_piece_weight materials');
    }
    const dPieceWeight = toDecimal(pieceWeight);
    if (dPieceWeight.lte(0)) {
      throw new Error('Piece weight must be greater than zero');
    }

    const deducted = dQty.times(dPieceWeight);
    const deductedStr = deducted.toString();
    return {
      deducted: deductedStr,
      totalWeight: deductedStr,
    };
  } else if (deductBy === DEDUCT_BY.DIRECT) {
    const deducted = dQty;
    let totalWeight = null;
    if (pieceWeight !== null && pieceWeight !== undefined && pieceWeight !== '') {
      const dPieceWeight = toDecimal(pieceWeight);
      if (dPieceWeight.gt(0)) {
        totalWeight = dQty.times(dPieceWeight).toString();
      }
    }
    return {
      deducted: deducted.toString(),
      totalWeight,
    };
  } else {
    throw new Error(`Unknown deductBy mode: ${deductBy}`);
  }
}

/**
 * Sorts outgoing rows by outDate ASC, then rowNo ASC
 * @param {Array} rows 
 * @returns {Array}
 */
function sortOutgoingRows(rows = []) {
  return [...rows].sort((a, b) => {
    const dateA = String(a.outDate || a.out_date || '');
    const dateB = String(b.outDate || b.out_date || '');
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    const rowNoA = Number(a.rowNo ?? a.row_no ?? 0);
    const rowNoB = Number(b.rowNo ?? b.row_no ?? 0);
    return rowNoA - rowNoB;
  });
}

/**
 * Calculates running balances and status for an incoming entry and its outgoing rows
 * @param {Object} entry 
 * @param {string|number} entry.quantity 
 * @param {string} [deductBy] - material's deductBy mode (defaults to entry.deductBy or direct)
 * @param {Array} outgoingRows 
 * @returns {{ rows: Array, finalBalance: string, status: string, totalDeducted: string }}
 */
function calculateEntryLedger(entry, outgoingRows = [], deductBy = DEDUCT_BY.DIRECT) {
  const mode = deductBy || entry.deductBy || entry.deduct_by || DEDUCT_BY.DIRECT;
  const initialQty = toDecimal(entry.quantity);
  const sorted = sortOutgoingRows(outgoingRows);

  let currentBalance = initialQty;
  let totalDeducted = new Decimal(0);

  const enrichedRows = sorted.map((row) => {
    const qty = row.qty;
    const pieceWeight = row.pieceWeight ?? row.piece_weight ?? null;
    const { deducted, totalWeight } = calculateDeducted({
      deductBy: mode,
      qty,
      pieceWeight,
    });

    const dDeducted = toDecimal(deducted);
    totalDeducted = totalDeducted.plus(dDeducted);
    currentBalance = currentBalance.minus(dDeducted);

    return {
      ...row,
      deducted,
      totalWeight: row.totalWeight ?? row.total_weight ?? totalWeight,
      runningBalance: currentBalance.toString(),
    };
  });

  let status = ENTRY_STATUS.NOT_ISSUED;
  if (enrichedRows.length > 0) {
    status = currentBalance.lte(0) ? ENTRY_STATUS.CLOSED : ENTRY_STATUS.PARTIAL;
  }

  return {
    rows: enrichedRows,
    finalBalance: currentBalance.toString(),
    status,
    totalDeducted: totalDeducted.toString(),
  };
}

/**
 * Validates whether applying outgoing rows against incoming quantity leads to negative balance at any point
 * @param {string|number} incomingQuantity 
 * @param {Array} outgoingRows 
 * @param {string} deductBy 
 * @returns {{ valid: boolean, minBalance: string, failedAtRowIndex: number }}
 */
function validateRunningBalances(incomingQuantity, outgoingRows = [], deductBy = DEDUCT_BY.DIRECT) {
  const initial = toDecimal(incomingQuantity);
  const sorted = sortOutgoingRows(outgoingRows);
  let balance = initial;
  let minBalance = initial;

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    const qty = row.qty;
    const pieceWeight = row.pieceWeight ?? row.piece_weight ?? null;
    const { deducted } = calculateDeducted({
      deductBy,
      qty,
      pieceWeight,
    });
    balance = balance.minus(toDecimal(deducted));
    if (balance.lt(minBalance)) {
      minBalance = balance;
    }
    if (balance.lt(0)) {
      return {
        valid: false,
        minBalance: balance.toString(),
        failedAtRowIndex: i,
      };
    }
  }

  return {
    valid: true,
    minBalance: minBalance.toString(),
    failedAtRowIndex: -1,
  };
}

/**
 * Calculates overall material stock from list of incoming entries (with their running balances)
 * @param {Array} entriesWithBalances 
 * @returns {string}
 */
function calculateMaterialStock(entriesWithBalances = []) {
  let total = new Decimal(0);
  for (const entry of entriesWithBalances) {
    const bal = entry.balance !== undefined ? entry.balance : (entry.finalBalance || entry.quantity);
    total = total.plus(toDecimal(bal));
  }
  return total.toString();
}

/**
 * Calculates BOM requirements for a production quantity
 * @param {Array} bomLines 
 * @param {string|number} productionQty 
 * @param {Object} stockByMaterialId - map of materialId -> available stock
 * @returns {Array}
 */
function calculateBomRequirements(bomLines = [], productionQty, stockByMaterialId = {}) {
  const dProdQty = toDecimal(productionQty);
  if (dProdQty.lte(0)) {
    throw new Error('Production quantity must be greater than zero');
  }

  return bomLines.map((line) => {
    const consumption = toDecimal(line.consumption);
    const required = dProdQty.times(consumption);
    const materialId = line.materialId || line.material_id;
    const available = toDecimal(stockByMaterialId[materialId] || 0);
    const shortfall = Decimal.max(0, required.minus(available));

    return {
      ...line,
      productionQty: dProdQty.toString(),
      required: required.toString(),
      availableStock: available.toString(),
      shortfall: shortfall.toString(),
      isShort: shortfall.gt(0),
    };
  });
}

module.exports = {
  Decimal,
  toDecimal,
  formatNumber,
  calculateDeducted,
  sortOutgoingRows,
  calculateEntryLedger,
  validateRunningBalances,
  calculateMaterialStock,
  calculateBomRequirements,
};

