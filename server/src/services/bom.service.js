const bomRepo = require('../repositories/bom.repo');
const productsRepo = require('../repositories/products.repo');
const materialsRepo = require('../repositories/materials.repo');
const incomingRepo = require('../repositories/incoming.repo');
const auditRepo = require('../repositories/audit.repo');
const metaRepo = require('../repositories/meta.repo');
const { prisma } = require('../db');
const { broadcast } = require('../realtime/broadcaster');
const { withTransaction } = require('../db/tx');
const {
  NotFoundError,
  ValidationError,
  DuplicateError,
  VersionConflictError,
} = require('../utils/errors');
const {
  calculateEntryLedger,
  calculateMaterialStock,
  calculateBomRequirements,
  toDecimal,
} = require('@stockflow/shared');
const { mapBomLine, formatDateToYYYYMMDD } = require('../db/mappers');

async function addBomLine(actorId, productId, data) {
  const product = await productsRepo.findById(productId, false);
  if (!product) {
    throw NotFoundError('Product not found');
  }

  const material = await materialsRepo.findById(data.materialId);
  if (!material) {
    throw NotFoundError('Material not found');
  }

  const existingDuplicate = await bomRepo.findDuplicateLine(
    productId,
    data.materialId,
    data.specValue
  );
  if (existingDuplicate) {
    throw DuplicateError(
      `BOM line for this material and specification '${data.specValue || 'default'}' already exists on this product`
    );
  }

  const { line, revision } = await withTransaction(async (tx) => {
    const created = await bomRepo.createLine({
      productId,
      materialId: data.materialId,
      consumption: data.consumption,
      specValue: data.specValue,
      createdBy: actorId,
      updatedBy: actorId,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'CREATE',
      entity: 'bom_lines',
      entityId: created.id,
      after: mapBomLine(created),
    }, tx);

    return { line: created, revision: rev };
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'bom',
    by: actorId,
  });

  return mapBomLine(line);
}

async function editBomLine(actorId, id, data) {
  const existing = await bomRepo.findById(id);
  if (!existing) {
    throw NotFoundError('BOM line not found');
  }

  if (data.version !== undefined && existing.version !== data.version) {
    throw VersionConflictError('BOM line was modified by another user');
  }

  if (data.specValue !== undefined) {
    const duplicate = await bomRepo.findDuplicateLine(
      existing.productId,
      existing.materialId,
      data.specValue,
      id
    );
    if (duplicate) {
      throw DuplicateError('Another BOM line with this specification already exists on this product');
    }
  }

  const { updated, revision } = await withTransaction(async (tx) => {
    const res = await bomRepo.updateLine(id, {
      consumption: data.consumption,
      specValue: data.specValue,
      updatedBy: actorId,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'UPDATE',
      entity: 'bom_lines',
      entityId: id,
      before: mapBomLine(existing),
      after: mapBomLine(res),
    }, tx);

    return { updated: res, revision: rev };
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'bom',
    by: actorId,
  });

  return mapBomLine(updated);
}

async function deleteBomLine(actorId, id) {
  const existing = await bomRepo.findById(id);
  if (!existing) {
    throw NotFoundError('BOM line not found');
  }

  const revision = await withTransaction(async (tx) => {
    await bomRepo.deleteLine(id, tx);
    const rev = await metaRepo.bumpRevision(tx);
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'DELETE',
      entity: 'bom_lines',
      entityId: id,
      before: mapBomLine(existing),
    }, tx);
    return rev;
  });

  broadcast({
    type: 'changed',
    revision,
    entity: 'bom',
    by: actorId,
  });

  return { success: true };
}

