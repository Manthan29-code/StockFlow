const incomingRepo = require('../repositories/incoming.repo');
const outgoingRepo = require('../repositories/outgoing.repo');
const materialsRepo = require('../repositories/materials.repo');
const usersRepo = require('../repositories/users.repo');
const auditRepo = require('../repositories/audit.repo');
const metaRepo = require('../repositories/meta.repo');
const { broadcast } = require('../realtime/broadcaster');
const { withTransaction } = require('../db/tx');
const {
  NotFoundError,
  ValidationError,
  InsufficientBalanceError,
  VersionConflictError,
} = require('../utils/errors');
const {
  calculateDeducted,
  calculateEntryLedger,
  validateRunningBalances,
  toDecimal,
} = require('@stockflow/shared');
const {
  mapIncomingEntry,
  mapOutgoingTransaction,
  formatDateToYYYYMMDD,
  mapUserBadge,
} = require('../db/mappers');

async function addIncoming(actorId, data) {
  const material = await materialsRepo.findById(data.materialId);
  if (!material) {
    throw NotFoundError('Material not found');
  }

  // Check duplicate incoming challan_no within the same material (returns warning, not error)
  const existingChallanCount = await incomingRepo.countByMaterialAndChallan(
    data.materialId,
    data.challanNo
  );
  const warning = existingChallanCount > 0
    ? `Challan number '${data.challanNo}' already exists for this material`
    : null;

  const { entry, revision } = await withTransaction(async (tx) => {
    const created = await incomingRepo.createEntry({
      materialId: data.materialId,
      inDate: data.inDate,
      challanNo: data.challanNo,
      quantity: data.quantity,
      supplier: data.supplier,
      notes: data.notes,
      createdBy: actorId,
      updatedBy: actorId,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'CREATE',
      entity: 'incoming_entries',
      entityId: created.id,
      after: mapIncomingEntry(created),
    }, tx);

    return { entry: created, revision: rev };
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'incoming',
    material_id: material.id,
    by: actorId,
  });

  const creator = await usersRepo.findById(actorId);

  return {
    ...mapIncomingEntry(entry),
    created_by: mapUserBadge(creator),
    updated_by: mapUserBadge(creator),
    warning,
  };
}

async function editIncoming(actorId, id, data) {
  const existing = await incomingRepo.findById(id, true);
  if (!existing) {
    throw NotFoundError('Incoming entry not found');
  }

  if (data.version !== undefined && existing.version !== data.version) {
    throw VersionConflictError('Incoming entry was modified by another user');
  }

  // If changing material, forbidden if it has outgoing rows
  if (data.materialId && data.materialId !== existing.materialId) {
    if (existing.outgoingRows && existing.outgoingRows.length > 0) {
      throw ValidationError('Cannot change material for an entry that has outgoing transactions');
    }
    const newMaterial = await materialsRepo.findById(data.materialId);
    if (!newMaterial) {
      throw NotFoundError('New material not found');
    }
  }

  // If changing quantity, new quantity cannot be less than sum already deducted
  const material = existing.material;
  const ledger = calculateEntryLedger(
    { quantity: existing.quantity.toString() },
    existing.outgoingRows.map((r) => ({
      outDate: formatDateToYYYYMMDD(r.outDate),
      rowNo: r.rowNo,
      qty: r.qty.toString(),
      pieceWeight: r.pieceWeight ? r.pieceWeight.toString() : null,
      totalWeight: r.totalWeight ? r.totalWeight.toString() : null,
      deducted: r.deducted.toString(),
    })),
    material.deductBy
  );

  const totalDeducted = toDecimal(ledger.totalDeducted);
  const targetQuantity = data.quantity !== undefined ? toDecimal(data.quantity) : toDecimal(existing.quantity);

  if (targetQuantity.lt(totalDeducted)) {
    throw ValidationError(
      `New quantity (${targetQuantity}) cannot be less than already deducted amount (${totalDeducted})`
    );
  }

  const { updated, revision } = await withTransaction(async (tx) => {
    const res = await incomingRepo.updateEntry(id, {
      ...data,
      updatedBy: actorId,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'UPDATE',
      entity: 'incoming_entries',
      entityId: id,
      before: mapIncomingEntry(existing),
      after: mapIncomingEntry(res),
    }, tx);

    return { updated: res, revision: rev };
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'incoming',
    material_id: updated.materialId,
    by: actorId,
  });

  const updater = await usersRepo.findById(actorId);

  return {
    ...mapIncomingEntry(updated),
    updated_by: mapUserBadge(updater),
  };
}

