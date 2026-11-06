const { formatDateToYYYYMMDD, parseYYYYMMDDToDate } = require('../utils/dates');

function mapDecimal(val) {
  if (val === null || val === undefined) return null;
  return val.toString();
}

function mapUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return {
    ...rest,
    createdAt: user.createdAt ? user.createdAt.toISOString() : null,
    updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
  };
}

function mapUserBadge(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    color: user.color,
  };
}

function mapUnit(unit) {
  if (!unit) return null;
  return {
    ...unit,
    createdAt: unit.createdAt ? unit.createdAt.toISOString() : null,
    updatedAt: unit.updatedAt ? unit.updatedAt.toISOString() : null,
  };
}

function mapMaterial(material) {
  if (!material) return null;
  return {
    ...material,
    createdAt: material.createdAt ? material.createdAt.toISOString() : null,
    updatedAt: material.updatedAt ? material.updatedAt.toISOString() : null,
    unit: material.unit ? mapUnit(material.unit) : undefined,
  };
}

function mapIncomingEntry(entry) {
  if (!entry) return null;
  return {
    ...entry,
    inDate: formatDateToYYYYMMDD(entry.inDate),
    quantity: mapDecimal(entry.quantity),
    createdAt: entry.createdAt ? entry.createdAt.toISOString() : null,
    updatedAt: entry.updatedAt ? entry.updatedAt.toISOString() : null,
    material: entry.material ? mapMaterial(entry.material) : undefined,
    outgoingRows: entry.outgoingRows ? entry.outgoingRows.map(mapOutgoingTransaction) : undefined,
  };
}

function mapOutgoingTransaction(row) {
  if (!row) return null;
  return {
    ...row,
    outDate: formatDateToYYYYMMDD(row.outDate),
    qty: mapDecimal(row.qty),
    pieceWeight: mapDecimal(row.pieceWeight),
    totalWeight: mapDecimal(row.totalWeight),
    deducted: mapDecimal(row.deducted),
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

function mapParty(party) {
  if (!party) return null;
  return {
    ...party,
    createdAt: party.createdAt ? party.createdAt.toISOString() : null,
    updatedAt: party.updatedAt ? party.updatedAt.toISOString() : null,
  };
}

function mapProduct(product) {
  if (!product) return null;
  return {
    ...product,
    createdAt: product.createdAt ? product.createdAt.toISOString() : null,
    updatedAt: product.updatedAt ? product.updatedAt.toISOString() : null,
    party: product.party ? mapParty(product.party) : undefined,
    bomLines: product.bomLines ? product.bomLines.map(mapBomLine) : undefined,
  };
}

function mapBomLine(line) {
  if (!line) return null;
  return {
    ...line,
    consumption: mapDecimal(line.consumption),
    createdAt: line.createdAt ? line.createdAt.toISOString() : null,
    updatedAt: line.updatedAt ? line.updatedAt.toISOString() : null,
    material: line.material ? mapMaterial(line.material) : undefined,
  };
}

function mapAuditLog(log) {
  if (!log) return null;
  return {
    ...log,
    at: log.at ? log.at.toISOString() : null,
  };
}

module.exports = {
  mapDecimal,
  mapUser,
  mapUserBadge,
  mapUnit,
  mapMaterial,
  mapIncomingEntry,
  mapOutgoingTransaction,
  mapParty,
  mapProduct,
  mapBomLine,
  mapAuditLog,
  parseYYYYMMDDToDate,
  formatDateToYYYYMMDD,
};

