const ROLES = Object.freeze({
  ADMIN: 'admin',
  STAFF: 'staff',
});

const DEDUCT_BY = Object.freeze({
  DIRECT: 'direct',
  QTY_X_PIECE_WEIGHT: 'qty_x_piece_weight',
});

const ENTRY_STATUS = Object.freeze({
  NOT_ISSUED: 'not_issued',
  PARTIAL: 'partial',
  CLOSED: 'closed',
});

const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  DUPLICATE: 'DUPLICATE',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

const EXPORT_HEADERS = Object.freeze({
  QTY_X_PIECE_WEIGHT: {
    IN_DATE: 'IN DATE',
    CH_NO_IN: 'INWARD NO',
    WEIGHT: 'WEIGHT',
    OUT_DATE: 'OUT DATE',
    CH_NO_OUT: 'OUTWARD NO',
    QTY: 'QTY',
    PIECE_WEIGHT: 'WIGHT',
    TOTAL_WEIGHT: 'TOTAL WIGHT',
    BALANCE: 'BALANCE',
  },
  DIRECT: {
    IN_DATE: 'IN DATE',
    CH_NO_IN: 'INWARD NO',
    IN_QTY: 'IN QTY',
    OUT_DATE: 'OUT DATE',
    CH_NO_OUT: 'OUTWARD NO',
    OUT_QTY: 'OUT QTY',
    PIECE_WEIGHT: 'WIGHT',
    TOTAL_WEIGHT: 'TOTAL WIGHT',
    BAL_QTY: 'BAL QTY',
  },
  BOM: {
    PARTY: 'Party',
    PRODUCT_NAME: 'Product name',
    BILL_OF_MATERIAL: 'Bill of material',
    CONSUMPTION: 'Consumption',
    UNIT: 'Unit',
  },
});

module.exports = {
  ROLES,
  DEDUCT_BY,
  ENTRY_STATUS,
  ERROR_CODES,
  EXPORT_HEADERS,
};

