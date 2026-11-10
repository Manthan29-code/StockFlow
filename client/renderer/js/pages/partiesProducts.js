const PartiesProductsPage = {
  parties: [],
  products: [],
  selectedPartyId: null,

  async render(container) {
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
        <div>
          <h1 style="font-size: 22px;">Parties & Products</h1>
          <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Manage customer parties and finished manufactured products</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary btn-sm" id="export-bom-btn">Export BOM (Excel)</button>
          <button class="btn btn-secondary btn-sm" id="add-party-btn">+ Add Party</button>
          <button class="btn btn-primary btn-sm" id="add-product-btn">+ Add Product</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 280px 1fr; gap: 20px; height: 450px;">
        <!-- Parties List Panel -->
        <div class="card" style="padding: 0; overflow: hidden; height: 100%; display: flex; flex-direction: column;">
          <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0;">
            <h3 class="card-title" style="font-size: 14px; margin-bottom: 8px;">Parties / Customers</h3>
            <div style="position: relative;">
              <input type="text" id="party-search-input" class="form-control" placeholder="Search parties..." autocomplete="off" style="height: 32px; font-size: 12.5px; padding-right: 26px;">
              <span id="party-search-clear" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--neutral); font-size: 14px; display: none; line-height: 1;">&times;</span>
            </div>
          </div>
          <div id="parties-list" class="no-scrollbar" style="flex: 1; overflow-y: auto;">
            <div style="padding: 20px; text-align: center; color: var(--neutral);">Loading...</div>
          </div>
        </div>

        <!-- Products for selected party -->
        <div class="card" style="padding: 0; overflow: hidden; height: 100%; display: flex; flex-direction: column;">
          <div style="padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <h3 class="card-title" id="products-header-title">Products</h3>
              <span id="product-count-badge" class="chip chip-neutral">0 Products</span>
            </div>
            <button class="btn btn-secondary btn-sm" id="panel-export-bom-btn" style="padding: 3px 10px; font-size: 12px;">
              Export BOM (.xlsx)
            </button>
          </div>
          <div id="products-table-container" class="no-scrollbar" style="flex: 1; overflow-y: auto;">
            <div style="padding: 30px; text-align: center; color: var(--neutral);">Select a party to view products</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('add-party-btn').onclick = () => this.openAddPartyModal();
    document.getElementById('add-product-btn').onclick = () => this.openAddProductModal();
    document.getElementById('export-bom-btn').onclick = () => this.exportCurrentBom();
    const panelExport = document.getElementById('panel-export-bom-btn');
    if (panelExport) panelExport.onclick = () => this.exportCurrentBom();

    const partySearch = document.getElementById('party-search-input');
    const partyClear = document.getElementById('party-search-clear');
    if (partySearch) {
      partySearch.oninput = () => {
        const val = partySearch.value;
        if (partyClear) partyClear.style.display = val ? 'block' : 'none';
        this.renderParties(val);
      };
    }
    if (partyClear) {
      partyClear.onclick = () => {
        partySearch.value = '';
        partyClear.style.display = 'none';
        partySearch.focus();
        this.renderParties('');
      };
    }

    await this.loadData();
  },

  async exportCurrentBom() {
    try {
      const res = await window.api.exportPartyBom(this.selectedPartyId);
      if (res && !res.canceled) {
        Toast.show(`BOM exported successfully to Excel`, 'success');
      }
    } catch (err) {
      Toast.show(`Export failed: ${err.message}`, 'error');
    }
  },

  async loadData() {
    try {
      const [parties, products] = await Promise.all([
        Api.get('/api/parties'),
        Api.get('/api/products'),
      ]);

      this.parties = parties;
      this.products = products;

      if (!this.selectedPartyId && parties.length > 0) {
        this.selectedPartyId = parties[0].id;
      }

      const partySearch = document.getElementById('party-search-input');
      this.renderParties(partySearch ? partySearch.value : '');
      this.renderProducts();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  renderParties(filterQuery = '') {
    const list = document.getElementById('parties-list');
    if (!list) return;

    if (this.parties.length === 0) {
      list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--neutral);">No parties yet.</div>';
      return;
    }

    const query = (filterQuery || '').trim().toLowerCase();
    const filteredParties = query
      ? this.parties.filter((p) => p.name.toLowerCase().includes(query))
      : this.parties;

    if (filteredParties.length === 0) {
      list.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--neutral); font-size: 13px;">No parties matching "${filterQuery}"</div>`;
      return;
    }

    list.innerHTML = filteredParties.map((party) => {
      const count = this.products.filter((p) => p.partyId === party.id).length;
      const isSelected = party.id === this.selectedPartyId;

      return `
        <div class="party-item" data-id="${party.id}" style="padding: 12px 18px; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: ${isSelected ? '#F0F4FF' : '#FFFFFF'}; border-left: ${isSelected ? '3px solid var(--primary)' : '3px solid transparent'};">
          <div>
            <div style="font-weight: ${isSelected ? '600' : '500'}; color: var(--secondary);">${party.name}</div>
            <div style="font-size: 11.5px; color: var(--neutral); margin-top: 2px;">${count} products</div>
          </div>
          ${State.isAdmin() ? `
            <button class="btn btn-secondary btn-sm edit-party-btn" data-id="${party.id}" style="padding: 2px 6px; font-size: 11px;">Edit</button>
          ` : ''}
        </div>
      `;
    }).join('');

    list.querySelectorAll('.party-item').forEach((item) => {
      item.onclick = (e) => {
        if (e.target.classList.contains('edit-party-btn')) return;
        this.selectedPartyId = item.getAttribute('data-id');
        const searchInput = document.getElementById('party-search-input');
        this.renderParties(searchInput ? searchInput.value : '');
        this.renderProducts();
      };
    });

    list.querySelectorAll('.edit-party-btn').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this.openEditPartyModal(btn.getAttribute('data-id'));
      };
    });
  },

  renderProducts() {
    const container = document.getElementById('products-table-container');
    const title = document.getElementById('products-header-title');
    const badge = document.getElementById('product-count-badge');
    if (!container) return;

    const currentParty = this.parties.find((p) => p.id === this.selectedPartyId);
    if (!currentParty) {
      container.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--neutral);">No party selected</div>';
      return;
    }

    title.textContent = `Products for ${currentParty.name}`;
    const filteredProducts = this.products.filter((p) => p.partyId === this.selectedPartyId);
    badge.textContent = `${filteredProducts.length} Products`;

    if (filteredProducts.length === 0) {
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--neutral);">
          <p>No products defined for ${currentParty.name} yet.</p>
          <button class="btn btn-primary btn-sm" id="empty-add-prod-btn" style="margin-top: 12px;">+ Add Product</button>
        </div>
      `;
      const btn = document.getElementById('empty-add-prod-btn');
      if (btn) btn.onclick = () => this.openAddProductModal();
      return;
    }

    container.innerHTML = `
      <table class="data-table" style="width: 100%;">
        <thead style="position: sticky; top: 0; background: var(--surface); z-index: 2;">
          <tr>
            <th>Product Name / Specification</th>
            <th>BOM Lines</th>
            <th>Status</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filteredProducts.map((prod) => `
            <tr>
              <td style="font-weight: 600; color: var(--secondary);">${prod.name}</td>
              <td><span class="chip chip-neutral">${(prod.bomLines || []).length} materials</span></td>
              <td>
                <span class="chip ${prod.isActive ? 'chip-success' : 'chip-neutral'}">
                  ${prod.isActive ? 'Active' : 'Archived'}
                </span>
              </td>
              <td style="text-align: right; white-space: nowrap;">
                <div style="display: inline-flex; gap: 6px; justify-content: flex-end; align-items: center;">
                  <a href="#bom-editor?productId=${prod.id}" class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11.5px;">Edit BOM &rarr;</a>
                  <button class="btn btn-secondary btn-sm edit-prod-btn" data-id="${prod.id}" style="padding: 3px 8px; font-size: 11.5px;">Edit</button>
                  ${State.isAdmin() ? `
                    <button class="btn btn-secondary btn-sm delete-prod-btn" data-id="${prod.id}" style="padding: 3px 8px; font-size: 11.5px; color: var(--error);">Delete</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.edit-prod-btn').forEach((btn) => {
      btn.onclick = () => this.openEditProductModal(btn.getAttribute('data-id'));
    });

    container.querySelectorAll('.delete-prod-btn').forEach((btn) => {
      btn.onclick = () => this.confirmDeleteProduct(btn.getAttribute('data-id'));
    });
  },

  confirmDeleteProduct(productId) {
    const prod = this.products.find((p) => p.id === productId);
    if (!prod) return;

    Modal.confirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete "${prod.name}" and all its BOM recipe lines? This action cannot be undone.`,
      confirmText: 'Delete Product',
      onConfirm: async () => {
        await Api.delete(`/api/products/${productId}`);
        Toast.show('Product deleted successfully', 'success');
        await this.loadData();
      },
    });
  },

  openAddPartyModal() {
    Modal.open({
      title: 'Add New Party / Customer',
      bodyHtml: `
        <form id="add-party-form">
          <div class="form-group">
            <label class="form-label">Party Name</label>
            <input type="text" name="name" class="form-control" placeholder="e.g. Harsh or Rajesh Engineering" required>
          </div>
        </form>
      `,
      confirmText: 'Create Party',
      onConfirm: async () => {
        const form = document.getElementById('add-party-form');
        const party = await Api.post('/api/parties', { name: form.name.value.trim() });
        Toast.show('Party created successfully', 'success');
        this.selectedPartyId = party.id;
        await this.loadData();
        return true;
      },
    });
  },

  openEditPartyModal(partyId) {
    const party = this.parties.find((p) => p.id === partyId);
    if (!party) return;

    Modal.open({
      title: `Edit Party — ${party.name}`,
      bodyHtml: `
        <form id="edit-party-form">
          <div class="form-group">
            <label class="form-label">Party Name</label>
            <input type="text" name="name" class="form-control" value="${party.name}" required>
          </div>
        </form>
      `,
      confirmText: 'Save Changes',
      onConfirm: async () => {
        const form = document.getElementById('edit-party-form');
        await Api.patch(`/api/parties/${partyId}`, {
          name: form.name.value.trim(),
          version: party.version,
        });
        Toast.show('Party updated', 'success');
        await this.loadData();
        return true;
      },
    });
  },

  openAddProductModal() {
    Modal.open({
      title: 'Add New Product',
      bodyHtml: `
        <form id="add-prod-form">
          <div class="form-group">
            <label class="form-label">Party / Customer</label>
            <select name="partyId" class="form-control" required>
              ${this.parties.map((p) => `<option value="${p.id}" ${p.id === this.selectedPartyId ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Product Name & Specifications</label>
            <input type="text" name="name" class="form-control" placeholder="e.g. 0.5 HP ultra rotor SL60 TL271" required>
          </div>
        </form>
      `,
      confirmText: 'Create Product',
      onConfirm: async () => {
        const form = document.getElementById('add-prod-form');
        const created = await Api.post('/api/products', {
          partyId: form.partyId.value,
          name: form.name.value.trim(),
        });
        Toast.show('Product created successfully', 'success');
        this.selectedPartyId = created.partyId;
        await this.loadData();
        return true;
      },
    });
  },

  openEditProductModal(productId) {
    const prod = this.products.find((p) => p.id === productId);
    if (!prod) return;

    Modal.open({
      title: `Edit Product — ${prod.name}`,
      bodyHtml: `
        <form id="edit-prod-form">
          <div class="form-group">
            <label class="form-label">Product Name</label>
            <input type="text" name="name" class="form-control" value="${prod.name}" required>
          </div>
        </form>
      `,
      confirmText: 'Save Changes',
      onConfirm: async () => {
        const form = document.getElementById('edit-prod-form');
        await Api.patch(`/api/products/${productId}`, {
          name: form.name.value.trim(),
          version: prod.version,
        });
        Toast.show('Product updated', 'success');
        await this.loadData();
        return true;
      },
    });
  },
};