async function deleteIncoming(actorId, id) {
  const existing = await incomingRepo.findById(id, true);
  if (!existing) {
    throw NotFoundError('Incoming entry not found');
  }

  if (existing.outgoingRows && existing.outgoingRows.length > 0) {
    throw ValidationError('Cannot delete incoming entry that has outgoing transactions. Delete outgoing rows first.');
  }

  const revision = await withTransaction(async (tx) => {
    await incomingRepo.deleteEntry(id, tx);
    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'DELETE',
      entity: 'incoming_entries',
      entityId: id,
      before: mapIncomingEntry(existing),
    }, tx);
    return rev;
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'incoming',
    material_id: existing.materialId,
    by: actorId,
  });

  return { success: true };
}

async function addOutgoing(actorId, data) {
  const { row, entry, revision } = await withTransaction(async (tx) => {
    // 1. Row-level write lock on incoming entry
    const lockedEntry = await incomingRepo.lockEntry(data.incomingEntryId, tx);
    if (!lockedEntry) {
      throw NotFoundError('Incoming entry not found');
    }

    const material = lockedEntry.material;
    const inDateStr = formatDateToYYYYMMDD(lockedEntry.inDate);
    if (data.outDate < inDateStr) {
      throw ValidationError(`Outgoing date (${data.outDate}) cannot be earlier than incoming date (${inDateStr})`);
    }

    // 2. Calculate deducted amount
    const { deducted, totalWeight } = calculateDeducted({
      deductBy: material.deductBy,
      qty: data.qty,
      pieceWeight: data.pieceWeight,
    });

    // 3. Compute balance and check over-issue
    const existingRows = lockedEntry.outgoingRows || [];
    const ledger = calculateEntryLedger(
      { quantity: lockedEntry.quantity.toString() },
      existingRows.map((r) => ({
        outDate: formatDateToYYYYMMDD(r.outDate),
        rowNo: r.rowNo,
        qty: r.qty.toString(),
        pieceWeight: r.pieceWeight ? r.pieceWeight.toString() : null,
        totalWeight: r.totalWeight ? r.totalWeight.toString() : null,
        deducted: r.deducted.toString(),
      })),
      material.deductBy
    );

    const availableBalance = toDecimal(ledger.finalBalance);
    const dDeducted = toDecimal(deducted);

    if (dDeducted.gt(availableBalance)) {
      throw InsufficientBalanceError(
        `Insufficient balance: deducted ${dDeducted.toString()} exceeds available ${availableBalance.toString()}`
      );
    }

    // 4. Assign next row_no
    let maxRowNo = 0;
    for (const r of existingRows) {
      if (r.rowNo > maxRowNo) maxRowNo = r.rowNo;
    }
    const nextRowNo = maxRowNo + 1;

    // 5. Insert row
    const createdRow = await outgoingRepo.createRow({
      incomingEntryId: data.incomingEntryId,
      outDate: data.outDate,
      challanNo: data.challanNo,
      rowNo: nextRowNo,
      qty: data.qty,
      pieceWeight: data.pieceWeight,
      specValue: data.specValue,
      totalWeight,
      deducted,
      createdBy: actorId,
      updatedBy: actorId,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'CREATE',
      entity: 'outgoing_transactions',
      entityId: createdRow.id,
      after: mapOutgoingTransaction(createdRow),
    }, tx);

    return { row: createdRow, entry: lockedEntry, revision: rev };
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'outgoing',
    material_id: entry.materialId,
    by: actorId,
  });

  const creator = await usersRepo.findById(actorId);

  return {
    ...mapOutgoingTransaction(row),
    created_by: mapUserBadge(creator),
    updated_by: mapUserBadge(creator),
  };
}

