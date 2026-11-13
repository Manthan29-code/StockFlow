const LedgerPage = {
  currentMaterialId: null,
  currentFilter: 'all', // 'all' | 'partial' | 'not_issued' | 'closed'
  ledgerData: null,

  async render(container, queryParams = {}) {
    this.currentMaterialId = queryParams.materialId || this.currentMaterialId;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="position: relative;">
            <label class="form-label" style="margin-bottom: 4px;">Search Material</label>
            <div style="position: relative; width: 320px;">
              <input type="text" id="ledger-material-search" class="form-control" autocomplete="off" style="width: 100%; font-weight: 600; padding-right: 30px;">
              <span id="ledger-material-clear" title="Clear / View All" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--neutral); font-size: 16px; font-weight: bold; line-height: 1; user-select: none;">&times;</span>
            </div>
            <!-- Live Search Dropdown Filter -->
            <div id="ledger-material-dropdown" class="card no-scrollbar" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; width: 350px; max-height: 280px; overflow-y: auto; z-index: 100; box-shadow: var(--shadow-lg); padding: 4px 0; border: 1px solid var(--border); background: #FFFFFF;"></div>
          </div>
          <div id="material-stock-banner" style="background: #FFFFFF; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 16px; margin-top: 18px;">
            <span style="font-size: 11px; text-transform: uppercase; color: var(--neutral); font-weight: 600;">Total Stock Balance</span>
            <div id="ledger-total-stock" style="font-size: 18px; font-weight: 700; color: var(--secondary); font-family: var(--font-mono);">-</div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; align-items: flex-end;">
          <button class="btn btn-secondary btn-sm" id="ledger-export-btn">Export</button>
        </div>
      </div>

      <!-- Filters -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-sm ${this.currentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-filter="all">All Entries</button>
          <button class="btn btn-sm ${this.currentFilter === 'partial' ? 'btn-primary' : 'btn-secondary'}" data-filter="partial">Open / Partial</button>
          <button class="btn btn-sm ${this.currentFilter === 'not_issued' ? 'btn-primary' : 'btn-secondary'}" data-filter="not_issued">Not Issued</button>
          <button class="btn btn-sm ${this.currentFilter === 'closed' ? 'btn-primary' : 'btn-secondary'}" data-filter="closed">Closed</button>
        </div>
        <div style="font-size: 12.5px; color: var(--neutral);" id="ledger-entry-counts"></div>
      </div>

      <div id="ledger-entries-container">
        <div style="text-align: center; padding: 40px; color: var(--neutral);">Loading report records...</div>
      </div>
    `;

    // Bind export button immediately
    const exportBtn = document.getElementById('ledger-export-btn');
    if (exportBtn) {
      exportBtn.onclick = () => this.exportCurrentMaterial();
    }

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

    await this.initMaterialSelect();
  },

  async initMaterialSelect() {
    const searchInput = document.getElementById('ledger-material-search');
    const dropdown = document.getElementById('ledger-material-dropdown');
    const clearBtn = document.getElementById('ledger-material-clear');
    if (!searchInput || !dropdown) return;

    try {
      const materials = await Api.get('/api/materials');
      State.materialsCache = materials;

      if (materials.length === 0) {
        searchInput.value = '';
        searchInput.disabled = true;
        document.getElementById('ledger-entries-container').innerHTML = `
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

      const totalStockEl = document.getElementById('ledger-total-stock');
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
    const container = document.getElementById('ledger-entries-container');
    if (!container || !this.ledgerData) return;

    const { material, entries } = this.ledgerData;
    const isWeightBased = material.deductBy === 'qty_x_piece_weight';
    const hasSpec = Boolean(material.specLabel);
    const specLabel = material.specLabel || 'TL';
    const unitCode = material.unit ? material.unit.code : (isWeightBased ? 'kg' : 'nos');

    const filtered = entries.filter((e) => {
      if (this.currentFilter === 'all') return true;
      if (this.currentFilter === 'partial') return e.status === 'partial';
      if (this.currentFilter === 'not_issued') return e.status === 'not_issued';
      if (this.currentFilter === 'closed') return e.status === 'closed';
      return true;
    });

    document.getElementById('ledger-entry-counts').textContent = `Showing ${filtered.length} of ${entries.length} inward records`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
          <h4 style="color: var(--neutral); margin-bottom: 8px;">No Entries Found</h4>
          <p style="color: var(--neutral-light); font-size: 13.5px;">No incoming entries match the current filter.</p>
        </div>
      `;
      return;
    }

    // Unified Header (Image 2)
    const theadCols = `
      <tr>
        <th style="text-align: center; width: 110px;">IN DATE</th>
        <th style="text-align: center; width: 120px;">INWARD NO</th>
        <th style="text-align: center; width: 110px;">${isWeightBased ? 'IN QUANTITY' : 'IN QTY'}</th>
        <th style="text-align: center; width: 110px;">OUT DATE</th>
        <th style="text-align: center; width: 120px;">OUTWARD NO</th>
        ${hasSpec ? `<th style="text-align: center; width: 80px;">${specLabel}</th>` : ''}
        <th style="text-align: center; width: 100px;">${isWeightBased ? 'QTY (PCS)' : 'OUT QTY'}</th>
        ${isWeightBased ? `<th style="text-align: center; width: 120px;">TOTAL WT (${unitCode.toUpperCase()})</th>` : ''}
        <th style="text-align: center; width: 110px;">BALANCE</th>
        <th style="text-align: center; width: 60px;">BY</th>
        ${State.isAdmin() ? '<th style="text-align: center; width: 110px;">ACTIONS</th>' : ''}
      </tr>
    `;

    const totalColSpan = (hasSpec ? 1 : 0) + (isWeightBased ? 1 : 0) + (State.isAdmin() ? 9 : 8);

    let rowsHtml = '';
    filtered.forEach((entry, entryIdx) => {
      const outgoingRows = entry.outgoingRows || [];
      const isStartShipment = entryIdx > 0;
      const shipmentClass = isStartShipment ? 'inward-shipment-start' : '';

      if (outgoingRows.length === 0) {
        // Shipment with no dispatches yet
        rowsHtml += `
          <tr class="${shipmentClass}">
            <td style="text-align: center;" class="font-bold">${Format.date(entry.inDate)}</td>
            <td style="text-align: center;" class="mono font-bold">${entry.challanNo}</td>
            <td style="text-align: center;" class="mono font-bold">${Format.number(entry.quantity)}</td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center;">-</td>
            ${hasSpec ? '<td style="text-align: center;">-</td>' : ''}
            <td style="text-align: center;">-</td>
            ${isWeightBased ? '<td style="text-align: center;">-</td>' : ''}
            <td style="text-align: center;" class="mono font-bold" style="color: ${Number(entry.balance) > 0 ? 'var(--primary)' : 'var(--neutral)'};">
              ${Format.number(entry.balance)}
            </td>
            <td style="text-align: center;">${Badge.render(entry.created_by, entry.createdAt)}</td>
            ${State.isAdmin() ? '<td style="text-align: center;">-</td>' : ''}
          </tr>
        `;
      } else {
        outgoingRows.forEach((row, rowIdx) => {
          const isFirstRow = rowIdx === 0;
          const trClass = isFirstRow && isStartShipment ? 'inward-shipment-start' : '';

          rowsHtml += `
            <tr class="${trClass}" id="row-${row.id}">
              <td style="text-align: center;" class="${isFirstRow ? 'font-bold' : ''}">${isFirstRow ? Format.date(entry.inDate) : ''}</td>
              <td style="text-align: center;" class="${isFirstRow ? 'mono font-bold' : ''}">${isFirstRow ? entry.challanNo : ''}</td>
              <td style="text-align: center;" class="${isFirstRow ? 'mono font-bold' : ''}">${isFirstRow ? Format.number(entry.quantity) : ''}</td>
              <td style="text-align: center;">${Format.date(row.outDate)}</td>
              <td style="text-align: center;" class="mono font-bold">${row.challanNo}</td>
              ${hasSpec ? `<td style="text-align: center;">${row.specValue || '-'}</td>` : ''}
              <td style="text-align: center;" class="mono font-bold">${Format.number(row.qty)}</td>
              ${isWeightBased ? `<td style="text-align: center;" class="mono font-bold">${Format.number(row.totalWeight || row.deducted)}</td>` : ''}
              <td style="text-align: center;" class="mono font-bold" style="color: ${Number(row.runningBalance) < 0 ? 'var(--error)' : 'var(--secondary)'};">
                ${Format.number(row.runningBalance)}
              </td>
              <td style="text-align: center;">${Badge.render(row.created_by, row.createdAt)}</td>
              ${State.isAdmin() ? `
                <td style="text-align: center; white-space: nowrap;">
                  <div style="display: inline-flex; gap: 4px; justify-content: center;">
                    <button class="btn btn-secondary btn-sm edit-out-btn" data-row-id="${row.id}" style="padding: 2px 7px; font-size: 11px;">Edit</button>
                    <button class="btn btn-secondary btn-sm delete-out-btn" data-row-id="${row.id}" style="padding: 2px 7px; font-size: 11px; color: var(--error);">Del</button>
                  </div>
                </td>
              ` : ''}
            </tr>
          `;
        });
      }
    });

    container.innerHTML = `
      <div class="card" style="padding: 0; overflow: hidden; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
        <div style="overflow-x: auto;">
          <table class="records-outward-table" style="width: 100%;">
            <thead>
              ${theadCols}
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindRowEvents();
  },

  bindRowEvents() {
    // Admin outgoing actions
    document.querySelectorAll('.edit-out-btn').forEach((btn) => {
      btn.onclick = () => this.openEditOutgoingModal(btn.getAttribute('data-row-id'));
    });

    document.querySelectorAll('.delete-out-btn').forEach((btn) => {
      btn.onclick = () => this.confirmDeleteOutgoing(btn.getAttribute('data-row-id'));
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
      title: `Edit Outward Row (${targetRow.challanNo})`,
      bodyHtml: `
        <form id="edit-outgoing-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Out Date</label>
              <input type="date" name="outDate" class="form-control" value="${targetRow.outDate}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Outward No</label>
              <input type="text" name="challanNo" class="form-control" value="${targetRow.challanNo}" required>
            </div>
          </div>
          <div class="form-row">
            ${hasSpec ? `
              <div class="form-group">
                <label class="form-label">${material.specLabel} <span style="font-weight: 400; color: var(--neutral); font-size: 11px;">(Optional)</span></label>
                <input type="text" name="specValue" class="form-control" value="${targetRow.specValue || ''}">
              </div>
            ` : ''}
            <div class="form-group">
              <label class="form-label">${isWeightBased ? 'Pieces (QTY)' : `Quantity (${material.unit ? material.unit.code : 'nos'})`}</label>
              <input type="number" step="any" name="qty" class="form-control" value="${targetRow.qty}" required>
            </div>
            ${isWeightBased ? `
              <div class="form-group">
                <label class="form-label">Piece Weight (${material.unit ? material.unit.code : 'kg'})</label>
                <input type="number" step="any" name="pieceWeight" class="form-control" value="${targetRow.pieceWeight || ''}" required>
              </div>
            ` : ''}
          </div>
        </form>
      `,
      confirmText: 'Save Row',
      onConfirm: async () => {
        const form = document.getElementById('edit-outgoing-form');
        if (!form.reportValidity()) return false;
        try {
          await Api.patch(`/api/outgoing/${rowId}`, {
            outDate: form.outDate.value,
            challanNo: form.challanNo.value.trim(),
            qty: form.qty.value,
            pieceWeight: (form.pieceWeight && form.pieceWeight.value) ? form.pieceWeight.value : null,
            specValue: form.specValue ? form.specValue.value.trim() : null,
            version: targetRow.version,
          });
          Toast.show('Outgoing row updated', 'success');
          await this.loadLedger();
          return true;
        } catch (err) {
          Toast.show(err.message || 'Failed to update row', 'error');
          return false;
        }
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

  exportCurrentMaterial() {
    if (!this.currentMaterialId) {
      Toast.show('Please select a material first', 'warning');
      return;
    }

    const material = (this.ledgerData && this.ledgerData.material) ||
      (State.materialsCache && State.materialsCache.find((m) => m.id === this.currentMaterialId));
    const materialName = material ? material.name : 'Material';

    let chosenFormat = 'excel';

    Modal.open({
      title: 'Export Material Records',
      bodyHtml: `
        <div style="font-size: 13.5px; color: var(--secondary); margin-bottom: 16px;">
          Choose the export format for <strong>${materialName}</strong>:
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 8px;">
          <div id="format-card-excel" style="border: 2px solid var(--primary); background: #F0F4FF; border-radius: var(--radius-md); padding: 18px 16px; cursor: pointer; text-align: center; transition: all 0.15s;">
            <div style="font-weight: 700; color: var(--secondary); font-size: 14.5px;">Excel (.xlsx)</div>
            <div style="font-size: 11.5px; color: var(--neutral); margin-top: 4px;">Standard factory workbook</div>
          </div>
          <div id="format-card-pdf" style="border: 2px solid var(--border); background: #FFFFFF; border-radius: var(--radius-md); padding: 18px 16px; cursor: pointer; text-align: center; transition: all 0.15s;">
            <div style="font-weight: 700; color: var(--secondary); font-size: 14.5px;">PDF Document (.pdf)</div>
            <div style="font-size: 11.5px; color: var(--neutral); margin-top: 4px;">Print-ready A4 document</div>
          </div>
        </div>
      `,
      confirmText: 'Export Now',
      onConfirm: async () => {
        try {
          if (chosenFormat === 'pdf') {
            const res = await window.api.exportMaterialPdf(this.currentMaterialId);
            if (res && !res.canceled) {
              Toast.show('Material PDF exported successfully', 'success');
              return true;
            }
          } else {
            const res = await window.api.exportMaterial(this.currentMaterialId);
            if (res && !res.canceled) {
              Toast.show('Material Excel exported successfully', 'success');
              return true;
            }
          }
        } catch (err) {
          Toast.show(`Export failed: ${err.message}`, 'error');
          return false;
        }
      },
    });

    const cardExcel = document.getElementById('format-card-excel');
    const cardPdf = document.getElementById('format-card-pdf');
    if (cardExcel && cardPdf) {
      cardExcel.onclick = () => {
        chosenFormat = 'excel';
        cardExcel.style.borderColor = 'var(--primary)';
        cardExcel.style.background = '#F0F4FF';
        cardPdf.style.borderColor = 'var(--border)';
        cardPdf.style.background = '#FFFFFF';
      };
      cardPdf.onclick = () => {
        chosenFormat = 'pdf';
        cardPdf.style.borderColor = 'var(--primary)';
        cardPdf.style.background = '#F0F4FF';
        cardExcel.style.borderColor = 'var(--border)';
        cardExcel.style.background = '#FFFFFF';
      };
    }
  },
};
