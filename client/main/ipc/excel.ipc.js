const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { request } = require('../httpClient');
const { buildAllWorkbooks } = require('../excel/workbookBuilder');
const { createMaterialWorkbook } = require('../excel/materialSheet');
const { createBomWorkbook } = require('../excel/bomSheet');
const { getMaterialFileName } = require('../excel/fileNames');
const { parseMaterialWorkbook } = require('../excel/importParser');
const { parseBomWorkbook } = require('../excel/bomImportParser');

function registerExcelIpc() {
  // Export single material
  ipcMain.handle('excel:exportMaterial', async (event, { materialId }) => {
    const ledger = await request({ method: 'GET', path: `/api/materials/${materialId}/ledger` });
    const workbook = createMaterialWorkbook(ledger.material, ledger.entries);
    const defaultName = getMaterialFileName(ledger.material.name);

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Material Ledger',
      defaultPath: defaultName,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });

    if (canceled || !filePath) return { canceled: true };

    await workbook.xlsx.writeFile(filePath);
    return { canceled: false, filePath };
  });

  // Export all materials + BOM from live dataset
  ipcMain.handle('excel:exportAll', async () => {
    const dataset = await request({ method: 'GET', path: '/api/dataset' });
    const { materialWorkbooks, bomWorkbook } = buildAllWorkbooks(dataset);

    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Destination Folder for Excel Export',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };
    const targetDir = filePaths[0];

    const savedFiles = [];

    // Save each material
    for (const item of materialWorkbooks) {
      const fullPath = path.join(targetDir, item.fileName);
      await item.workbook.xlsx.writeFile(fullPath);
      savedFiles.push(item.fileName);
    }

    // Save BOM
    const bomPath = path.join(targetDir, bomWorkbook.fileName);
    await bomWorkbook.workbook.xlsx.writeFile(bomPath);
    savedFiles.push(bomWorkbook.fileName);

    return { canceled: false, targetDir, savedFiles };
  });

  // Export BOM for a specific party or all parties
  ipcMain.handle('excel:exportPartyBom', async (event, { partyId } = {}) => {
    const dataset = await request({ method: 'GET', path: '/api/dataset' });
    const data = dataset.data || dataset;
    const parties = (data.parties || []).filter((p) => !partyId || p.id === partyId);
    const selectedParty = (data.parties || []).find((p) => p.id === partyId);
    const products = (data.products || []).filter((p) => !partyId || p.partyId === partyId);
    const materials = data.materials || [];
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

    const workbook = createBomWorkbook(parties, enrichedProducts, materialsMap);
    const safePartyName = selectedParty ? selectedParty.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() : 'All';
    const defaultName = `${safePartyName}_BOM.xlsx`;

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: selectedParty ? `Export BOM for ${selectedParty.name}` : 'Export BOM',
      defaultPath: defaultName,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });

    if (canceled || !filePath) return { canceled: true };

    await workbook.xlsx.writeFile(filePath);
    return { canceled: false, filePath };
  });

  // Export all from backup JSON file (works even if server is down)
  ipcMain.handle('excel:exportFromBackup', async () => {
    const { canceled: openCanceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Backup JSON File',
      filters: [{ name: 'JSON Backup Files', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (openCanceled || !filePaths || filePaths.length === 0) return { canceled: true };
    const backupFilePath = filePaths[0];

    const rawData = fs.readFileSync(backupFilePath, 'utf8');
    const backupJson = JSON.parse(rawData);

    const { materialWorkbooks, bomWorkbook } = buildAllWorkbooks(backupJson);

    const { canceled: dirCanceled, filePaths: dirPaths } = await dialog.showOpenDialog({
      title: 'Select Destination Folder for Exported Excel Files',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (dirCanceled || !dirPaths || dirPaths.length === 0) return { canceled: true };
    const targetDir = dirPaths[0];

    const savedFiles = [];
    for (const item of materialWorkbooks) {
      const fullPath = path.join(targetDir, item.fileName);
      await item.workbook.xlsx.writeFile(fullPath);
      savedFiles.push(item.fileName);
    }

    const bomPath = path.join(targetDir, bomWorkbook.fileName);
    await bomWorkbook.workbook.xlsx.writeFile(bomPath);
    savedFiles.push(bomWorkbook.fileName);

    return { canceled: false, targetDir, savedFiles };
  });

  // Select and parse material sheet for import preview
  ipcMain.handle('excel:parseMaterialSheet', async (event, { material, customColumnMap }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: `Select Excel Sheet for ${material.name}`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile'],
    });

    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };
    const filePath = filePaths[0];

    const parseResult = await parseMaterialWorkbook(filePath, material, customColumnMap);
    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
      ...parseResult,
    };
  });

  // Select and parse BOM sheet for import preview
  ipcMain.handle('excel:parseBomSheet', async (event, { existingMaterials }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select BOM Excel Sheet',
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile'],
    });

    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };
    const filePath = filePaths[0];

    const parseResult = await parseBomWorkbook(filePath, existingMaterials);
    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
      ...parseResult,
    };
  });
}

module.exports = {
  registerExcelIpc,
};

