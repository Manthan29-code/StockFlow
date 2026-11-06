const BomEditorPage = {
  currentProductId: null,
  products: [],
  materials: [],
  productData: null,

  async render(container, queryParams = {}) {
    this.currentProductId = queryParams.productId || this.currentProductId;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h1 style="font-size: 22px;">Bill of Materials (BOM) Editor</h1>
          <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Define required materials and expected consumption per finished product</p>
        </div>
        <button class="btn btn-primary btn-sm" id="add-bom-line-btn">+ Add BOM Line</button>
      </div>

      <div class="card" style="margin-bottom: 20px; padding: 16px 20px;">
        <div style="display: flex; gap: 20px; align-items: center;">
          <div style="flex: 1; max-width: 400px;">
            <label class="form-label">Select Product</label>
            <select id="bom-product-select" class="form-control" style="font-weight: 600;"></select>
          </div>
          <div id="product-meta-info" style="margin-top: 22px; font-size: 13.5px; color: var(--neutral);"></div>
        </div>
      </div>

      <!-- BOM Lines Table -->
      <div class="card" style="padding: 0; overflow: hidden;">
        <div style="padding: 14px 20px; border-bottom: 1px solid var(--border); background: var(--surface);">
          <h3 class="card-title" style="font-size: 14px;">Required Materials / Components</h3>
        </div>
        <div id="bom-lines-table-container">
          <div style="padding: 30px; text-align: center; color: var(--neutral);">Loading BOM lines...</div>
        </div>
      </div>
    `;

    document.getElementById('add-bom-line-btn').onclick = () => this.openAddBomLineModal();

    await this.initData();
  },

  async initData() {
    try {
      const [products, materials] = await Promise.all([
        Api.get('/api/products'),
        Api.get('/api/materials'),
      ]);

      this.products = products;
      this.materials = materials;

      const select = document.getElementById('bom-product-select');
      if (!select) return;

      if (products.length === 0) {
        select.innerHTML = '<option value="">No products created yet</option>';
        document.getElementById('bom-lines-table-container').innerHTML = `
          <div style="padding: 30px; text-align: center; color: var(--neutral);">Please create a product first.</div>
        `;
        return;
      }

      select.innerHTML = products.map((p) => {
        const partyName = p.party ? p.party.name : 'Unknown Party';
        return `<option value="${p.id}" ${p.id === this.currentProductId ? 'selected' : ''}>${partyName} — ${p.name}</option>`;
      }).join('');

      if (!this.currentProductId || !products.some((p) => p.id === this.currentProductId)) {
        this.currentProductId = products[0].id;
      }
      select.value = this.currentProductId;

      select.onchange = () => {
        this.currentProductId = select.value;
        this.loadProductBom();
      };

      await this.loadProductBom();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  async loadProductBom() {
    if (!this.currentProductId) return;

    try {
      const product = await Api.get(`/api/products/${this.currentProductId}`);
      this.productData = product;

      const partyName = product.party ? product.party.name : '';
      document.getElementById('product-meta-info').innerHTML = `
        Customer: <strong>${partyName}</strong> &bull; Total Required Materials: <strong>${(product.bomLines || []).length}</strong>
      `;

      this.renderBomLines();
    } catch (err) {
      document.getElementById('bom-lines-table-container').innerHTML = `
        <div style="color: var(--error); padding: 20px;">Failed to load BOM: ${err.message}</div>
      `;
    }
  },

  renderBomLines() {
    const container = document.getElementById('bom-lines-table-container');
    if (!container || !this.productData) return;

    const lines = this.productData.bomLines || [];
    if (lines.length === 0) {
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--neutral);">
          <p>No materials defined in BOM for this product.</p>
          <button class="btn btn-primary btn-sm" id="empty-add-bom-line" style="margin-top: 10px;">+ Add First Line</button>
        </div>
      `;
      const btn = document.getElementById('empty-add-bom-line');
      if (btn) btn.onclick = () => this.openAddBomLineModal();
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Material / Component</th>
            <th>Specification Detail</th>
            <th class="num-cell">Consumption per Unit</th>
            <th>Unit</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map((line) => {
            const material = line.material || {};
            const unitCode = material.unit ? material.unit.code : '';
            const specLabel = material.specLabel || 'Spec';

            return `
              <tr>
                <td style="font-weight: 600; color: var(--secondary);">${material.name || 'Unknown'}</td>
                <td>
                  ${line.specValue ? `<span class="chip chip-neutral">${specLabel}: ${line.specValue}</span>` : '-'}
                </td>
                <td class="num-cell" style="font-weight: 700; font-family: var(--font-mono); font-size: 14px;">
                  ${Format.number(line.consumption)}
                </td>
                <td><span class="chip chip-neutral">${unitCode}</span></td>
                <td style="text-align: right;">
                  <button class="btn btn-secondary btn-sm edit-bom-btn" data-id="${line.id}">Edit</button>
                  <button class="btn btn-secondary btn-sm delete-bom-btn" data-id="${line.id}" style="color: var(--error);">Delete</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.edit-bom-btn').forEach((btn) => {
      btn.onclick = () => this.openEditBomLineModal(btn.getAttribute('data-id'));
    });

    container.querySelectorAll('.delete-bom-btn').forEach((btn) => {
      btn.onclick = () => this.confirmDeleteBomLine(btn.getAttribute('data-id'));
    });
  },

  openAddBomLineModal() {
    if (!this.currentProductId) return;

    Modal.open({
      title: 'Add Material to BOM',
      bodyHtml: `
        <form id="add-bom-line-form">
          <div class="form-group">
            <label class="form-label">Select Raw Material or Component</label>
            <select name="materialId" id="bom-mat-picker" class="form-control" required>
              ${this.materials.map((m) => `<option value="${m.id}">${m.name} (${m.unit ? m.unit.code : ''})</option>`).join('')}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Consumption per finished unit</label>
              <input type="number" step="any" name="consumption" class="form-control" placeholder="e.g. 0.700 or 1" required>
            </div>
            <div class="form-group">
              <label class="form-label">Specification Value (Optional)</label>
              <input type="text" name="specValue" class="form-control" placeholder="e.g. 271 or TL271">
            </div>
          </div>
        </form>
      `,
      confirmText: 'Add to BOM',
      onConfirm: async () => {
        const form = document.getElementById('add-bom-line-form');
        await Api.post(`/api/products/${this.currentProductId}/bom-lines`, {
          materialId: form.materialId.value,
          consumption: form.consumption.value,
          specValue: form.specValue.value.trim() || null,
        });

        Toast.show('BOM line added', 'success');
        await this.loadProductBom();
        return true;
      },
    });
  },

  openEditBomLineModal(lineId) {
    const line = (this.productData.bomLines || []).find((l) => l.id === lineId);
    if (!line) return;

    Modal.open({
      title: `Edit BOM Line — ${line.material ? line.material.name : ''}`,
      bodyHtml: `
        <form id="edit-bom-line-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Consumption</label>
              <input type="number" step="any" name="consumption" class="form-control" value="${line.consumption}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Specification Value</label>
              <input type="text" name="specValue" class="form-control" value="${line.specValue || ''}">
            </div>
          </div>
        </form>
      `,
      confirmText: 'Save Changes',
      onConfirm: async () => {
        const form = document.getElementById('edit-bom-line-form');
        await Api.patch(`/api/bom-lines/${lineId}`, {
          consumption: form.consumption.value,
          specValue: form.specValue.value.trim() || null,
          version: line.version,
        });

        Toast.show('BOM line updated', 'success');
        await this.loadProductBom();
        return true;
      },
    });
  },

  confirmDeleteBomLine(lineId) {
    Modal.confirm({
      title: 'Remove BOM Line',
      message: 'Are you sure you want to remove this material requirement from the product BOM?',
      confirmText: 'Remove Line',
      onConfirm: async () => {
        await Api.delete(`/api/bom-lines/${lineId}`);
        Toast.show('BOM line removed', 'success');
        await this.loadProductBom();
      },
    });
  },
};

