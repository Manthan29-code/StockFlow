const ImportWizardPage = {
  materials: [],
  parsedData: null,
  importType: 'material', // 'material' | 'bom'

  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px;">Excel Import Wizard</h1>
        <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Import legacy Excel stock sheets or Product BOM records with automated validation and previews</p>
      </div>

      <div class="card" style="margin-bottom: 24px; padding: 24px;">
        <div style="display: flex; gap: 20px; align-items: flex-end; flex-wrap: wrap;">
          <div>
            <label class="form-label">Import Type</label>
            <select id="import-type-select" class="form-control" style="width: 220px; font-weight: 600;">
              <option value="material">Material Stock Ledger Sheet</option>
              <option value="bom">Product Bill of Material (BOM)</option>
            </select>
          </div>

          <div id="material-picker-group" style="flex: 1; min-width: 260px;">
            <label class="form-label">Target Material</label>
            <select id="import-material-select" class="form-control" style="font-weight: 600;"></select>
          </div>

          <div>
            <button class="btn btn-primary" id="start-import-btn" style="height: 38px;">
              Choose Excel File & Preview &rarr;
            </button>
          </div>
        </div>
      </div>

      <div id="import-preview-container"></div>
    `;

    await this.initData();

    const typeSelect = document.getElementById('import-type-select');
    const matGroup = document.getElementById('material-picker-group');

    typeSelect.onchange = () => {
      this.importType = typeSelect.value;
      matGroup.style.display = this.importType === 'material' ? 'block' : 'none';
      document.getElementById('import-preview-container').innerHTML = '';
    };

    document.getElementById('start-import-btn').onclick = () => this.selectAndPreview();
  },

  async initData() {
    try {
      const materials = await Api.get('/api/materials');
      this.materials = materials;
      const select = document.getElementById('import-material-select');
      if (select && materials.length > 0) {
        select.innerHTML = materials.map((m) => `<option value="${m.id}">${m.name} (${m.deductBy === 'qty_x_piece_weight' ? 'Weight' : 'Direct'})</option>`).join('');
      }
    } catch (err) {
      console.error(err);
    }
  },

  async selectAndPreview() {
    const previewContainer = document.getElementById('import-preview-container');
    previewContainer.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--neutral);">Parsing Excel workbook...</div>';

    try {
      if (this.importType === 'material') {
        const matSelect = document.getElementById('import-material-select');
        const material = this.materials.find((m) => m.id === matSelect.value);
        if (!material) {
          Toast.show('Please select a material first', 'warning');
          return;
        }

        const res = await window.api.parseMaterialSheet(material);
        if (res.canceled) {
          previewContainer.innerHTML = '';
          return;
        }

        this.parsedData = { material, ...res };
        this.renderMaterialPreview(previewContainer);
      } else {
        const res = await window.api.parseBomSheet(this.materials);
        if (res.canceled) {
          previewContainer.innerHTML = '';
          return;
        }

        this.parsedData = res;
        this.renderBomPreview(previewContainer);
      }
    } catch (err) {
      previewContainer.innerHTML = `<div class="card" style="color: var(--error); padding: 20px;">Failed to parse: ${err.message}</div>`;
    }
  },

  renderMaterialPreview(container) {
    const { material, fileName, totalEntries, totalRows, warnings, entries } = this.parsedData;

    container.innerHTML = `
      <div class="card" style="margin-bottom: 24px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h3 class="card-title">Import Preview: <em>${fileName}</em> &rarr; ${material.name}</h3>
            <p style="color: var(--neutral); font-size: 13px; margin-top: 4px;">
              Found <strong>${totalEntries} incoming entries</strong> and <strong>${totalRows} outgoing transactions</strong>.
            </p>
          </div>
          <button class="btn btn-primary" id="commit-import-btn">
            Commit All Records to Database
          </button>
        </div>

        ${warnings.length > 0 ? `
          <div style="background: #FFF8E1; border: 1px solid #FFE082; padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 20px;">
            <strong style="color: #B78103; font-size: 13px;">Validation Warnings (${warnings.length}):</strong>
            <ul style="margin-left: 20px; font-size: 12.5px; color: #7F5800; margin-top: 6px;">
              ${warnings.slice(0, 10).map((w) => `<li>${w}</li>`).join('')}
              ${warnings.length > 10 ? `<li>...and ${warnings.length - 10} more</li>` : ''}
            </ul>
          </div>
        ` : `
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; padding: 10px 16px; border-radius: var(--radius-md); margin-bottom: 20px; color: #15803D; font-size: 13px;">
            &check; All sheet dates, quantities, and recalculated running balances verified clean.
          </div>
        `}

        <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-md);">
          <table class="data-table">
            <thead>
              <tr>
                <th>IN Date</th>
                <th>CH NO IN</th>
                <th class="num-cell">Received Qty</th>
                <th class="num-cell">Outgoing Rows</th>
                <th class="num-cell">Recalculated Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map((e) => `
                <tr>
                  <td>${e.inDate}</td>
                  <td class="mono">${e.challanNo}</td>
                  <td class="num-cell">${Format.number(e.quantity)}</td>
                  <td class="num-cell">${e.outgoingRows.length}</td>
                  <td class="num-cell" style="font-weight: 700; font-family: var(--font-mono);">${Format.number(e.recalculatedBalance)}</td>
                  <td><span class="chip ${e.status === 'closed' ? 'chip-success' : 'chip-warning'}">${e.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('commit-import-btn').onclick = async () => {
      const btn = document.getElementById('commit-import-btn');
      btn.disabled = true;
      btn.textContent = 'Committing...';
      try {
        await Api.post(`/api/import/materials/${material.id}/commit`, {
          entries: entries.map((e) => ({
            inDate: e.inDate,
            challanNo: e.challanNo,
            quantity: e.quantity,
            outgoingRows: e.outgoingRows.map((r, i) => ({
              outDate: r.outDate,
              challanNo: r.challanNo,
              rowNo: i + 1,
              qty: r.qty,
              pieceWeight: r.pieceWeight,
              specValue: r.specValue,
            })),
          })),
        });

        Toast.show(`Successfully committed all ${totalEntries} entries!`, 'success', 5000);
        Router.navigate(`ledger?materialId=${material.id}`);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Commit All Records';
        Toast.show(err.message || 'Import failed', 'error');
      }
    };
  },

  renderBomPreview(container) {
    const { fileName, items, warnings } = this.parsedData;

    container.innerHTML = `
      <div class="card" style="margin-bottom: 24px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h3 class="card-title">BOM Import Preview: <em>${fileName}</em></h3>
            <p style="color: var(--neutral); font-size: 13px; margin-top: 4px;">
              Parsed <strong>${items.length} BOM lines</strong> across parties and products.
            </p>
          </div>
          <button class="btn btn-primary" id="commit-bom-import-btn">
            Commit BOM to Database
          </button>
        </div>

        ${warnings.length > 0 ? `
          <div style="background: #FFF8E1; border: 1px solid #FFE082; padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 20px;">
            <strong style="color: #B78103; font-size: 13px;">Warnings (${warnings.length}):</strong>
            <ul style="margin-left: 20px; font-size: 12.5px; color: #7F5800; margin-top: 6px;">
              ${warnings.slice(0, 10).map((w) => `<li>${w}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div style="max-height: 450px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-md);">
          <table class="data-table">
            <thead>
              <tr>
                <th>Party</th>
                <th>Product</th>
                <th>Raw Bill of Material</th>
                <th>Mapped Material</th>
                <th class="num-cell">Consumption</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, idx) => `
                <tr>
                  <td style="font-weight: 500;">${item.partyName}</td>
                  <td style="font-weight: 600;">${item.productName}</td>
                  <td style="font-size: 12px; color: var(--neutral);">${item.rawBomText}</td>
                  <td>
                    <select class="form-control bom-map-select" data-idx="${idx}" style="height: 30px; font-size: 12px; min-width: 180px;">
                      <option value="">-- Choose Material --</option>
                      ${this.materials.map((m) => `<option value="${m.id}" ${m.id === item.suggestedMaterialId ? 'selected' : ''}>${m.name}</option>`).join('')}
                    </select>
                  </td>
                  <td class="num-cell" style="font-weight: 700; font-family: var(--font-mono);">${Format.number(item.consumption)}</td>
                  <td><span class="chip chip-neutral">${item.unit || '-'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('commit-bom-import-btn').onclick = async () => {
      const selects = document.querySelectorAll('.bom-map-select');
      const payloadItems = [];

      for (const sel of selects) {
        const idx = Number(sel.getAttribute('data-idx'));
        const materialId = sel.value;
        const item = items[idx];

        if (!materialId) {
          Toast.show(`Please select a mapped material for row ${item.rowNumber} (${item.rawBomText})`, 'error');
          return;
        }

        payloadItems.push({
          partyName: item.partyName,
          productName: item.productName,
          materialId,
          consumption: item.consumption,
          specValue: item.suggestedSpecValue || null,
        });
      }

      const btn = document.getElementById('commit-bom-import-btn');
      btn.disabled = true;
      btn.textContent = 'Committing...';

      try {
        await Api.post('/api/import/bom/commit', { items: payloadItems });
        Toast.show('BOM lines imported successfully!', 'success');
        Router.navigate('bom-editor');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Commit BOM to Database';
        Toast.show(err.message, 'error');
      }
    };
  },
};