async function calculateRequirements(productId, productionQty) {
  const product = await productsRepo.findById(productId, true);
  if (!product) {
    throw NotFoundError('Product not found');
  }

  const bomLines = product.bomLines || [];
  const materialIds = [...new Set(bomLines.map((l) => l.materialId))];

  // Fetch stocks for required materials
  const stockByMaterialId = {};
  for (const mId of materialIds) {
    const material = await materialsRepo.findById(mId);
    const entries = await incomingRepo.listByMaterial(mId, true);
    const entriesWithLedger = entries.map((entry) => {
      const rawRows = entry.outgoingRows || [];
      const ledger = calculateEntryLedger(
        { quantity: entry.quantity.toString() },
        rawRows.map((r) => ({
          outDate: formatDateToYYYYMMDD(r.outDate),
          rowNo: r.rowNo,
          qty: r.qty.toString(),
          pieceWeight: r.pieceWeight ? r.pieceWeight.toString() : null,
          totalWeight: r.totalWeight ? r.totalWeight.toString() : null,
          deducted: r.deducted.toString(),
        })),
        material.deductBy
      );
      return { balance: ledger.finalBalance };
    });
    stockByMaterialId[mId] = calculateMaterialStock(entriesWithLedger);
  }

  const mappedLines = bomLines.map(mapBomLine);
  const requirements = calculateBomRequirements(mappedLines, productionQty, stockByMaterialId);

  return {
    productId,
    productName: product.name,
    productionQty: String(productionQty),
    requirements,
  };
}

