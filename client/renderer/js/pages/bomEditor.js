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

    let selectedMaterial = null;

    Modal.open({
      title: 'Add Material to BOM',
      width: '540px',
      bodyHtml: `
        <form id="add-bom-line-form">
          <div class="form-group" style="position: relative;">
            <label class="form-label">Select Raw Material or Component</label>
            <div style="position: relative;">
              <input type="text" id="bom-mat-search" class="form-control" autocomplete="off" style="font-weight: 600; padding-right: 30px;" required>
              <span id="bom-mat-clear" title="Clear / View All" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--neutral); font-size: 16px; font-weight: bold; line-height: 1; user-select: none;">&times;</span>
            </div>
            <input type="hidden" name="materialId" id="bom-mat-hidden-id" required>
            <!-- Autocomplete Dropdown List -->
            <div id="bom-mat-dropdown" class="card no-scrollbar" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; width: 100%; max-height: 220px; overflow-y: auto; z-index: 1100; box-shadow: var(--shadow-lg); padding: 4px 0; border: 1px solid var(--border); background: #FFFFFF;"></div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" id="bom-mat-consumption-label">Consumption per finished unit</label>
              <input type="number" step="any" name="consumption" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label" id="bom-mat-spec-label">Specification Value (Optional)</label>
              <input type="text" name="specValue" id="bom-mat-spec-input" class="form-control">
            </div>
          </div>
        </form>
      `,
      confirmText: 'Add to BOM',
      onConfirm: async () => {
        const form = document.getElementById('add-bom-line-form');
        const materialId = form.materialId.value;
        if (!materialId) {
          Toast.show('Please select a raw material from the list', 'error');
          return false;
        }
        if (!form.consumption.value) {
          Toast.show('Please enter consumption per unit', 'error');
          return false;
        }

        await Api.post(`/api/products/${this.currentProductId}/bom-lines`, {
          materialId,
          consumption: form.consumption.value,
          specValue: form.specValue.value.trim() || null,
        });

        Toast.show('BOM line added', 'success');
        await this.loadProductBom();
        return true;
      },
    });

    const searchInput = document.getElementById('bom-mat-search');
    const hiddenId = document.getElementById('bom-mat-hidden-id');
    const dropdown = document.getElementById('bom-mat-dropdown');
    const clearBtn = document.getElementById('bom-mat-clear');
    const specLabelEl = document.getElementById('bom-mat-spec-label');
    const consumptionLabelEl = document.getElementById('bom-mat-consumption-label');

    if (!searchInput || !dropdown) return;

    const selectItem = (m) => {
      selectedMaterial = m;
      searchInput.value = m.name;
      hiddenId.value = m.id;
      const unitCode = m.unit ? m.unit.code : '';
      if (consumptionLabelEl) {
        consumptionLabelEl.innerHTML = `Consumption per finished unit ${unitCode ? `(in <strong>${unitCode}</strong>)` : ''}`;
      }
      if (specLabelEl) {
        const labelText = m.specLabel || 'Specification';
        specLabelEl.textContent = `${labelText} Value ${m.specRequired ? '(Required)' : '(Optional)'}`;
      }
    };

    const renderDropdown = (query = '') => {
      const q = query.toLowerCase().trim();
      const matches = this.materials.filter((m) => {
        if (!q) return true;
        const name = (m.name || '').toLowerCase();
        const unit = (m.unit ? m.unit.code : '').toLowerCase();
        const mode = (m.mode || '').toLowerCase();
        return name.includes(q) || unit.includes(q) || mode.includes(q);
      });

      if (matches.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px 16px; color: var(--neutral); font-size: 13px;">No matching materials found</div>';
        dropdown.style.display = 'block';
        return;
      }

      dropdown.innerHTML = matches.map((m) => {
        const isSelected = selectedMaterial && selectedMaterial.id === m.id;
        const unitCode = m.unit ? m.unit.code : '';
        const modeLabel = m.mode ? m.mode.replace(/_/g, ' ') : '';
        return `
          <div class="mat-search-item" data-id="${m.id}" style="padding: 9px 14px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: ${isSelected ? '#F0F4FF' : '#FFFFFF'}; transition: background 0.15s;">
            <div>
              <div style="font-weight: ${isSelected ? '700' : '600'}; font-size: 13.5px; color: var(--secondary);">${m.name}</div>
              <div style="font-size: 11.5px; color: var(--neutral); margin-top: 2px;">
                Unit: <strong>${unitCode}</strong> &bull; Mode: <strong>${modeLabel}</strong>
              </div>
            </div>
            ${isSelected ? '<span class="chip chip-success" style="font-size: 10.5px; padding: 2px 7px;">Selected</span>' : ''}
          </div>
        `;
      }).join('');

      dropdown.querySelectorAll('.mat-search-item').forEach((item) => {
        item.onmouseenter = () => {
          if (!selectedMaterial || item.getAttribute('data-id') !== selectedMaterial.id) {
            item.style.backgroundColor = '#F8FAFC';
          }
        };
        item.onmouseleave = () => {
          if (!selectedMaterial || item.getAttribute('data-id') !== selectedMaterial.id) {
            item.style.backgroundColor = '#FFFFFF';
          }
        };
        item.onclick = (e) => {
          e.stopPropagation();
          const id = item.getAttribute('data-id');
          const found = this.materials.find((m) => m.id === id);
          if (found) {
            selectItem(found);
            dropdown.style.display = 'none';
          }
        };
      });

      dropdown.style.display = 'block';
    };

    searchInput.onfocus = () => renderDropdown(searchInput.value);
    searchInput.oninput = () => {
      if (selectedMaterial && searchInput.value !== selectedMaterial.name) {
        hiddenId.value = '';
      }
      renderDropdown(searchInput.value);
    };

    if (clearBtn) {
      clearBtn.onclick = (e) => {
        e.stopPropagation();
        searchInput.value = '';
        hiddenId.value = '';
        selectedMaterial = null;
        if (consumptionLabelEl) consumptionLabelEl.textContent = 'Consumption per finished unit';
        if (specLabelEl) specLabelEl.textContent = 'Specification Value (Optional)';
        searchInput.focus();
        renderDropdown('');
      };
    }

    const clickOutsideMatDropdown = (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    };
    document.addEventListener('click', clickOutsideMatDropdown);
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

