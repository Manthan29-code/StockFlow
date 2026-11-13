const DispatchPage = {
  products: [],
  selectedProductId: null,
  dispatches: [],

  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px;">Dispatch</h1>
        <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Record production dispatches and manage outward dispatch history</p>
      </div>

      <!-- Record Production & Issue Materials Form Card -->
      <div class="card" style="margin-bottom: 24px; padding: 24px; background: #FFFFFF; border: 1px solid var(--border);">
        <h3 style="font-size: 16px; font-weight: 700; color: var(--secondary); margin-bottom: 6px;">
          Record Production & Issue Materials
        </h3>
        <p style="font-size: 13px; color: var(--neutral); margin-bottom: 20px;">
          Automatically deducts all BOM materials from live stock using FIFO inward allocation.
        </p>

        <form id="dispatch-form" style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;">
          <div style="flex: 2; min-width: 280px; position: relative;">
            <label class="form-label">Search Finished Product</label>
            <div style="position: relative;">
              <input type="text" id="dispatch-product-search" class="form-control" autocomplete="off" style="font-weight: 600; padding-right: 30px;" required>
              <span id="dispatch-product-clear" title="Clear / View All" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--neutral); font-size: 16px; font-weight: bold; line-height: 1; user-select: none;">&times;</span>
            </div>
            <input type="hidden" id="dispatch-product-id" required>
            <!-- Dropdown List -->
            <div id="dispatch-product-dropdown" class="card no-scrollbar" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; width: 100%; max-height: 280px; overflow-y: auto; z-index: 100; box-shadow: var(--shadow-lg); padding: 4px 0; border: 1px solid var(--border); background: #FFFFFF;"></div>
          </div>
          <div style="flex: 1; min-width: 140px;">
            <label class="form-label">Planned Quantity</label>
            <input type="number" id="dispatch-qty-input" class="form-control" value="100" min="1" step="any" required>
          </div>
          <div style="flex: 1; min-width: 150px;">
            <label class="form-label">Outward Date</label>
            <input type="date" id="dispatch-date-input" class="form-control" value="${new Date().toISOString().substring(0, 10)}" required>
          </div>
          <div style="flex: 1; min-width: 150px;">
            <label class="form-label">Outward No</label>
            <input type="text" id="dispatch-outward-no-input" class="form-control" required>
          </div>
          <div>
            <button type="submit" id="dispatch-submit-btn" class="btn btn-primary" style="height: 38px; font-weight: 600; padding: 0 20px;">
              Issue Material & Deduct Stock &rarr;
            </button>
          </div>
        </form>
      </div>

      <!-- Dispatches Table Card (Image 2 style layout) -->
      <div class="card" style="padding: 0; overflow: hidden; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--surface);">
          <h3 class="card-title" id="dispatch-table-title" style="font-size: 15px; margin: 0;">
            Dispatch Records (0 total entries)
          </h3>
        </div>
        <div style="overflow-x: auto;">
          <table class="records-outward-table" style="width: 100%;">
            <thead>
              <tr>
                <th style="text-align: center;">PARTY NAME</th>
                <th style="text-align: center;">PRODUCT NAME</th>
                <th style="text-align: center;">PLANNED QUANTITY</th>
                <th style="text-align: center;">OUTWARD DATE</th>
                <th style="text-align: center;">OUTWARD NO</th>
                <th style="text-align: center;">ACTIONS</th>
              </tr>
            </thead>
            <tbody id="dispatch-table-body">
              <tr>
                <td colspan="6" style="text-align: center; padding: 30px; color: var(--neutral);">
                  Loading dispatch records...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const form = document.getElementById('dispatch-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        this.submitDispatch();
      };
    }

    await this.initProducts();
    await this.loadDispatches();
  },

  async initProducts() {
    const searchInput = document.getElementById('dispatch-product-search');
    const hiddenId = document.getElementById('dispatch-product-id');
    const dropdown = document.getElementById('dispatch-product-dropdown');
    const clearBtn = document.getElementById('dispatch-product-clear');
    if (!searchInput || !dropdown) return;

    try {
      const products = await Api.get('/api/products');
      this.products = products;

      if (products.length === 0) {
        searchInput.value = '';
        searchInput.disabled = true;
        if (hiddenId) hiddenId.value = '';
        return;
      }

      let chosen = products.find((p) => p.id === this.selectedProductId) || products[0];
      this.selectProduct(chosen);

      const renderDropdown = (query = '') => {
        const q = query.toLowerCase().trim();
        const matches = products.filter((p) => {
          if (!q) return true;
          const pName = (p.name || '').toLowerCase();
          const partyName = (p.party ? p.party.name : '').toLowerCase();
          return pName.includes(q) || partyName.includes(q) || `${partyName} ${pName}`.includes(q);
        });

        if (matches.length === 0) {
          dropdown.innerHTML = '<div style="padding: 12px 16px; color: var(--neutral); font-size: 13px;">No matching products found</div>';
          dropdown.style.display = 'block';
          return;
        }

        dropdown.innerHTML = matches.map((p) => {
          const isSelected = p.id === this.selectedProductId;
          const partyName = p.party ? p.party.name : 'Unknown';
          const bomCount = (p.bomLines || []).length;
          return `
            <div class="dispatch-product-item" data-id="${p.id}" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: ${isSelected ? '#F0F4FF' : '#FFFFFF'}; transition: background 0.15s;">
              <div>
                <div style="font-weight: ${isSelected ? '700' : '600'}; font-size: 13.5px; color: var(--secondary);">${p.name}</div>
                <div style="font-size: 11.5px; color: var(--neutral); margin-top: 2px;">
                  Customer: <strong>${partyName}</strong> &bull; ${bomCount} material${bomCount !== 1 ? 's' : ''}
                </div>
              </div>
              ${isSelected ? '<span class="chip chip-success" style="font-size: 10.5px; padding: 2px 7px;">Selected</span>' : ''}
            </div>
          `;
        }).join('');

        dropdown.querySelectorAll('.dispatch-product-item').forEach((item) => {
          item.onmousedown = (e) => {
            e.preventDefault();
            const id = item.getAttribute('data-id');
            const target = products.find((p) => p.id === id);
            if (target) {
              this.selectProduct(target);
              dropdown.style.display = 'none';
            }
          };
        });

        dropdown.style.display = 'block';
      };

      searchInput.onfocus = () => renderDropdown(searchInput.value);
      searchInput.oninput = () => renderDropdown(searchInput.value);
      searchInput.onblur = () => {
        setTimeout(() => {
          dropdown.style.display = 'none';
        }, 200);
      };

      if (clearBtn) {
        clearBtn.onclick = () => {
          searchInput.value = '';
          searchInput.focus();
          renderDropdown('');
        };
      }
    } catch (err) {
      console.error('Failed to load products for dispatch:', err);
    }
  },

  selectProduct(product) {
    if (!product) return;
    this.selectedProductId = product.id;
    const searchInput = document.getElementById('dispatch-product-search');
    const hiddenId = document.getElementById('dispatch-product-id');
    const partyName = product.party ? product.party.name : '';
    const label = partyName ? `${partyName} \u2014 ${product.name}` : product.name;
    if (searchInput) searchInput.value = label;
    if (hiddenId) hiddenId.value = product.id;
  },

  async submitDispatch() {
    const hiddenId = document.getElementById('dispatch-product-id');
    const qtyInput = document.getElementById('dispatch-qty-input');
    const dateInput = document.getElementById('dispatch-date-input');
    const outwardNoInput = document.getElementById('dispatch-outward-no-input');
    const submitBtn = document.getElementById('dispatch-submit-btn');

    if (!hiddenId || !hiddenId.value) {
      Toast.show('Please select a finished product', 'warning');
      return;
    }

    const productId = hiddenId.value;
    const quantity = Number(qtyInput ? qtyInput.value : 0);
    const outDate = dateInput ? dateInput.value : '';
    const outwardNo = outwardNoInput ? outwardNoInput.value.trim() : '';

    if (!quantity || quantity <= 0) {
      Toast.show('Please enter a valid planned quantity', 'warning');
      return;
    }
    if (!outDate) {
      Toast.show('Please select an outward date', 'warning');
      return;
    }
    if (!outwardNo) {
      Toast.show('Please enter an Outward No', 'warning');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Deducting Stock...';

    try {
      const res = await Api.post(`/api/products/${productId}/produce`, {
        quantity,
        outwardNo,
        outDate,
      });

      Toast.show(`Successfully recorded dispatch for ${Format.number(quantity)} units of ${res.productName || 'product'}! All materials deducted.`, 'success', 5000);
      if (outwardNoInput) outwardNoInput.value = '';
      await this.loadDispatches();
    } catch (err) {
      Toast.show(err.message || 'Failed to record dispatch', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Issue Material & Deduct Stock \u2192';
    }
  },

  async loadDispatches() {
    const titleEl = document.getElementById('dispatch-table-title');
    const tbody = document.getElementById('dispatch-table-body');
    if (!tbody) return;

    try {
      const dispatches = await Api.get('/api/products/dispatches');
      this.dispatches = dispatches || [];

      if (titleEl) {
        titleEl.textContent = `Dispatch Records (${this.dispatches.length} total entries)`;
      }

      if (this.dispatches.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 36px; color: var(--neutral); font-size: 13.5px;">
              No dispatch records recorded yet. Record your first production dispatch above.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = this.dispatches.map((d) => `
        <tr id="dispatch-row-${d.id}">
          <td style="text-align: center; font-weight: 600; color: var(--secondary);">${d.partyName || '-'}</td>
          <td style="text-align: center; font-weight: 600; color: var(--secondary);">${d.productName || '-'}</td>
          <td style="text-align: center;" class="mono font-bold">${Format.number(d.plannedQuantity)}</td>
          <td style="text-align: center;">${Format.date(d.outwardDate)}</td>
          <td style="text-align: center;" class="mono font-bold">${d.outwardNo}</td>
          <td style="text-align: center; white-space: nowrap;">
            <button class="btn btn-secondary btn-sm edit-dispatch-btn" data-id="${d.id}" style="padding: 3px 12px; font-size: 12px;">Edit</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.edit-dispatch-btn').forEach((btn) => {
        btn.onclick = () => this.openEditDispatchModal(btn.getAttribute('data-id'));
      });
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px; color: var(--error);">
            Failed to load dispatch records: ${err.message}
          </td>
        </tr>
      `;
    }
  },

  openEditDispatchModal(dispatchId) {
    const dispatch = this.dispatches.find((d) => d.id === dispatchId);
    if (!dispatch) return;

    Modal.open({
      title: 'Edit Production Dispatch',
      bodyHtml: `
        <form id="edit-dispatch-modal-form">
          <div style="padding: 12px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 18px;">
            <div style="font-size: 11.5px; color: var(--neutral); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Customer & Product</div>
            <div style="font-size: 14.5px; font-weight: 700; color: var(--secondary); margin-top: 3px;">
              ${dispatch.partyName} &mdash; ${dispatch.productName}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Planned Quantity</label>
            <input type="number" id="edit-disp-qty" class="form-control" value="${dispatch.plannedQuantity}" min="1" step="any" required>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Outward Date</label>
              <input type="date" id="edit-disp-date" class="form-control" value="${dispatch.outwardDate}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Outward No</label>
              <input type="text" id="edit-disp-outward-no" class="form-control" value="${dispatch.outwardNo}" required>
            </div>
          </div>
        </form>
      `,
      confirmText: 'Save Changes',
      onConfirm: async () => {
        const form = document.getElementById('edit-dispatch-modal-form');
        if (!form.reportValidity()) return false;

        const quantity = Number(document.getElementById('edit-disp-qty').value);
        const outDate = document.getElementById('edit-disp-date').value;
        const outwardNo = document.getElementById('edit-disp-outward-no').value.trim();

        if (!quantity || quantity <= 0) {
          Toast.show('Planned quantity must be greater than zero', 'warning');
          return false;
        }
        if (!outDate) {
          Toast.show('Outward date is required', 'warning');
          return false;
        }
        if (!outwardNo) {
          Toast.show('Outward No is required', 'warning');
          return false;
        }

        try {
          await Api.patch(`/api/products/dispatches/${dispatchId}`, {
            quantity,
            outDate,
            outwardNo,
          });

          Toast.show('Production dispatch updated successfully. Stock ledger synchronized.', 'success');
          await this.loadDispatches();
          return true;
        } catch (err) {
          Toast.show(err.message || 'Failed to update dispatch', 'error');
          return false;
        }
      },
    });
  },
};

