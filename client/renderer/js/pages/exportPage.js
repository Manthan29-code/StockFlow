const ExportPage = {
  materials: [],

  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px;">Excel Export Center</h1>
        <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Export material ledgers and product BOMs to formatted Excel (.xlsx) workbooks</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
        <!-- Option 1: Export Single Material -->
        <div class="card">
          <h3 class="card-title" style="margin-bottom: 8px;">Export Single Material Ledger</h3>
          <p style="color: var(--neutral); font-size: 13px; margin-bottom: 20px;">
            Generates a dedicated workbook for one material with all incoming challans, outgoing dispatch rows, and running balances in the exact report format.
          </p>
          <div class="form-group">
            <label class="form-label">Select Material</label>
            <select id="export-single-select" class="form-control" style="font-weight: 600;"></select>
          </div>
          <button class="btn btn-primary" id="export-single-btn" style="width: 100%;">
            Export Selected Material (.xlsx)
          </button>
        </div>

        <!-- Option 2: Export All Workbooks Live -->
        <div class="card">
          <h3 class="card-title" style="margin-bottom: 8px;">Export Entire System to Folder</h3>
          <p style="color: var(--neutral); font-size: 13px; margin-bottom: 20px;">
            Exports all materials (one .xlsx file per material) plus the complete Product BOM file into a directory of your choice on disk.
          </p>
          <div style="padding: 12px; background: var(--surface); border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 20px; font-size: 12.5px; color: var(--text-secondary);">
            &bull; One workbook per active material<br>
            &bull; Master <code>BOM - DD-MM-YYYY.xlsx</code> for all products<br>
            &bull; Live recalculated running balances
          </div>
          <button class="btn btn-primary" id="export-all-btn" style="width: 100%;">
            Export All to Folder
          </button>
        </div>

        <!-- Option 3: Export from Backup JSON File (Works Offline!) -->
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h3 class="card-title">Export from Backup File</h3>
            <span class="chip chip-success" style="font-size: 11px;">Works Offline</span>
          </div>
          <p style="color: var(--neutral); font-size: 13px; margin-bottom: 20px;">
            Choose a saved backup JSON file from your disk. Generates all original Excel files even if the server and database are completely unreachable.
          </p>
          <div style="padding: 12px; background: var(--surface); border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 20px; font-size: 12.5px; color: var(--text-secondary);">
            &bull; Independent client-side recalculation<br>
            &bull; Zero dependency on live server connection<br>
            &bull; Perfect for disaster recovery and archives
          </div>
          <button class="btn btn-secondary" id="export-from-backup-btn" style="width: 100%;">
            Select Backup File & Export (.xlsx)
          </button>
        </div>
      </div>
    `;

    await this.initMaterials();

    document.getElementById('export-single-btn').onclick = () => this.exportSingle();
    document.getElementById('export-all-btn').onclick = () => this.exportAll();
    document.getElementById('export-from-backup-btn').onclick = () => this.exportFromBackup();
  },

  async initMaterials() {
    try {
      const materials = await Api.get('/api/materials');
      this.materials = materials;
      const select = document.getElementById('export-single-select');
      if (select && materials.length > 0) {
        select.innerHTML = materials.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
      }
    } catch (err) {
      console.error(err);
    }
  },

  async exportSingle() {
    const select = document.getElementById('export-single-select');
    const materialId = select.value;
    if (!materialId) {
      Toast.show('Please select a material first', 'warning');
      return;
    }

    try {
      const res = await window.api.exportMaterial(materialId);
      if (!res.canceled) {
        Toast.show(`Workbook saved: ${res.filePath}`, 'success');
      }
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  async exportAll() {
    try {
      Toast.show('Generating workbooks...', 'info', 2000);
      const res = await window.api.exportAll();
      if (!res.canceled) {
        Toast.show(`Successfully exported ${res.savedFiles.length} workbooks to ${res.targetDir}`, 'success', 6000);
      }
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  async exportFromBackup() {
    try {
      const res = await window.api.exportFromBackup();
      if (!res.canceled) {
        Toast.show(`Successfully exported ${res.savedFiles.length} workbooks from backup to ${res.targetDir}`, 'success', 6000);
      }
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },
};