async function editOutgoing(actorId, id, data) {
  const existing = await outgoingRepo.findById(id);
  if (!existing) {
    throw NotFoundError('Outgoing row not found');
  }

  if (data.version !== undefined && existing.version !== data.version) {
    throw VersionConflictError('Outgoing row was modified by another user');
  }

  const { updated, entry, revision } = await withTransaction(async (tx) => {
    const lockedEntry = await incomingRepo.lockEntry(existing.incomingEntryId, tx);
    const material = lockedEntry.material;

    const inDateStr = formatDateToYYYYMMDD(lockedEntry.inDate);
    const targetOutDate = data.outDate || formatDateToYYYYMMDD(existing.outDate);
    if (targetOutDate < inDateStr) {
      throw ValidationError(`Outgoing date (${targetOutDate}) cannot be earlier than incoming date (${inDateStr})`);
    }

    const targetQty = data.qty !== undefined ? data.qty : existing.qty.toString();
    const targetPieceWeight = data.pieceWeight !== undefined
      ? data.pieceWeight
      : (existing.pieceWeight ? existing.pieceWeight.toString() : null);

    const { deducted, totalWeight } = calculateDeducted({
      deductBy: material.deductBy,
      qty: targetQty,
      pieceWeight: targetPieceWeight,
    });

    // Simulate all rows with this row updated
    const simulatedRows = lockedEntry.outgoingRows.map((r) => {
      if (r.id === id) {
        return {
          id: r.id,
          outDate: targetOutDate,
          rowNo: r.rowNo,
          qty: targetQty,
          pieceWeight: targetPieceWeight,
          totalWeight,
          deducted,
        };
      }
      return {
        id: r.id,
        outDate: formatDateToYYYYMMDD(r.outDate),
        rowNo: r.rowNo,
        qty: r.qty.toString(),
        pieceWeight: r.pieceWeight ? r.pieceWeight.toString() : null,
        totalWeight: r.totalWeight ? r.totalWeight.toString() : null,
        deducted: r.deducted.toString(),
      };
    });

    const validation = validateRunningBalances(
      lockedEntry.quantity.toString(),
      simulatedRows,
      material.deductBy
    );

    if (!validation.valid) {
      throw InsufficientBalanceError(
        `Editing this row would cause balance to drop below zero (min: ${validation.minBalance})`
      );
    }

    const res = await outgoingRepo.updateRow(id, {
      outDate: targetOutDate,
      challanNo: data.challanNo,
      qty: targetQty,
      pieceWeight: targetPieceWeight,
      specValue: data.specValue,
      totalWeight,
      deducted,
      updatedBy: actorId,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'UPDATE',
      entity: 'outgoing_transactions',
      entityId: id,
      before: mapOutgoingTransaction(existing),
      after: mapOutgoingTransaction(res),
    }, tx);

    return { updated: res, entry: lockedEntry, revision: rev };
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'outgoing',
    material_id: entry.materialId,
    by: actorId,
  });

  const updater = await usersRepo.findById(actorId);

  return {
    ...mapOutgoingTransaction(updated),
    updated_by: mapUserBadge(updater),
  };
}

async function deleteOutgoing(actorId, id) {
  const existing = await outgoingRepo.findById(id);
  if (!existing) {
    throw NotFoundError('Outgoing row not found');
  }

  const { entry, revision } = await withTransaction(async (tx) => {
    const lockedEntry = await incomingRepo.lockEntry(existing.incomingEntryId, tx);
    const material = lockedEntry.material;

    // Remaining rows without this one
    const remainingRows = lockedEntry.outgoingRows
      .filter((r) => r.id !== id)
      .map((r) => ({
        id: r.id,
        outDate: formatDateToYYYYMMDD(r.outDate),
        rowNo: r.rowNo,
        qty: r.qty.toString(),
        pieceWeight: r.pieceWeight ? r.pieceWeight.toString() : null,
        totalWeight: r.totalWeight ? r.totalWeight.toString() : null,
        deducted: r.deducted.toString(),
      }));

    const validation = validateRunningBalances(
      lockedEntry.quantity.toString(),
      remainingRows,
      material.deductBy
    );

    if (!validation.valid) {
      throw InsufficientBalanceError(
        `Deleting this row would cause a balance anomaly (min: ${validation.minBalance})`
      );
    }

    await outgoingRepo.deleteRow(id, tx);

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'DELETE',
      entity: 'outgoing_transactions',
      entityId: id,
      before: mapOutgoingTransaction(existing),
    }, tx);

    return { entry: lockedEntry, revision: rev };
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'outgoing',
    material_id: entry.materialId,
    by: actorId,
  });

  return { success: true };
}

module.exports = {
  addIncoming,
  editIncoming,
  deleteIncoming,
  addOutgoing,
  editOutgoing,
  deleteOutgoing,
};

