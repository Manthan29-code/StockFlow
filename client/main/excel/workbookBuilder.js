const { calculateEntryLedger } = require('@stockflow/shared');
const { createMaterialWorkbook } = require('./materialSheet');
const { createBomWorkbook } = require('./bomSheet');
const { getMaterialFileName, getBomFileName } = require('./fileNames');

/**
 * Builds all workbooks from a dataset JSON (live or from backup file)
 * Recalculates every balance with shared/calc.js!
 * @param {Object} dataset - { data: { materials, incoming_entries, outgoing_transactions, parties, products, bom_lines, units } }
 * @returns {{ materialWorkbooks: Array<{ material: Object, workbook: Object, fileName: string }>, bomWorkbook: { workbook: Object, fileName: string } }}
 */
function buildAllWorkbooks(dataset) {
  const data = dataset.data || dataset;
  const materials = data.materials || [];
  const incomingEntries = data.incoming_entries || [];
  const outgoingRows = data.outgoing_transactions || [];
  const parties = data.parties || [];
  const products = data.products || [];
  const bomLines = data.bom_lines || [];
  const units = data.units || [];

  const unitsMap = new Map(units.map((u) => [u.id, u]));
  const materialsMap = new Map(
    materials.map((m) => [
      m.id,
      {
        ...m,
        unit: m.unit || unitsMap.get(m.unitId) || null,
      },
    ])
  );

  // Group outgoing rows by incomingEntryId
  const rowsByEntryId = new Map();
  for (const row of outgoingRows) {
    const entryId = row.incomingEntryId || row.incoming_entry_id;
    if (!rowsByEntryId.has(entryId)) {
      rowsByEntryId.set(entryId, []);
    }
    rowsByEntryId.get(entryId).push(row);
  }

  // Group incoming entries by materialId
  const entriesByMaterialId = new Map();
  for (const entry of incomingEntries) {
    const matId = entry.materialId || entry.material_id;
    if (!entriesByMaterialId.has(matId)) {
      entriesByMaterialId.set(matId, []);
    }
    entriesByMaterialId.get(matId).push(entry);
  }

  // 1. Build Material Workbooks
  const materialWorkbooks = materials.map((material) => {
    const rawEntries = entriesByMaterialId.get(material.id) || [];

    // Recalculate running balances using shared/calc
    const entriesWithLedger = rawEntries.map((entry) => {
      const entryRows = rowsByEntryId.get(entry.id) || [];
      const ledger = calculateEntryLedger(
        { quantity: String(entry.quantity) },
        entryRows.map((r) => ({
          outDate: r.outDate || r.out_date,
          rowNo: r.rowNo ?? r.row_no,
          challanNo: r.challanNo || r.challan_no,
          qty: String(r.qty),
          pieceWeight: r.pieceWeight ?? r.piece_weight ?? null,
          specValue: r.specValue ?? r.spec_value ?? null,
          totalWeight: r.totalWeight ?? r.total_weight ?? null,
          deducted: r.deducted ? String(r.deducted) : undefined,
        })),
        material.deductBy || material.deduct_by
      );

      return {
        ...entry,
        outgoingRows: ledger.rows,
        balance: ledger.finalBalance,
      };
    });

    const workbook = createMaterialWorkbook(material, entriesWithLedger);
    const fileName = getMaterialFileName(material.name);

    return {
      material,
      workbook,
      fileName,
    };
  });

  // 2. Build BOM Workbook
  // Enrich products with bomLines
  const linesByProductId = new Map();
  for (const line of bomLines) {
    const pId = line.productId || line.product_id;
    if (!linesByProductId.has(pId)) {
      linesByProductId.set(pId, []);
    }
    linesByProductId.get(pId).push(line);
  }

  const enrichedProducts = products.map((prod) => ({
    ...prod,
    bomLines: linesByProductId.get(prod.id) || prod.bomLines || [],
  }));

  const bomWb = createBomWorkbook(parties, enrichedProducts, materialsMap);
  const bomFileName = getBomFileName();

  return {
    materialWorkbooks,
    bomWorkbook: {
      workbook: bomWb,
      fileName: bomFileName,
    },
  };
}

module.exports = {
  buildAllWorkbooks,
};

