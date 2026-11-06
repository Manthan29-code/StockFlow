const PartiesProductsPage = {
  parties: [],
  products: [],
  selectedPartyId: null,

  async render(container) {
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h1 style="font-size: 22px;">Parties & Products</h1>
          <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Manage customer parties and finished manufactured products</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary btn-sm" id="add-party-btn">+ Add Party</button>
          <button class="btn btn-primary btn-sm" id="add-product-btn">+ Add Product</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 280px 1fr; gap: 24px;">
        <!-- Parties List Panel -->
        <div class="card" style="padding: 0; overflow: hidden; height: fit-content;">
          <div style="padding: 14px 18px; border-bottom: 1px solid var(--border); background: var(--surface);">
            <h3 class="card-title" style="font-size: 14px;">Parties / Customers</h3>
          </div>
          <div id="parties-list" style="max-height: 600px; overflow-y: auto;">
            <div style="padding: 20px; text-align: center; color: var(--neutral);">Loading...</div>
          </div>
        </div>

        <!-- Products for selected party -->
        <div class="card" style="padding: 0; overflow: hidden;">
          <div style="padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <h3 class="card-title" id="products-header-title">Products</h3>
            <span id="product-count-badge" class="chip chip-neutral">0 Products</span>
          </div>
          <div id="products-table-container">
            <div style="padding: 30px; text-align: center; color: var(--neutral);">Select a party to view products</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('add-party-btn').onclick = () => this.openAddPartyModal();
    document.getElementById('add-product-btn').onclick = () => this.openAddProductModal();

    await this.loadData();
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

      this.renderParties();
      this.renderProducts();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  renderParties() {
    const list = document.getElementById('parties-list');
    if (!list) return;

    if (this.parties.length === 0) {
      list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--neutral);">No parties yet.</div>';
      return;
    }

    list.innerHTML = this.parties.map((party) => {
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
        this.renderParties();
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
      <table class="data-table">
        <thead>
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
              <td style="text-align: right;">
                <a href="#bom-editor?productId=${prod.id}" class="btn btn-secondary btn-sm">Edit BOM &rarr;</a>
                <button class="btn btn-secondary btn-sm edit-prod-btn" data-id="${prod.id}">Edit</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.edit-prod-btn').forEach((btn) => {
      btn.onclick = () => this.openEditProductModal(btn.getAttribute('data-id'));
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

