const ExportPage = {
  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px;">Excel Export Center</h1>
        <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Export complete material ledgers and product BOMs to formatted Excel (.xlsx) workbooks</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 24px;">
        <!-- Option 1: Export All Workbooks Live -->
        <div class="card" style="padding: 24px;">
          <h3 class="card-title" style="margin-bottom: 8px;">Export Entire System to Folder</h3>
          <p style="color: var(--neutral); font-size: 13px; margin-bottom: 20px;">
            Exports all materials (one .xlsx file per material) plus the complete Product BOM file into a directory of your choice on disk.
          </p>
          <div style="padding: 14px; background: var(--surface); border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 22px; font-size: 12.5px; color: var(--text-secondary); line-height: 1.8;">
            &bull; One workbook per active material<br>
            &bull; Master <code>BOM - DD-MM-YYYY.xlsx</code> for all products<br>
            &bull; Live recalculated running balances
          </div>
          <button class="btn btn-primary" id="export-all-btn" style="width: 100%; height: 40px; font-weight: 600;">
            Export All to Folder
          </button>
        </div>

        <!-- Option 2: Export from Backup JSON File (Works Offline!) -->
        <div class="card" style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h3 class="card-title">Export from Backup File</h3>
            <span class="chip chip-success" style="font-size: 11px;">Works Offline</span>
          </div>
          <p style="color: var(--neutral); font-size: 13px; margin-bottom: 20px;">
            Choose a saved backup JSON file from your disk. Generates all original Excel files even if the server and database are completely unreachable.
          </p>
          <div style="padding: 14px; background: var(--surface); border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 22px; font-size: 12.5px; color: var(--text-secondary); line-height: 1.8;">
            &bull; Independent client-side recalculation<br>
            &bull; Zero dependency on live server connection<br>
            &bull; Perfect for disaster recovery and archives
          </div>
          <button class="btn btn-secondary" id="export-from-backup-btn" style="width: 100%; height: 40px; font-weight: 600;">
            Select Backup File & Export (.xlsx)
          </button>
        </div>
      </div>
    `;

    const allBtn = document.getElementById('export-all-btn');
    if (allBtn) allBtn.onclick = () => this.exportAll();
    const backupBtn = document.getElementById('export-from-backup-btn');
    if (backupBtn) backupBtn.onclick = () => this.exportFromBackup();
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
