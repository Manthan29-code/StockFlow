const LedgerPage = {
  currentMaterialId: null,
  currentFilter: 'all', // 'all' | 'partial' | 'not_issued' | 'closed'
  ledgerData: null,

  async render(container, queryParams = {}) {
    this.currentMaterialId = queryParams.materialId || this.currentMaterialId;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div>
            <label class="form-label" style="margin-bottom: 4px;">Selected Material</label>
            <select id="ledger-material-select" class="form-control" style="width: 280px; font-weight: 600;"></select>
          </div>
          <div id="material-stock-banner" style="background: #FFFFFF; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 16px; margin-top: 18px;">
            <span style="font-size: 11px; text-transform: uppercase; color: var(--neutral); font-weight: 600;">Total Stock Balance</span>
            <div id="ledger-total-stock" style="font-size: 18px; font-weight: 700; color: var(--secondary); font-family: var(--font-mono);">-</div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; align-items: flex-end;">
          <button class="btn btn-secondary btn-sm" id="ledger-export-btn">Export Material Excel</button>
          <button class="btn btn-primary btn-sm" id="ledger-add-incoming-btn">+ Add Incoming Entry</button>
        </div>
      </div>

      <!-- Filters -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm ${this.currentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-filter="all">All Entries</button>
          <button class="btn btn-sm ${this.currentFilter === 'partial' ? 'btn-primary' : 'btn-secondary'}" data-filter="partial">Open / Partial</button>
          <button class="btn btn-sm ${this.currentFilter === 'not_issued' ? 'btn-primary' : 'btn-secondary'}" data-filter="not_issued">Not Issued</button>
          <button class="btn btn-sm ${this.currentFilter === 'closed' ? 'btn-primary' : 'btn-secondary'}" data-filter="closed">Closed</button>
        </div>
        <div style="font-size: 12.5px; color: var(--neutral);" id="ledger-entry-counts"></div>
      </div>

      <div id="ledger-entries-container">
        <div style="text-align: center; padding: 40px; color: var(--neutral);">Loading ledger records...</div>
      </div>
    `;

    await this.initMaterialSelect();

    // Filter clicks
    container.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.onclick = () => {
        this.currentFilter = btn.getAttribute('data-filter');
        container.querySelectorAll('[data-filter]').forEach((b) => {
          b.className = `btn btn-sm ${b.getAttribute('data-filter') === this.currentFilter ? 'btn-primary' : 'btn-secondary'}`;
        });
        this.renderEntries();
      };
    });

    document.getElementById('ledger-export-btn').onclick = () => this.exportCurrentMaterial();
    document.getElementById('ledger-add-incoming-btn').onclick = () => this.openAddIncomingModal();
  },

  async initMaterialSelect() {
    const select = document.getElementById('ledger-material-select');
    if (!select) return;

    try {
      const materials = await Api.get('/api/materials');
      State.materialsCache = materials;

      if (materials.length === 0) {
        select.innerHTML = '<option value="">No materials available</option>';
        document.getElementById('ledger-entries-container').innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--neutral);">No materials exist. Please add a material first.</div>
        `;
        return;
      }

      select.innerHTML = materials.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');

      if (this.currentMaterialId && materials.some((m) => m.id === this.currentMaterialId)) {
        select.value = this.currentMaterialId;
      } else {
        this.currentMaterialId = materials[0].id;
        select.value = this.currentMaterialId;
      }

      select.onchange = () => {
        this.currentMaterialId = select.value;
        this.loadLedger();
      };

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

      const unitCode = data.material.unit ? data.material.unit.code : '';
      document.getElementById('ledger-total-stock').textContent = `${Format.number(data.totalStock)} ${unitCode}`;

      this.renderEntries();
    } catch (err) {
      document.getElementById('ledger-entries-container').innerHTML = `
        <div style="color: var(--error); padding: 20px;">Failed to load ledger: ${err.message}</div>
      `;
    }
  },

  renderEntries() {
    const container = document.getElementById('ledger-entries-container');
    if (!container || !this.ledgerData) return;

    const { material, entries } = this.ledgerData;
    const isWeightBased = material.deductBy === 'qty_x_piece_weight';
    const hasSpec = Boolean(material.specLabel);
    const specLabel = material.specLabel || 'TL';
    const unitCode = material.unit ? material.unit.code : '';

    const filtered = entries.filter((e) => {
      if (this.currentFilter === 'all') return true;
      if (this.currentFilter === 'partial') return e.status === 'partial';
      if (this.currentFilter === 'not_issued') return e.status === 'not_issued';
      if (this.currentFilter === 'closed') return e.status === 'closed';
      return true;
    });

    document.getElementById('ledger-entry-counts').textContent = `Showing ${filtered.length} of ${entries.length} entries`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
          <h4 style="color: var(--neutral); margin-bottom: 8px;">No Entries Found</h4>
          <p style="color: var(--neutral-light); font-size: 13.5px;">No incoming entries match the current filter.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((entry) => {
      const statusClass = entry.status === 'closed' ? 'chip-success' : entry.status === 'partial' ? 'chip-warning' : 'chip-neutral';
      const statusLabel = entry.status === 'closed' ? 'Closed (0 balance)' : entry.status === 'partial' ? 'Partially Issued' : 'Not Issued';

      const outgoingRows = entry.outgoingRows || [];

      return `
        <div class="card" style="margin-bottom: 24px; padding: 0; overflow: hidden; border: 1px solid var(--border);">
          <!-- Incoming Entry Header Block -->
          <div style="background-color: var(--surface); padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
              <div>
                <span style="font-size: 11px; text-transform: uppercase; color: var(--neutral); font-weight: 600;">IN DATE</span>
                <div style="font-weight: 600; color: var(--secondary); font-size: 14px;">${Format.date(entry.inDate)}</div>
              </div>
              <div style="width: 1px; height: 28px; background: var(--border);"></div>
              <div>
                <span style="font-size: 11px; text-transform: uppercase; color: var(--neutral); font-weight: 600;">CHALLAN NO IN</span>
                <div style="font-weight: 600; color: var(--secondary); font-family: var(--font-mono); font-size: 14px;">${entry.challanNo}</div>
              </div>
              <div style="width: 1px; height: 28px; background: var(--border);"></div>
              <div>
                <span style="font-size: 11px; text-transform: uppercase; color: var(--neutral); font-weight: 600;">IN QUANTITY</span>
                <div style="font-weight: 700; color: var(--secondary); font-family: var(--font-mono); font-size: 15px;">${Format.number(entry.quantity)} ${unitCode}</div>
              </div>
              <div style="width: 1px; height: 28px; background: var(--border);"></div>
              <div>
                <span style="font-size: 11px; text-transform: uppercase; color: var(--neutral); font-weight: 600;">REMAINING BALANCE</span>
                <div style="font-weight: 700; color: ${Number(entry.balance) > 0 ? 'var(--primary)' : 'var(--neutral)'}; font-family: var(--font-mono); font-size: 15px;">
                  ${Format.number(entry.balance)} ${unitCode}
                </div>
              </div>
              <span class="chip ${statusClass}">${statusLabel}</span>
              ${Badge.render(entry.created_by, entry.createdAt)}
            </div>

            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="btn btn-primary btn-sm add-out-btn" data-entry-id="${entry.id}" data-entry-balance="${entry.balance}">
                + Issue Material (OUT)
              </button>
              ${State.isAdmin() ? `
                <button class="btn btn-secondary btn-sm edit-in-btn" data-entry-id="${entry.id}">Edit</button>
                <button class="btn btn-secondary btn-sm delete-in-btn" data-entry-id="${entry.id}" style="color: var(--error);">Delete</button>
              ` : ''}
            </div>
          </div>

          <!-- Outgoing Rows Table -->
          <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%;">
              <thead>
                <tr>
                  <th style="width: 110px;">OUT DATE</th>
                  <th style="width: 120px;">CH NO OUT</th>
                  ${hasSpec ? `<th style="width: 100px;">${specLabel}</th>` : ''}
                  <th class="num-cell" style="width: 100px;">${isWeightBased ? 'QTY (PCS)' : 'OUT QTY'}</th>
                  ${isWeightBased ? `
                    <th class="num-cell" style="width: 110px;">PIECE WT (${unitCode})</th>
                    <th class="num-cell" style="width: 120px;">TOTAL WT (${unitCode})</th>
                  ` : `
                    <th class="num-cell" style="width: 100px;">PIECE WT</th>
                    <th class="num-cell" style="width: 110px;">TOTAL WT</th>
                  `}
                  <th class="num-cell" style="width: 130px; background-color: #EDF2F7; font-weight: 700; color: var(--secondary);">RUNNING BAL</th>
                  <th style="width: 60px; text-align: center;">BY</th>
                  ${State.isAdmin() ? '<th style="width: 100px; text-align: right;">ACTIONS</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${outgoingRows.length === 0 ? `
                  <tr>
                    <td colspan="${hasSpec ? (State.isAdmin() ? 9 : 8) : (State.isAdmin() ? 8 : 7)}" style="text-align: center; color: var(--neutral); padding: 18px;">
                      No outgoing material issued from this challan yet.
                    </td>
                  </tr>
                ` : outgoingRows.map((row) => `
                  <tr id="row-${row.id}">
                    <td>${Format.date(row.outDate)}</td>
                    <td class="mono">${row.challanNo}</td>
                    ${hasSpec ? `<td>${row.specValue || '-'}</td>` : ''}
                    <td class="num-cell">${Format.number(row.qty)}</td>
                    <td class="num-cell">${row.pieceWeight ? Format.number(row.pieceWeight) : '-'}</td>
                    <td class="num-cell">${row.totalWeight ? Format.number(row.totalWeight) : '-'}</td>
                    <td class="num-cell" style="background-color: #F8FAFC; font-weight: 700; color: var(--secondary);">
                      ${Format.number(row.runningBalance)}
                    </td>
                    <td style="text-align: center;">${Badge.render(row.created_by, row.createdAt)}</td>
                    ${State.isAdmin() ? `
                      <td style="text-align: right;">
                        <button class="btn btn-secondary btn-sm edit-out-btn" data-row-id="${row.id}" style="padding: 2px 6px; font-size: 11px;">Edit</button>
                        <button class="btn btn-secondary btn-sm delete-out-btn" data-row-id="${row.id}" style="padding: 2px 6px; font-size: 11px; color: var(--error);">Del</button>
                      </td>
                    ` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    // Bind action events
    this.bindRowEvents();
  },

  bindRowEvents() {
    // Add Outgoing Row
    document.querySelectorAll('.add-out-btn').forEach((btn) => {
      btn.onclick = () => {
        const entryId = btn.getAttribute('data-entry-id');
        const balance = btn.getAttribute('data-entry-balance');
        this.openAddOutgoingModal(entryId, balance);
      };
    });

    // Admin incoming actions
    document.querySelectorAll('.edit-in-btn').forEach((btn) => {
      btn.onclick = () => this.openEditIncomingModal(btn.getAttribute('data-entry-id'));
    });

    document.querySelectorAll('.delete-in-btn').forEach((btn) => {
      btn.onclick = () => this.confirmDeleteIncoming(btn.getAttribute('data-entry-id'));
    });

    // Admin outgoing actions
    document.querySelectorAll('.edit-out-btn').forEach((btn) => {
      btn.onclick = () => this.openEditOutgoingModal(btn.getAttribute('data-row-id'));
    });

    document.querySelectorAll('.delete-out-btn').forEach((btn) => {
      btn.onclick = () => this.confirmDeleteOutgoing(btn.getAttribute('data-row-id'));
    });
  },

  openAddIncomingModal() {
    const material = (this.ledgerData && this.ledgerData.material) ||
      (State.materialsCache && State.materialsCache.find((m) => m.id === this.currentMaterialId));

    if (!material) {
      Toast.show('Please select a material first', 'warning');
      return;
    }

    const today = new Date().toISOString().substring(0, 10);
    const unitCode = material.unit ? material.unit.code : '';

    Modal.open({
      title: `Add Incoming Entry — ${material.name}`,
      bodyHtml: `
        <form id="add-incoming-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Incoming Date</label>
              <input type="date" name="inDate" class="form-control" value="${today}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Incoming Challan No</label>
              <input type="text" name="challanNo" class="form-control" placeholder="e.g. 24/1596" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Quantity received (${unitCode})</label>
              <input type="number" step="any" name="quantity" class="form-control" placeholder="e.g. 650" required>
            </div>
            <div class="form-group">
              <label class="form-label">Supplier (Optional)</label>
              <input type="text" name="supplier" class="form-control" placeholder="Supplier name">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Notes (Optional)</label>
            <input type="text" name="notes" class="form-control" placeholder="Optional notes">
          </div>
        </form>
      `,
      confirmText: 'Add Entry',
      onConfirm: async () => {
        const form = document.getElementById('add-incoming-form');
        const inDate = form.inDate.value;
        const challanNo = form.challanNo.value.trim();
        const quantity = form.quantity.value;
        const supplier = form.supplier.value.trim();
        const notes = form.notes.value.trim();

        const res = await Api.post('/api/incoming', {
          materialId: this.currentMaterialId,
          inDate,
          challanNo,
          quantity,
          supplier: supplier || null,
          notes: notes || null,
        });

        if (res.warning) {
          Toast.show(res.warning, 'warning', 6000);
        } else {
          Toast.show('Incoming entry created successfully', 'success');
        }

        await this.loadLedger();
        return true;
      },
    });
  },

  openAddOutgoingModal(entryId, availableBalance) {
    const { material } = this.ledgerData;
    const isWeightBased = material.deductBy === 'qty_x_piece_weight';
    const hasSpec = Boolean(material.specLabel);
    const specLabel = material.specLabel || 'Specification';
    const unitCode = material.unit ? material.unit.code : '';
    const today = new Date().toISOString().substring(0, 10);

    Modal.open({
      title: `Issue Material (OUT) — ${material.name}`,
      bodyHtml: `
        <form id="add-outgoing-form">
          <div style="background: var(--surface); padding: 10px 14px; border-radius: var(--radius-md); margin-bottom: 16px; border: 1px solid var(--border);">
            <span style="font-size: 11px; text-transform: uppercase; color: var(--neutral); font-weight: 600;">Available Entry Balance:</span>
            <span style="font-weight: 700; color: var(--primary); font-family: var(--font-mono); margin-left: 6px;">
              ${Format.number(availableBalance)} ${unitCode}
            </span>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Outgoing Date</label>
              <input type="date" name="outDate" class="form-control" value="${today}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Outgoing Challan No</label>
              <input type="text" name="challanNo" class="form-control" placeholder="e.g. 690" required>
            </div>
          </div>

          <div class="form-row">
            ${hasSpec ? `
              <div class="form-group">
                <label class="form-label">${specLabel}</label>
                <input type="text" name="specValue" class="form-control" placeholder="e.g. 271">
              </div>
            ` : ''}
            <div class="form-group">
              <label class="form-label">${isWeightBased ? 'Pieces Issued (QTY)' : `Quantity Issued (${unitCode})`}</label>
              <input type="number" step="any" name="qty" id="out-input-qty" class="form-control" placeholder="e.g. 85" required>
            </div>
            ${isWeightBased ? `
              <div class="form-group">
                <label class="form-label">Piece Weight (${unitCode})</label>
                <input type="number" step="any" name="pieceWeight" id="out-input-piece-weight" class="form-control" placeholder="e.g. 0.700" required>
              </div>
            ` : `
              <div class="form-group">
                <label class="form-label">Piece Weight (Optional)</label>
                <input type="number" step="any" name="pieceWeight" id="out-input-piece-weight" class="form-control" placeholder="Optional">
              </div>
            `}
          </div>

          <div id="deducted-preview" style="background: #F8FAFC; padding: 12px; border-radius: var(--radius-md); border: 1px dashed var(--border); margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="color: var(--neutral);">Calculated Deducted Amount:</span>
              <span id="preview-deducted-val" style="font-weight: 700; font-family: var(--font-mono);">-</span>
            </div>
            <div id="preview-balance-warning" class="form-error" style="display: none; margin-top: 6px;">
              Deducted amount exceeds available balance!
            </div>
          </div>
        </form>
      `,
      confirmText: 'Commit Issue',
      onConfirm: async () => {
        const form = document.getElementById('add-outgoing-form');
        const outDate = form.outDate.value;
        const challanNo = form.challanNo.value.trim();
        const qty = form.qty.value;
        const pieceWeight = form.pieceWeight ? form.pieceWeight.value : null;
        const specValue = form.specValue ? form.specValue.value.trim() : null;

        await Api.post('/api/outgoing', {
          incomingEntryId: entryId,
          outDate,
          challanNo,
          qty,
          pieceWeight: pieceWeight || null,
          specValue: specValue || null,
        });

        Toast.show('Outgoing row recorded successfully', 'success');
        await this.loadLedger();
        return true;
      },
    });

    // Realtime preview calculation via IPC calcDeducted
    const qtyInput = document.getElementById('out-input-qty');
    const pwInput = document.getElementById('out-input-piece-weight');
    const previewVal = document.getElementById('preview-deducted-val');
    const warningDiv = document.getElementById('preview-balance-warning');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    const updatePreview = async () => {
      const q = qtyInput.value;
      const pw = pwInput ? pwInput.value : null;
      if (!q || Number(q) <= 0) {
        previewVal.textContent = '-';
        warningDiv.style.display = 'none';
        confirmBtn.disabled = false;
        return;
      }

      const res = await window.api.calcDeducted({
        deductBy: material.deductBy,
        qty: q,
        pieceWeight: pw,
      });

      if (res && res.deducted) {
        previewVal.textContent = `${res.deducted} ${unitCode}`;
        const isOver = Number(res.deducted) > Number(availableBalance);
        if (isOver) {
          warningDiv.style.display = 'block';
          confirmBtn.disabled = true;
        } else {
          warningDiv.style.display = 'none';
          confirmBtn.disabled = false;
        }
      } else {
        previewVal.textContent = '-';
      }
    };

    qtyInput.oninput = updatePreview;
    if (pwInput) pwInput.oninput = updatePreview;
  },

  openEditIncomingModal(entryId) {
    const entry = this.ledgerData.entries.find((e) => e.id === entryId);
    if (!entry) return;

    Modal.open({
      title: `Edit Incoming Entry (${entry.challanNo})`,
      bodyHtml: `
        <form id="edit-incoming-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Incoming Date</label>
              <input type="date" name="inDate" class="form-control" value="${entry.inDate}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Challan No</label>
              <input type="text" name="challanNo" class="form-control" value="${entry.challanNo}" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Quantity</label>
            <input type="number" step="any" name="quantity" class="form-control" value="${entry.quantity}" required>
            <span style="font-size: 11.5px; color: var(--neutral);">Already deducted: ${entry.totalDeducted || 0}</span>
          </div>
        </form>
      `,
      confirmText: 'Save Changes',
      onConfirm: async () => {
        const form = document.getElementById('edit-incoming-form');
        await Api.patch(`/api/incoming/${entryId}`, {
          inDate: form.inDate.value,
          challanNo: form.challanNo.value.trim(),
          quantity: form.quantity.value,
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

  openEditOutgoingModal(rowId) {
    let targetRow = null;
    let parentEntry = null;

    for (const e of this.ledgerData.entries) {
      const found = (e.outgoingRows || []).find((r) => r.id === rowId);
      if (found) {
        targetRow = found;
        parentEntry = e;
        break;
      }
    }
    if (!targetRow) return;

    const { material } = this.ledgerData;
    const isWeightBased = material.deductBy === 'qty_x_piece_weight';
    const hasSpec = Boolean(material.specLabel);

    Modal.open({
      title: `Edit Outgoing Row (${targetRow.challanNo})`,
      bodyHtml: `
        <form id="edit-outgoing-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Out Date</label>
              <input type="date" name="outDate" class="form-control" value="${targetRow.outDate}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Challan No</label>
              <input type="text" name="challanNo" class="form-control" value="${targetRow.challanNo}" required>
            </div>
          </div>
          <div class="form-row">
            ${hasSpec ? `
              <div class="form-group">
                <label class="form-label">${material.specLabel}</label>
                <input type="text" name="specValue" class="form-control" value="${targetRow.specValue || ''}">
              </div>
            ` : ''}
            <div class="form-group">
              <label class="form-label">Quantity</label>
              <input type="number" step="any" name="qty" class="form-control" value="${targetRow.qty}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Piece Weight</label>
              <input type="number" step="any" name="pieceWeight" class="form-control" value="${targetRow.pieceWeight || ''}">
            </div>
          </div>
        </form>
      `,
      confirmText: 'Save Row',
      onConfirm: async () => {
        const form = document.getElementById('edit-outgoing-form');
        await Api.patch(`/api/outgoing/${rowId}`, {
          outDate: form.outDate.value,
          challanNo: form.challanNo.value.trim(),
          qty: form.qty.value,
          pieceWeight: form.pieceWeight.value ? form.pieceWeight.value : null,
          specValue: form.specValue ? form.specValue.value.trim() : null,
          version: targetRow.version,
        });
        Toast.show('Outgoing row updated', 'success');
        await this.loadLedger();
        return true;
      },
    });
  },

  confirmDeleteOutgoing(rowId) {
    Modal.confirm({
      title: 'Delete Outgoing Row',
      message: 'Are you sure you want to delete this outgoing transaction? Running balances will be recalculated.',
      confirmText: 'Delete Row',
      onConfirm: async () => {
        await Api.delete(`/api/outgoing/${rowId}`);
        Toast.show('Outgoing row deleted', 'success');
        await this.loadLedger();
      },
    });
  },

  async exportCurrentMaterial() {
    if (!this.currentMaterialId) return;
    try {
      const res = await window.api.exportMaterial(this.currentMaterialId);
      if (!res.canceled) {
        Toast.show(`Workbook saved: ${res.filePath}`, 'success');
      }
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },
};

