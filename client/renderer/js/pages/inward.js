const InwardPage = {
  currentMaterialId: null,
  ledgerData: null,

  async render(container, queryParams = {}) {
    this.currentMaterialId = queryParams.materialId || this.currentMaterialId;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="position: relative;">
            <label class="form-label" style="margin-bottom: 4px;">Search Material</label>
            <div style="position: relative; width: 320px;">
              <input type="text" id="inward-material-search" class="form-control" autocomplete="off" style="width: 100%; font-weight: 600; padding-right: 30px;">
              <span id="inward-material-clear" title="Clear / View All" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--neutral); font-size: 16px; font-weight: bold; line-height: 1; user-select: none;">&times;</span>
            </div>
            <!-- Live Search Dropdown Filter -->
            <div id="inward-material-dropdown" class="card no-scrollbar" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; width: 350px; max-height: 280px; overflow-y: auto; z-index: 100; box-shadow: var(--shadow-lg); padding: 4px 0; border: 1px solid var(--border); background: #FFFFFF;"></div>
          </div>
          <div id="inward-stock-banner" style="background: #FFFFFF; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 16px; margin-top: 18px;">
            <span style="font-size: 11px; text-transform: uppercase; color: var(--neutral); font-weight: 600;">Total Stock Balance</span>
            <div id="inward-total-stock" style="font-size: 18px; font-weight: 700; color: var(--secondary); font-family: var(--font-mono);">-</div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; align-items: flex-end;">
          <button class="btn btn-primary btn-sm" id="inward-add-btn">+ Add Incoming Entry</button>
        </div>
      </div>

      <div id="inward-entries-container">
        <div style="text-align: center; padding: 40px; color: var(--neutral);">Loading inward records...</div>
      </div>
    `;

    // Bind Add button synchronously
    const addBtn = document.getElementById('inward-add-btn');
    if (addBtn) {
      addBtn.onclick = () => this.openAddIncomingModal();
    }

    await this.initMaterialSelect();
  },

  async initMaterialSelect() {
    const searchInput = document.getElementById('inward-material-search');
    const dropdown = document.getElementById('inward-material-dropdown');
    const clearBtn = document.getElementById('inward-material-clear');
    if (!searchInput || !dropdown) return;

    try {
      const materials = await Api.get('/api/materials');
      State.materialsCache = materials;

      if (materials.length === 0) {
        searchInput.value = '';
        searchInput.disabled = true;
        document.getElementById('inward-entries-container').innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--neutral);">No materials exist. Please add a material first.</div>
        `;
        return;
      }

      if (this.currentMaterialId && materials.some((m) => m.id === this.currentMaterialId)) {
        const found = materials.find((m) => m.id === this.currentMaterialId);
        searchInput.value = found ? found.name : '';
      } else {
        this.currentMaterialId = materials[0].id;
        searchInput.value = materials[0].name;
      }

      const renderDropdownItems = (filterText = '') => {
        const query = filterText.toLowerCase().trim();
        const matches = materials.filter((m) => m.name.toLowerCase().includes(query));

        if (matches.length === 0) {
          dropdown.innerHTML = '<div style="padding: 12px 16px; color: var(--neutral); font-size: 13px; text-align: center;">No matching materials</div>';
          dropdown.style.display = 'block';
          return;
        }

        dropdown.innerHTML = matches.map((m) => {
          const isSelected = m.id === this.currentMaterialId;
          const unitCode = m.unit ? m.unit.code : '';
          const modeLabel = m.deductBy === 'qty_x_piece_weight' ? 'Weight' : 'Direct';
          return `
            <div class="material-search-item" data-id="${m.id}" style="padding: 9px 14px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: ${isSelected ? '#F0F4FF' : '#FFFFFF'}; transition: background 0.15s;">
              <div>
                <div style="font-weight: ${isSelected ? '600' : '500'}; font-size: 13px; color: var(--secondary);">${m.name}</div>
                <div style="font-size: 11px; color: var(--neutral); margin-top: 1px;">Unit: ${unitCode} &bull; ${modeLabel}</div>
              </div>
              ${isSelected ? '<span class="chip chip-success" style="font-size: 10px; padding: 2px 6px;">Selected</span>' : ''}
            </div>
          `;
        }).join('');

        dropdown.querySelectorAll('.material-search-item').forEach((item) => {
          item.onclick = (e) => {
            e.stopPropagation();
            const id = item.getAttribute('data-id');
            const chosen = materials.find((m) => m.id === id);
            this.currentMaterialId = id;
            searchInput.value = chosen ? chosen.name : '';
            dropdown.style.display = 'none';
            this.loadLedger();
          };
        });

        dropdown.style.display = 'block';
      };

      searchInput.onfocus = () => renderDropdownItems(searchInput.value);
      searchInput.oninput = () => renderDropdownItems(searchInput.value);

      if (clearBtn) {
        clearBtn.onclick = (e) => {
          e.stopPropagation();
          searchInput.value = '';
          searchInput.focus();
          renderDropdownItems('');
        };
      }

      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });

      await this.loadLedger();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  async loadLedger() {
    if (!this.currentMaterialId) return;

    try {
      const data = await Api.get(`/api/materials/${this.currentMaterialId}/ledger`);
      this.ledgerData = data;

      const totalStockEl = document.getElementById('inward-total-stock');
      if (totalStockEl) {
        const unit = data.material.unit ? data.material.unit.code : '';
        totalStockEl.textContent = `${Format.number(data.totalStock)} ${unit}`;
      }

      this.renderEntries();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  renderEntries() {
    const container = document.getElementById('inward-entries-container');
    if (!container || !this.ledgerData) return;

    const { material, entries } = this.ledgerData;
    const unitCode = material.unit ? material.unit.code : '';

    const totalInQty = entries.reduce((acc, e) => acc + (Number(e.quantity) || 0), 0);
    const totalBalance = entries.reduce((acc, e) => acc + (Number(e.balance) || 0), 0);

    container.innerHTML = `
      <div class="card" style="padding: 0; overflow: hidden; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
        <div style="padding: 12px 18px; background: var(--surface); border-bottom: 1px solid var(--border); font-weight: 600; font-size: 13.5px; color: var(--secondary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <span>Inward Directory (${entries.length} total entries)</span>
            <span class="chip chip-neutral" style="font-weight: 700; font-size: 13px; font-family: var(--font-mono); background: #FFFFFF; border: 1px solid var(--border); padding: 4px 10px;">
              Total In: ${Format.number(totalInQty)} ${unitCode}
            </span>
            <span class="chip chip-neutral" style="font-weight: 600; font-size: 12.5px; font-family: var(--font-mono); background: #FFFFFF; border: 1px solid var(--border); padding: 4px 10px; color: var(--primary);">
              Total Balance: ${Format.number(totalBalance)} ${unitCode}
            </span>
          </div>
          <span style="font-size: 12px; font-weight: 400; color: var(--neutral);">Click Edit or Delete on any shipment</span>
        </div>
        <div style="overflow-x: auto;">
          <table class="data-table" style="width: 100%;">
            <thead>
              <tr>
                <th style="width: 120px; text-align: center;">IN DATE</th>
                <th style="width: 140px; text-align: center;">INWARD NO</th>
                <th style="width: 130px; text-align: center;">IN QUANTITY (${unitCode})</th>
                <th style="text-align: center;">SUPPLIER</th>
                <th style="width: 140px; text-align: center;">BALANCE (${unitCode})</th>
                <th style="width: 130px; text-align: center;">STATUS</th>
                <th style="width: 70px; text-align: center;">BY</th>
                <th style="width: 140px; text-align: center;">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              ${entries.length === 0 ? `
                <tr><td colspan="8" style="text-align: center; color: var(--neutral); padding: 30px;">No incoming entries found.</td></tr>
              ` : entries.map((entry) => {
                const statusClass = entry.status === 'closed' ? 'chip-success' : entry.status === 'partial' ? 'chip-warning' : 'chip-neutral';
                const statusLabel = entry.status === 'closed' ? 'Closed' : entry.status === 'partial' ? 'Partially Issued' : 'Not Issued';
                return `
                  <tr>
                    <td style="text-align: center;">${Format.date(entry.inDate)}</td>
                    <td class="mono font-bold" style="text-align: center;">${entry.challanNo}</td>
                    <td class="mono font-bold" style="text-align: center;">${Format.number(entry.quantity)}</td>
                    <td style="text-align: center;">${entry.supplier || '-'}</td>
                    <td class="mono font-bold" style="text-align: center; color: ${Number(entry.balance) > 0 ? 'var(--primary)' : 'var(--neutral)'};">
                      ${Format.number(entry.balance)}
                    </td>
                    <td style="text-align: center;"><span class="chip ${statusClass}">${statusLabel}</span></td>
                    <td style="text-align: center;">${Badge.render(entry.created_by, entry.createdAt)}</td>
                    <td style="text-align: center; white-space: nowrap;">
                      <div style="display: inline-flex; gap: 6px; justify-content: center;">
                        ${State.isAdmin() ? `
                          <button class="btn btn-secondary btn-sm edit-in-btn" data-entry-id="${entry.id}" style="padding: 2px 8px; font-size: 11.5px;">Edit</button>
                          <button class="btn btn-secondary btn-sm delete-in-btn" data-entry-id="${entry.id}" style="padding: 2px 8px; font-size: 11.5px; color: var(--error);">Delete</button>
                        ` : '-'}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            ${entries.length > 0 ? `
              <tfoot style="background: #F8FAFC; border-top: 2px solid var(--border); font-weight: 700;">
                <tr>
                  <td colspan="2" style="text-align: right; color: var(--secondary);">Total:</td>
                  <td class="mono font-bold" style="text-align: center; color: var(--secondary); font-size: 13.5px;">${Format.number(totalInQty)}</td>
                  <td></td>
                  <td class="mono font-bold" style="text-align: center; color: var(--primary); font-size: 13.5px;">${Format.number(totalBalance)}</td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
      </div>
    `;

    this.bindRowEvents();
  },

  bindRowEvents() {
    document.querySelectorAll('.edit-in-btn').forEach((btn) => {
      btn.onclick = () => this.openEditIncomingModal(btn.getAttribute('data-entry-id'));
    });

    document.querySelectorAll('.delete-in-btn').forEach((btn) => {
      btn.onclick = () => this.confirmDeleteIncoming(btn.getAttribute('data-entry-id'));
    });
  },

  openAddIncomingModal() {
    const material = (this.ledgerData && this.ledgerData.material) ||
      (State.materialsCache && State.materialsCache.find((m) => m.id === this.currentMaterialId));

    if (!material) {
      Toast.show('Please select a material first', 'warning');
      return;
    }

    const unitCode = material.unit ? material.unit.code : '';

    Modal.open({
      title: `Add Incoming Shipment for ${material.name}`,
      bodyHtml: `
        <form id="add-incoming-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Incoming Date</label>
              <input type="date" name="inDate" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Inward No</label>
              <input type="text" name="challanNo" class="form-control" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Quantity (${unitCode})</label>
              <input type="number" step="any" name="quantity" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">Supplier (Optional)</label>
              <input type="text" name="supplier" class="form-control">
            </div>
          </div>
        </form>
      `,
      confirmText: 'Record Shipment',
      onConfirm: async () => {
        const form = document.getElementById('add-incoming-form');
        if (!form.reportValidity()) {
          return false;
        }

        const inDate = form.inDate.value;
        const challanNo = form.challanNo.value.trim();
        const quantity = form.quantity.value;
        const supplier = form.supplier.value.trim();

        if (!challanNo) {
          Toast.show('Inward No is required', 'warning');
          return false;
        }

        if (Number(quantity) <= 0) {
          Toast.show('Quantity must be greater than zero', 'warning');
          return false;
        }

        try {
          await Api.post('/api/incoming', {
            materialId: material.id,
            inDate,
            challanNo,
            quantity,
            supplier: supplier || null,
          });

          Toast.show('Incoming entry recorded successfully', 'success');
          await this.loadLedger();
          return true;
        } catch (err) {
          Toast.show(err.message || 'Failed to record entry', 'error');
          return false;
        }
      },
    });
  },

  openEditIncomingModal(entryId) {
    const entry = this.ledgerData.entries.find((e) => e.id === entryId);
    if (!entry) return;

    Modal.open({
      title: `Edit Inward Entry (${entry.challanNo})`,
      bodyHtml: `
        <form id="edit-incoming-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Incoming Date</label>
              <input type="date" name="inDate" class="form-control" value="${entry.inDate}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Inward No</label>
              <input type="text" name="challanNo" class="form-control" value="${entry.challanNo}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Quantity</label>
              <input type="number" step="any" name="quantity" class="form-control" value="${entry.quantity}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Supplier (Optional)</label>
              <input type="text" name="supplier" class="form-control" value="${entry.supplier || ''}">
            </div>
          </div>
          <div style="font-size: 11.5px; color: var(--neutral); margin-top: 4px;">Already deducted: ${entry.totalDeducted || 0}</div>
        </form>
      `,
      confirmText: 'Save Changes',
      onConfirm: async () => {
        const form = document.getElementById('edit-incoming-form');
        await Api.patch(`/api/incoming/${entryId}`, {
          inDate: form.inDate.value,
          challanNo: form.challanNo.value.trim(),
          quantity: form.quantity.value,
          supplier: form.supplier.value.trim() || null,
          version: entry.version,
        });
        Toast.show('Incoming entry updated', 'success');
        await this.loadLedger();
        return true;
      },
    });
  },

  confirmDeleteIncoming(entryId) {
    Modal.confirm({
      title: 'Delete Incoming Entry',
      message: 'Are you sure you want to delete this incoming entry? (Only allowed if no outgoing transactions exist)',
      confirmText: 'Delete Entry',
      onConfirm: async () => {
        await Api.delete(`/api/incoming/${entryId}`);
        Toast.show('Incoming entry deleted', 'success');
        await this.loadLedger();
      },
    });
  },
};

