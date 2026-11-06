const MaterialsPage = {
  async render(container) {
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h1 style="font-size: 22px;">Materials & Measurement Units</h1>
          <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Configure raw materials, components, and measurement units</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary btn-sm" id="add-unit-btn">+ Add Unit</button>
          <button class="btn btn-primary btn-sm" id="add-material-btn">+ Add Material</button>
        </div>
      </div>

      <!-- Materials Table -->
      <div class="card" style="margin-bottom: 30px; padding: 0; overflow: hidden;">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border);">
          <h3 class="card-title">Configured Materials</h3>
        </div>
        <div id="materials-table-container">
          <div style="text-align: center; padding: 30px; color: var(--neutral);">Loading materials...</div>
        </div>
      </div>

      <!-- Units Table -->
      <div class="card" style="padding: 0; overflow: hidden;">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border);">
          <h3 class="card-title">Measurement Units</h3>
        </div>
        <div id="units-table-container">
          <div style="text-align: center; padding: 30px; color: var(--neutral);">Loading units...</div>
        </div>
      </div>
    `;

    document.getElementById('add-material-btn').onclick = () => this.openAddMaterialModal();
    document.getElementById('add-unit-btn').onclick = () => this.openAddUnitModal();

    await this.loadAll();
  },

  async loadAll() {
    await Promise.all([this.loadMaterials(), this.loadUnits()]);
  },

  async loadMaterials() {
    const container = document.getElementById('materials-table-container');
    if (!container) return;

    try {
      const materials = await Api.get('/api/materials');
      State.materialsCache = materials;

      if (materials.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--neutral);">No materials found.</div>';
        return;
      }

      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Material Name</th>
              <th>Unit</th>
              <th>Issue Mode</th>
              <th>Spec Label</th>
              <th>Status</th>
              <th class="num-cell">Total Stock</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${materials.map((m) => `
              <tr>
                <td style="font-weight: 600;">${m.name}</td>
                <td><span class="chip chip-neutral">${m.unit ? m.unit.code : '-'}</span></td>
                <td>${m.deductBy === 'qty_x_piece_weight' ? 'Deduct Qty × Piece Weight' : 'Deduct Direct Quantity'}</td>
                <td>${m.specLabel ? `<span class="chip chip-neutral">${m.specLabel}</span>` : '-'}</td>
                <td>
                  <span class="chip ${m.isActive ? 'chip-success' : 'chip-neutral'}">
                    ${m.isActive ? 'Active' : 'Archived'}
                  </span>
                </td>
                <td class="num-cell" style="font-weight: 700; font-family: var(--font-mono);">
                  ${Format.number(m.stock || 0)} ${m.unit ? m.unit.code : ''}
                </td>
                <td style="text-align: right;">
                  <button class="btn btn-secondary btn-sm edit-mat-btn" data-id="${m.id}">Edit</button>
                  <button class="btn btn-secondary btn-sm toggle-mat-btn" data-id="${m.id}" data-active="${m.isActive}">
                    ${m.isActive ? 'Archive' : 'Activate'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      container.querySelectorAll('.edit-mat-btn').forEach((btn) => {
        btn.onclick = () => this.openEditMaterialModal(btn.getAttribute('data-id'));
      });

      container.querySelectorAll('.toggle-mat-btn').forEach((btn) => {
        btn.onclick = () => this.toggleMaterialStatus(btn.getAttribute('data-id'), btn.getAttribute('data-active') === 'true');
      });
    } catch (err) {
      container.innerHTML = `<div style="color: var(--error); padding: 20px;">${err.message}</div>`;
    }
  },

  async loadUnits() {
    const container = document.getElementById('units-table-container');
    if (!container) return;

    try {
      const units = await Api.get('/api/units');
      State.unitsCache = units;

      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 150px;">Code</th>
              <th>Full Description</th>
            </tr>
          </thead>
          <tbody>
            ${units.map((u) => `
              <tr>
                <td style="font-weight: 600; font-family: var(--font-mono);">${u.code}</td>
                <td>${u.name}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color: var(--error); padding: 20px;">${err.message}</div>`;
    }
  },

  async openAddMaterialModal() {
    const units = await Api.get('/api/units');

    Modal.open({
      title: 'Add New Material',
      bodyHtml: `
        <form id="add-material-form">
          <div class="form-group">
            <label class="form-label">Material Name</label>
            <input type="text" name="name" class="form-control" placeholder="e.g. 20 mm round bar or Rotor die cast" required>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Unit of Measure</label>
              <select name="unitId" class="form-control" required>
                ${units.map((u) => `<option value="${u.id}">${u.code} (${u.name})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Optional Specification Label</label>
              <input type="text" name="specLabel" class="form-control" placeholder="e.g. TL, Length, Size, Grade">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Issue Mode (How is stock deducted?)</label>
            <select name="deductBy" class="form-control" required>
              <option value="direct">Deduct the quantity as entered (e.g. nos, pieces)</option>
              <option value="qty_x_piece_weight">Deduct quantity × amount per piece (e.g. kg measured stock issued as counted pieces)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Notes (Optional)</label>
            <input type="text" name="notes" class="form-control" placeholder="Optional notes">
          </div>
        </form>
      `,
      confirmText: 'Create Material',
      onConfirm: async () => {
        const form = document.getElementById('add-material-form');
        await Api.post('/api/materials', {
          name: form.name.value.trim(),
          unitId: form.unitId.value,
          deductBy: form.deductBy.value,
          specLabel: form.specLabel.value.trim() || null,
          notes: form.notes.value.trim() || null,
        });

        Toast.show('Material created successfully', 'success');
        await this.loadMaterials();
        return true;
      },
    });
  },

  async openEditMaterialModal(materialId) {
    const material = State.materialsCache.find((m) => m.id === materialId);
    if (!material) return;
    const units = State.unitsCache || await Api.get('/api/units');

    Modal.open({
      title: `Edit Material — ${material.name}`,
      bodyHtml: `
        <form id="edit-material-form">
          <div class="form-group">
            <label class="form-label">Material Name</label>
            <input type="text" name="name" class="form-control" value="${material.name}" required>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Unit</label>
              <select name="unitId" class="form-control" required>
                ${units.map((u) => `<option value="${u.id}" ${u.id === material.unitId ? 'selected' : ''}>${u.code} (${u.name})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Specification Label</label>
              <input type="text" name="specLabel" class="form-control" value="${material.specLabel || ''}" placeholder="e.g. TL, Length">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Issue Mode</label>
            <select name="deductBy" class="form-control">
              <option value="direct" ${material.deductBy === 'direct' ? 'selected' : ''}>Deduct quantity directly</option>
              <option value="qty_x_piece_weight" ${material.deductBy === 'qty_x_piece_weight' ? 'selected' : ''}>Deduct quantity × piece weight</option>
            </select>
            <span style="font-size: 11px; color: var(--neutral);">Note: Cannot change issue mode if material has outgoing rows.</span>
          </div>
        </form>
      `,
      confirmText: 'Save Changes',
      onConfirm: async () => {
        const form = document.getElementById('edit-material-form');
        await Api.patch(`/api/materials/${materialId}`, {
          name: form.name.value.trim(),
          unitId: form.unitId.value,
          deductBy: form.deductBy.value,
          specLabel: form.specLabel.value.trim() || null,
          version: material.version,
        });

        Toast.show('Material updated successfully', 'success');
        await this.loadMaterials();
        return true;
      },
    });
  },

  async toggleMaterialStatus(materialId, currentActive) {
    const material = State.materialsCache.find((m) => m.id === materialId);
    if (!material) return;

    await Api.patch(`/api/materials/${materialId}`, {
      isActive: !currentActive,
      version: material.version,
    });

    Toast.show(`Material ${!currentActive ? 'activated' : 'archived'}`, 'info');
    await this.loadMaterials();
  },

  openAddUnitModal() {
    Modal.open({
      title: 'Add Measurement Unit',
      bodyHtml: `
        <form id="add-unit-form">
          <div class="form-group">
            <label class="form-label">Unit Code</label>
            <input type="text" name="code" class="form-control" placeholder="e.g. m, ltr, pcs, box" required>
          </div>
          <div class="form-group">
            <label class="form-label">Unit Description</label>
            <input type="text" name="name" class="form-control" placeholder="e.g. Meters, Litres, Boxes" required>
          </div>
        </form>
      `,
      confirmText: 'Add Unit',
      onConfirm: async () => {
        const form = document.getElementById('add-unit-form');
        await Api.post('/api/units', {
          code: form.code.value.trim(),
          name: form.name.value.trim(),
        });
        Toast.show('Unit added successfully', 'success');
        await this.loadUnits();
        return true;
      },
    });
  },
};