async function recordProductionDispatch(actorId, productId, { quantity, outwardNo, outDate }) {
  const prodQty = toDecimal(quantity);
  if (prodQty.lte(0)) {
    throw ValidationError('Production quantity must be greater than zero');
  }
  if (!outwardNo || !String(outwardNo).trim()) {
    throw ValidationError('Outward No is required');
  }
  if (!outDate) {
    throw ValidationError('Outward date is required');
  }

  const product = await productsRepo.findById(productId, true);
  if (!product) {
    throw NotFoundError('Product not found');
  }

  const bomLines = product.bomLines || [];
  if (bomLines.length === 0) {
    throw ValidationError(`Cannot produce product '${product.name}' because it has no BOM recipe lines defined`);
  }

  const result = await withTransaction(async (tx) => {
    const deductionsSummary = [];
    const createdOutgoingIds = [];

    for (const line of bomLines) {
      const material = line.material;
      const bomConsumption = toDecimal(line.consumption);
      const isWeightBased = material.deductBy === 'qty_x_piece_weight';

      // Compute total required deduction
      let neededDeduction;
      let pieceWeight = null;
      if (isWeightBased) {
        neededDeduction = prodQty.times(bomConsumption);
        pieceWeight = bomConsumption.toString();
      } else {
        neededDeduction = prodQty.times(bomConsumption);
      }

      const specValue = line.specValue || null;

      // Fetch all incoming entries for this material ordered by inDate ASC, createdAt ASC
      const incomingEntries = await tx.incomingEntry.findMany({
        where: { materialId: material.id },
        include: { outgoingRows: true },
        orderBy: [{ inDate: 'asc' }, { createdAt: 'asc' }],
      });

      if (incomingEntries.length === 0) {
        const createdPending = await tx.incomingEntry.create({
          data: {
            materialId: material.id,
            inDate: new Date(outDate),
            challanNo: 'PENDING-INWARD',
            quantity: 0,
            supplier: 'Pending Delivery',
            notes: 'Auto-created for advance production dispatch',
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        incomingEntries.push({ ...createdPending, outgoingRows: [] });
      }

      // Compute balance on each incoming entry
      const entriesWithBalance = incomingEntries.map((e) => {
        const ledger = calculateEntryLedger(
          { quantity: e.quantity.toString() },
          (e.outgoingRows || []).map((r) => ({
            outDate: formatDateToYYYYMMDD(r.outDate),
            rowNo: r.rowNo,
            qty: r.qty.toString(),
            pieceWeight: r.pieceWeight ? r.pieceWeight.toString() : null,
            deducted: r.deducted.toString(),
          })),
          material.deductBy
        );
        return {
          entry: e,
          balance: toDecimal(ledger.finalBalance),
          existingRows: e.outgoingRows || [],
        };
      });

      const openEntries = entriesWithBalance.filter((eb) => eb.balance.gt(0));
      let remainingNeeded = neededDeduction;

      if (openEntries.length > 0) {
        for (const item of openEntries) {
          if (remainingNeeded.lte(0)) break;

          const available = item.balance;
          const deductFromThis = remainingNeeded.lte(available) ? remainingNeeded : available;

          let sliceQty;
          let sliceTotalWeight = null;
          if (isWeightBased) {
            sliceQty = deductFromThis.dividedBy(bomConsumption);
            sliceTotalWeight = deductFromThis.toString();
          } else {
            sliceQty = deductFromThis;
          }

          let maxRowNo = 0;
          for (const r of item.existingRows) {
            if (r.rowNo > maxRowNo) maxRowNo = r.rowNo;
          }

          const createdOut = await tx.outgoingTransaction.create({
            data: {
              incomingEntryId: item.entry.id,
              outDate: new Date(outDate),
              challanNo: outwardNo.trim(),
              rowNo: maxRowNo + 1,
              qty: sliceQty.toString(),
              pieceWeight,
              specValue,
              totalWeight: sliceTotalWeight,
              deducted: deductFromThis.toString(),
              createdBy: actorId,
              updatedBy: actorId,
            },
          });

          createdOutgoingIds.push(createdOut.id);
          item.existingRows.push({ rowNo: maxRowNo + 1 });
          remainingNeeded = remainingNeeded.minus(deductFromThis);
        }
      }

      // If still deficit remaining, last entry absorbs remainder into negative (minus running balance)
      if (remainingNeeded.gt(0)) {
        const targetItem = entriesWithBalance[entriesWithBalance.length - 1];
        let sliceQty;
        let sliceTotalWeight = null;
        if (isWeightBased) {
          sliceQty = remainingNeeded.dividedBy(bomConsumption);
          sliceTotalWeight = remainingNeeded.toString();
        } else {
          sliceQty = remainingNeeded;
        }

        let maxRowNo = 0;
        for (const r of targetItem.existingRows) {
          if (r.rowNo > maxRowNo) maxRowNo = r.rowNo;
        }

        const createdDeficit = await tx.outgoingTransaction.create({
          data: {
            incomingEntryId: targetItem.entry.id,
            outDate: new Date(outDate),
            challanNo: outwardNo.trim(),
            rowNo: maxRowNo + 1,
            qty: sliceQty.toString(),
            pieceWeight,
            specValue,
            totalWeight: sliceTotalWeight,
            deducted: remainingNeeded.toString(),
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        createdOutgoingIds.push(createdDeficit.id);
      }

      deductionsSummary.push({
        materialId: material.id,
        materialName: material.name,
        deducted: neededDeduction.toString(),
        unit: material.unit ? material.unit.code : '',
        specValue,
      });
    }

    const rev = await metaRepo.bumpRevision(tx);
    const auditCreated = await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'CREATE',
      entity: 'production_dispatch',
      entityId: productId,
      after: {
        productId,
        productName: product.name,
        partyName: product.party ? product.party.name : '',
        quantity: prodQty.toString(),
        outwardNo: outwardNo.trim(),
        outDate,
        outgoingRowIds: createdOutgoingIds,
        materialsDeducted: deductionsSummary,
      },
    }, tx);

    return { revision: rev, deductionsSummary, dispatchId: auditCreated.id };
  });

  broadcast({
    type: 'changed',
    revision: result.revision,
    entity: 'production',
    productId,
    by: actorId,
  });

  return {
    success: true,
    dispatchId: result.dispatchId,
    productId,
    productName: product.name,
    partyName: product.party ? product.party.name : '',
    quantity: prodQty.toString(),
    outwardNo: outwardNo.trim(),
    outDate,
    materialsDeducted: result.deductionsSummary,
  };
}

async function listProductionDispatches() {
  const entries = await prisma.auditLog.findMany({
    where: { entity: 'production_dispatch', action: 'CREATE' },
    orderBy: { at: 'desc' },
  });

  const dispatches = [];
  for (const entry of entries) {
    const after = entry.after || {};
    const product = await productsRepo.findById(after.productId, false);
    const partyName = (product && product.party) ? product.party.name : (after.partyName || 'Unknown');
    dispatches.push({
      id: entry.id,
      productId: after.productId,
      productName: after.productName || (product ? product.name : 'Unknown'),
      partyName,
      plannedQuantity: after.quantity,
      outwardDate: after.outDate,
      outwardNo: after.outwardNo,
      createdAt: entry.at,
      materialsDeducted: after.materialsDeducted || [],
    });
  }
  return dispatches;
}

async function updateProductionDispatch(actorId, dispatchId, { quantity, outwardNo, outDate }) {
  const dispatchAudit = await prisma.auditLog.findUnique({
    where: { id: dispatchId },
  });
  if (!dispatchAudit || dispatchAudit.entity !== 'production_dispatch') {
    throw NotFoundError('Production dispatch record not found');
  }

  const current = dispatchAudit.after || {};
  const productId = current.productId;
  const product = await productsRepo.findById(productId, true);
  if (!product) {
    throw NotFoundError('Product not found');
  }

  const oldQty = toDecimal(current.quantity);
  const newQty = quantity !== undefined ? toDecimal(quantity) : oldQty;
  if (newQty.lte(0)) {
    throw ValidationError('Planned quantity must be greater than zero');
  }

  const oldOutwardNo = current.outwardNo;
  const newOutwardNo = outwardNo !== undefined ? String(outwardNo).trim() : oldOutwardNo;
  if (!newOutwardNo) {
    throw ValidationError('Outward No is required');
  }

  const oldOutDate = current.outDate;
  const newOutDate = outDate !== undefined ? outDate : oldOutDate;
  if (!newOutDate) {
    throw ValidationError('Outward date is required');
  }

  const isQtyChanged = !newQty.equals(oldQty);
  const isMetadataChanged = newOutwardNo !== oldOutwardNo || newOutDate !== oldOutDate;

  if (!isQtyChanged && !isMetadataChanged) {
    return { success: true, message: 'No changes detected' };
  }

  const result = await withTransaction(async (tx) => {
    // 1. Locate existing outward transactions for this dispatch
    let existingRowIds = Array.isArray(current.outgoingRowIds) ? current.outgoingRowIds : [];
    let rows = [];
    if (existingRowIds.length > 0) {
      rows = await tx.outgoingTransaction.findMany({
        where: { id: { in: existingRowIds } },
      });
    }
    if (rows.length === 0) {
      // Fallback: search by challanNo and outDate
      rows = await tx.outgoingTransaction.findMany({
        where: {
          challanNo: oldOutwardNo,
          outDate: new Date(oldOutDate),
        },
      });
    }

    let updatedOutgoingIds = [];
    let deductionsSummary = current.materialsDeducted || [];

    if (!isQtyChanged && isMetadataChanged) {
      // Update outwardNo and outDate on existing outward rows
      for (const r of rows) {
        await tx.outgoingTransaction.update({
          where: { id: r.id },
          data: {
            challanNo: newOutwardNo,
            outDate: new Date(newOutDate),
            updatedBy: actorId,
          },
        });
      }
      updatedOutgoingIds = rows.map((r) => r.id);
    } else {
      // Quantity changed (and optionally date/no)
      // Delete previous outward rows so stock is restored
      if (rows.length > 0) {
        await tx.outgoingTransaction.deleteMany({
          where: { id: { in: rows.map((r) => r.id) } },
        });
      }

      // Re-allocate deductions using FIFO for new quantity
      deductionsSummary = [];
      const bomLines = product.bomLines || [];
      for (const line of bomLines) {
        const material = line.material;
        const bomConsumption = toDecimal(line.consumption);
        const isWeightBased = material.deductBy === 'qty_x_piece_weight';

        let neededDeduction;
        let pieceWeight = null;
        if (isWeightBased) {
          neededDeduction = newQty.times(bomConsumption);
          pieceWeight = bomConsumption.toString();
        } else {
          neededDeduction = newQty.times(bomConsumption);
        }

        const specValue = line.specValue || null;

        const incomingEntries = await tx.incomingEntry.findMany({
          where: { materialId: material.id },
          include: { outgoingRows: true },
          orderBy: [{ inDate: 'asc' }, { createdAt: 'asc' }],
        });

        if (incomingEntries.length === 0) {
          const createdPending = await tx.incomingEntry.create({
            data: {
              materialId: material.id,
              inDate: new Date(newOutDate),
              challanNo: 'PENDING-INWARD',
              quantity: 0,
              supplier: 'Pending Delivery',
              notes: 'Auto-created for advance production dispatch',
              createdBy: actorId,
              updatedBy: actorId,
            },
          });
          incomingEntries.push({ ...createdPending, outgoingRows: [] });
        }

        const entriesWithBalance = incomingEntries.map((e) => {
          const ledger = calculateEntryLedger(
            { quantity: e.quantity.toString() },
            (e.outgoingRows || []).map((r) => ({
              outDate: formatDateToYYYYMMDD(r.outDate),
              rowNo: r.rowNo,
              qty: r.qty.toString(),
              pieceWeight: r.pieceWeight ? r.pieceWeight.toString() : null,
              deducted: r.deducted.toString(),
            })),
            material.deductBy
          );
          return {
            entry: e,
            balance: toDecimal(ledger.finalBalance),
            existingRows: e.outgoingRows || [],
          };
        });

        const openEntries = entriesWithBalance.filter((eb) => eb.balance.gt(0));
        let remainingNeeded = neededDeduction;

        if (openEntries.length > 0) {
          for (const item of openEntries) {
            if (remainingNeeded.lte(0)) break;

            const available = item.balance;
            const deductFromThis = remainingNeeded.lte(available) ? remainingNeeded : available;

            let sliceQty;
            let sliceTotalWeight = null;
            if (isWeightBased) {
              sliceQty = deductFromThis.dividedBy(bomConsumption);
              sliceTotalWeight = deductFromThis.toString();
            } else {
              sliceQty = deductFromThis;
            }

            let maxRowNo = 0;
            for (const r of item.existingRows) {
              if (r.rowNo > maxRowNo) maxRowNo = r.rowNo;
            }

            const createdOut = await tx.outgoingTransaction.create({
              data: {
                incomingEntryId: item.entry.id,
                outDate: new Date(newOutDate),
                challanNo: newOutwardNo,
                rowNo: maxRowNo + 1,
                qty: sliceQty.toString(),
                pieceWeight,
                specValue,
                totalWeight: sliceTotalWeight,
                deducted: deductFromThis.toString(),
                createdBy: actorId,
                updatedBy: actorId,
              },
            });
            updatedOutgoingIds.push(createdOut.id);
            item.existingRows.push({ rowNo: maxRowNo + 1 });
            remainingNeeded = remainingNeeded.minus(deductFromThis);
          }
        }

        // Deficit goes to last entry
        if (remainingNeeded.gt(0)) {
          const targetItem = entriesWithBalance[entriesWithBalance.length - 1];
          let sliceQty;
          let sliceTotalWeight = null;
          if (isWeightBased) {
            sliceQty = remainingNeeded.dividedBy(bomConsumption);
            sliceTotalWeight = remainingNeeded.toString();
          } else {
            sliceQty = remainingNeeded;
          }

          let maxRowNo = 0;
          for (const r of targetItem.existingRows) {
            if (r.rowNo > maxRowNo) maxRowNo = r.rowNo;
          }

          const createdDeficit = await tx.outgoingTransaction.create({
            data: {
              incomingEntryId: targetItem.entry.id,
              outDate: new Date(newOutDate),
              challanNo: newOutwardNo,
              rowNo: maxRowNo + 1,
              qty: sliceQty.toString(),
              pieceWeight,
              specValue,
              totalWeight: sliceTotalWeight,
              deducted: remainingNeeded.toString(),
              createdBy: actorId,
              updatedBy: actorId,
            },
          });
          updatedOutgoingIds.push(createdDeficit.id);
        }

        deductionsSummary.push({
          materialId: material.id,
          materialName: material.name,
          deducted: neededDeduction.toString(),
          unit: material.unit ? material.unit.code : '',
          specValue,
        });
      }
    }

    const updatedAfter = {
      ...current,
      quantity: newQty.toString(),
      outwardNo: newOutwardNo,
      outDate: newOutDate,
      outgoingRowIds: updatedOutgoingIds,
      materialsDeducted: deductionsSummary,
    };

    // Update the original CREATE entry's after field so it reflects current state
    await tx.auditLog.update({
      where: { id: dispatchId },
      data: { after: updatedAfter },
    });

    // Create an UPDATE audit entry
    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'UPDATE',
      entity: 'production_dispatch',
      entityId: productId,
      before: current,
      after: updatedAfter,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    return { revision: rev, updatedAfter };
  });

  broadcast({
    type: 'changed',
    revision: result.revision,
    entity: 'production',
    productId,
    by: actorId,
  });

  return {
    success: true,
    dispatch: {
      id: dispatchId,
      productId,
      productName: product.name,
      partyName: product.party ? product.party.name : '',
      plannedQuantity: result.updatedAfter.quantity,
      outwardDate: result.updatedAfter.outDate,
      outwardNo: result.updatedAfter.outwardNo,
      materialsDeducted: result.updatedAfter.materialsDeducted,
    },
  };
}

async function deleteProductionDispatch(actorId, dispatchId) {
  const dispatchAudit = await prisma.auditLog.findUnique({
    where: { id: dispatchId },
  });
  if (!dispatchAudit || dispatchAudit.entity !== 'production_dispatch') {
    throw NotFoundError('Production dispatch record not found');
  }

  const current = dispatchAudit.after || {};
  const productId = current.productId;

  const result = await withTransaction(async (tx) => {
    let existingRowIds = Array.isArray(current.outgoingRowIds) ? current.outgoingRowIds : [];
    let rows = [];
    if (existingRowIds.length > 0) {
      rows = await tx.outgoingTransaction.findMany({
        where: { id: { in: existingRowIds } },
      });
    }
    if (rows.length === 0 && current.outwardNo) {
      rows = await tx.outgoingTransaction.findMany({
        where: {
          challanNo: current.outwardNo,
          outDate: new Date(current.outDate),
        },
      });
    }

    if (rows.length > 0) {
      await tx.outgoingTransaction.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
    }

    await tx.auditLog.delete({
      where: { id: dispatchId },
    });

    await auditRepo.createAuditEntry({
      userId: actorId,
      action: 'DELETE',
      entity: 'production_dispatch',
      entityId: productId,
      before: current,
    }, tx);

    const rev = await metaRepo.bumpRevision(tx);
    return { revision: rev };
  });

  broadcast({
    type: 'changed',
    revision: result.revision,
    entity: 'production',
    productId,
    by: actorId,
  });

  return { success: true, message: 'Production dispatch deleted and stock restored' };
}

module.exports = {
  addBomLine,
  editBomLine,
  deleteBomLine,
  calculateRequirements,
  recordProductionDispatch,
  listProductionDispatches,
  updateProductionDispatch,
  deleteProductionDispatch,
};

