const ExportPage = {
  materials: [],
  selectedMaterialId: null,

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
          <div class="form-group" style="position: relative;">
            <label class="form-label">Search / Select Material</label>
            <div style="position: relative;">
              <input type="text" id="export-material-search" class="form-control" autocomplete="off" style="font-weight: 600; padding-right: 28px;">
              <span id="export-material-clear" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--neutral); font-size: 14px; display: none;">&times;</span>
            </div>
            <div id="export-material-dropdown" class="card no-scrollbar" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; width: 100%; max-height: 240px; overflow-y: auto; z-index: 100; box-shadow: var(--shadow-lg); padding: 4px 0; border: 1px solid var(--border); background: #FFFFFF;"></div>
          </div>
          <button class="btn btn-primary" id="export-single-btn" style="width: 100%; margin-top: 14px;">
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

    const singleBtn = document.getElementById('export-single-btn');
    if (singleBtn) singleBtn.onclick = () => this.exportSingle();
    const allBtn = document.getElementById('export-all-btn');
    if (allBtn) allBtn.onclick = () => this.exportAll();
    const backupBtn = document.getElementById('export-from-backup-btn');
    if (backupBtn) backupBtn.onclick = () => this.exportFromBackup();

    await this.initMaterials();
  },

  async initMaterials() {
    const searchInput = document.getElementById('export-material-search');
    const dropdown = document.getElementById('export-material-dropdown');
    const clearBtn = document.getElementById('export-material-clear');
    if (!searchInput || !dropdown) return;

    try {
      const materials = await Api.get('/api/materials');
      this.materials = materials;

      if (materials.length === 0) {
        searchInput.value = '';
        searchInput.disabled = true;
        return;
      }

      this.selectedMaterialId = materials[0].id;
      searchInput.value = materials[0].name;

      const renderItems = (filterText = '') => {
        const query = filterText.toLowerCase().trim();
        const matches = materials.filter((m) => m.name.toLowerCase().includes(query));

        if (matches.length === 0) {
          dropdown.innerHTML = '<div style="padding: 10px 14px; color: var(--neutral); font-size: 12.5px; text-align: center;">No matching materials</div>';
          dropdown.style.display = 'block';
          return;
        }

        dropdown.innerHTML = matches.map((m) => {
          const isSelected = m.id === this.selectedMaterialId;
          const unitCode = m.unit ? m.unit.code : '';
          return `
            <div class="export-mat-item" data-id="${m.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: ${isSelected ? '#F0F4FF' : '#FFFFFF'};">
              <div>
                <div style="font-weight: ${isSelected ? '600' : '500'}; font-size: 13px; color: var(--secondary);">${m.name}</div>
                <div style="font-size: 11px; color: var(--neutral);">${unitCode}</div>
              </div>
              ${isSelected ? '<span class="chip chip-success" style="font-size: 10px;">Selected</span>' : ''}
            </div>
          `;
        }).join('');

        dropdown.querySelectorAll('.export-mat-item').forEach((item) => {
          item.onclick = (e) => {
            e.stopPropagation();
            const id = item.getAttribute('data-id');
            const chosen = materials.find((m) => m.id === id);
            this.selectedMaterialId = id;
            searchInput.value = chosen ? chosen.name : '';
            dropdown.style.display = 'none';
            if (clearBtn) clearBtn.style.display = 'none';
          };
        });

        dropdown.style.display = 'block';
      };

      searchInput.onfocus = () => {
        renderItems(searchInput.value);
        searchInput.select();
      };

      searchInput.oninput = () => {
        const val = searchInput.value;
        if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
        renderItems(val);
      };

      if (clearBtn) {
        clearBtn.onclick = (e) => {
          e.stopPropagation();
          searchInput.value = '';
          clearBtn.style.display = 'none';
          searchInput.focus();
          renderItems('');
        };
      }

      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target) && (!clearBtn || !clearBtn.contains(e.target))) {
          dropdown.style.display = 'none';
          const activeMat = materials.find((m) => m.id === this.selectedMaterialId);
          if (activeMat && (!searchInput.value || !materials.some((m) => m.name.toLowerCase() === searchInput.value.toLowerCase().trim()))) {
            searchInput.value = activeMat.name;
          }
        }
      });
    } catch (err) {
      console.error(err);
    }
  },

  async exportSingle() {
    const materialId = this.selectedMaterialId;
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

