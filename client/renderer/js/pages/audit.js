const AuditPage = {
  currentEntity: '',

  async render(container) {
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h1 style="font-size: 22px;">Security & Activity Audit Log</h1>
          <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Immutable ledger of every record creation, modification, and deletion</p>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
          <select id="audit-entity-filter" class="form-control" style="width: 180px; height: 32px; font-size: 12.5px;">
            <option value="">All Entities</option>
            <option value="incoming_entries">Incoming Entries</option>
            <option value="outgoing_transactions">Outgoing Rows</option>
            <option value="materials">Materials</option>
            <option value="parties">Parties</option>
            <option value="products">Products</option>
            <option value="bom_lines">BOM Lines</option>
            <option value="users">Users</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="audit-refresh-btn">Refresh</button>
        </div>
      </div>

      <div class="card" style="padding: 0; overflow: hidden;">
        <div id="audit-table-container">
          <div style="text-align: center; padding: 30px; color: var(--neutral);">Loading audit logs...</div>
        </div>
      </div>
    `;

    const select = document.getElementById('audit-entity-filter');
    select.onchange = () => {
      this.currentEntity = select.value;
      this.loadAuditLogs();
    };

    document.getElementById('audit-refresh-btn').onclick = () => this.loadAuditLogs();

    await this.loadAuditLogs();
  },

  async loadAuditLogs() {
    const container = document.getElementById('audit-table-container');
    if (!container) return;

    try {
      const res = await Api.get('/api/admin/audit', {
        entity: this.currentEntity || undefined,
        limit: 100,
      });

      const logs = res.logs || [];
      if (logs.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--neutral);">No audit logs found.</div>';
        return;
      }

      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 140px;">Timestamp</th>
              <th style="width: 130px;">User</th>
              <th style="width: 95px;">Action</th>
              <th style="width: 130px;">Entity</th>
              <th>Details / Summary</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map((log) => {
              let actionClass = 'chip-neutral';
              if (log.action === 'CREATE') actionClass = 'chip-success';
              else if (log.action === 'UPDATE') actionClass = 'chip-warning';
              else if (log.action === 'DELETE') actionClass = 'chip-error';

              const entityLabels = {
                incoming_entries: 'Incoming Entry',
                outgoing_transactions: 'Outgoing Row',
                materials: 'Material',
                parties: 'Party',
                products: 'Product',
                bom_lines: 'BOM Line',
                users: 'User',
                units: 'Unit',
              };
              const entityLabel = entityLabels[log.entity] || log.entity;

              let userHtml = '<span style="color: var(--neutral); font-size: 12px; font-style: italic;">System</span>';
              if (log.user) {
                const u = log.user;
                const initials = (u.username || 'U').substring(0, 2).toUpperCase();
                const color = u.color || '#635BFF';
                userHtml = `
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="user-avatar-badge" style="background-color: ${color}; width: 22px; height: 22px; font-size: 10px;" title="${u.username}">
                      ${initials}
                    </span>
                    <span style="font-size: 12.5px; font-weight: 500; color: var(--secondary);">${u.username}</span>
                  </div>
                `;
              }

              const detailsHtml = this.formatAuditDetails(log);

              return `
                <tr>
                  <td style="font-size: 12px; color: var(--text-secondary); white-space: nowrap;">${Format.dateTime(log.at)}</td>
                  <td>${userHtml}</td>
                  <td><span class="chip ${actionClass}" style="font-size: 11px; font-weight: 600;">${log.action}</span></td>
                  <td><span class="chip chip-neutral" style="font-size: 11px;">${entityLabel}</span></td>
                  <td style="font-size: 13px; line-height: 1.45;">${detailsHtml}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color: var(--error); padding: 20px;">${err.message}</div>`;
    }
  },

  formatAuditDetails(log) {
    const action = log.action;
    const entity = log.entity;
    const before = log.before || {};
    const after = log.after || {};
    const data = action === 'DELETE' ? before : after;

    if (entity === 'parties') {
      if (action === 'CREATE') {
        return `Created Party: <strong>${data.name || 'Unnamed'}</strong>`;
      }
      if (action === 'DELETE') {
        return `Deleted Party: <strong>${data.name || 'Unnamed'}</strong>`;
      }
      if (action === 'UPDATE') {
        const changes = [];
        if (before.name && after.name && before.name !== after.name) {
          changes.push(`Name: <strong>${before.name}</strong> &rarr; <strong>${after.name}</strong>`);
        }
        if (before.isActive !== undefined && after.isActive !== undefined && before.isActive !== after.isActive) {
          changes.push(`Status: <strong>${before.isActive ? 'Active' : 'Disabled'}</strong> &rarr; <strong>${after.isActive ? 'Active' : 'Disabled'}</strong>`);
        }
        return changes.length > 0 ? changes.join(' &bull; ') : `Updated Party <strong>${after.name || before.name || ''}</strong>`;
      }
    }

    if (entity === 'products') {
      const partyName = data.partyName || (data.party ? data.party.name : '');
      if (action === 'CREATE') {
        return `Created Product: <strong>${data.name || 'Unnamed'}</strong>${partyName ? ` &bull; Party: <em>${partyName}</em>` : ''}`;
      }
      if (action === 'DELETE') {
        return `Deleted Product: <strong>${data.name || 'Unnamed'}</strong>`;
      }
      if (action === 'UPDATE') {
        const changes = [];
        if (before.name && after.name && before.name !== after.name) {
          changes.push(`Name: <strong>${before.name}</strong> &rarr; <strong>${after.name}</strong>`);
        }
        if (before.isActive !== undefined && after.isActive !== undefined && before.isActive !== after.isActive) {
          changes.push(`Status: <strong>${before.isActive ? 'Active' : 'Disabled'}</strong> &rarr; <strong>${after.isActive ? 'Active' : 'Disabled'}</strong>`);
        }
        return changes.length > 0 ? changes.join(' &bull; ') : `Updated Product <strong>${after.name || before.name || ''}</strong>`;
      }
    }

    if (entity === 'bom_lines') {
      const matName = data.materialName || (data.material ? data.material.name : 'Material');
      const unit = (data.material && data.material.unit) ? data.material.unit.code : '';
      const prodName = data.productName ? ` for <em>${data.productName}</em>` : '';

      if (action === 'CREATE') {
        return `Added <strong>${matName}</strong>${prodName} &bull; Consumption: <strong>${Format.number(data.consumption)} ${unit}</strong>${data.specValue ? ` &bull; Spec: <strong>${data.specValue}</strong>` : ''}`;
      }
      if (action === 'DELETE') {
        return `Removed <strong>${matName}</strong>${prodName} &bull; Consumption: <strong>${Format.number(data.consumption)} ${unit}</strong>`;
      }
      if (action === 'UPDATE') {
        const changes = [];
        if (before.consumption !== after.consumption) {
          changes.push(`Consumption: <strong>${Format.number(before.consumption)}</strong> &rarr; <strong>${Format.number(after.consumption)} ${unit}</strong>`);
        }
        if (before.specValue !== after.specValue) {
          changes.push(`Spec: <strong>${before.specValue || 'None'}</strong> &rarr; <strong>${after.specValue || 'None'}</strong>`);
        }
        return `<strong>${matName}</strong>: ${changes.join(' &bull; ')}`;
      }
    }

    if (entity === 'incoming_entries') {
      const matName = data.materialName ? ` &bull; Material: <strong>${data.materialName}</strong>` : '';
      if (action === 'CREATE') {
        return `Challan In: <strong>${data.challanNo}</strong>${matName} &bull; Qty: <strong>${Format.number(data.quantity)}</strong>${data.supplier ? ` &bull; Supplier: <em>${data.supplier}</em>` : ''}${data.inDate ? ` &bull; Date: <strong>${Format.date(data.inDate)}</strong>` : ''}`;
      }
      if (action === 'DELETE') {
        return `Deleted Challan: <strong>${data.challanNo}</strong> (Qty: ${Format.number(data.quantity)})`;
      }
      if (action === 'UPDATE') {
        const changes = [];
        if (before.challanNo && after.challanNo && before.challanNo !== after.challanNo) changes.push(`Challan: <strong>${before.challanNo}</strong> &rarr; <strong>${after.challanNo}</strong>`);
        if (before.quantity && after.quantity && before.quantity !== after.quantity) changes.push(`Qty: <strong>${Format.number(before.quantity)}</strong> &rarr; <strong>${Format.number(after.quantity)}</strong>`);
        if (before.supplier !== after.supplier) changes.push(`Supplier: <strong>${before.supplier || 'None'}</strong> &rarr; <strong>${after.supplier || 'None'}</strong>`);
        if (before.inDate && after.inDate && before.inDate !== after.inDate) changes.push(`Date: <strong>${Format.date(before.inDate)}</strong> &rarr; <strong>${Format.date(after.inDate)}</strong>`);
        return `Challan <strong>${after.challanNo || before.challanNo || ''}</strong>: ${changes.length > 0 ? changes.join(' &bull; ') : 'Updated'}`;
      }
    }

    if (entity === 'outgoing_transactions') {
      if (action === 'CREATE') {
        return `Issue Challan: <strong>${data.challanNo}</strong> &bull; Qty: <strong>${Format.number(data.qty)}</strong>${data.pieceWeight ? ` &bull; Piece Wt: <strong>${data.pieceWeight}</strong>` : ''} &bull; Deducted: <strong>${Format.number(data.deducted)}</strong> &bull; Row: <strong>#${data.rowNo}</strong>${data.outDate ? ` &bull; Date: <strong>${Format.date(data.outDate)}</strong>` : ''}`;
      }
      if (action === 'DELETE') {
        return `Deleted Row #${data.rowNo} on Challan: <strong>${data.challanNo}</strong> (Qty: ${Format.number(data.qty)}, Deducted: ${Format.number(data.deducted)})`;
      }
      if (action === 'UPDATE') {
        const changes = [];
        if (before.challanNo && after.challanNo && before.challanNo !== after.challanNo) changes.push(`Challan: <strong>${before.challanNo}</strong> &rarr; <strong>${after.challanNo}</strong>`);
        if (before.qty && after.qty && before.qty !== after.qty) changes.push(`Qty: <strong>${Format.number(before.qty)}</strong> &rarr; <strong>${Format.number(after.qty)}</strong>`);
        if (before.deducted && after.deducted && before.deducted !== after.deducted) changes.push(`Deducted: <strong>${Format.number(before.deducted)}</strong> &rarr; <strong>${Format.number(after.deducted)}</strong>`);
        if (before.pieceWeight !== after.pieceWeight) changes.push(`Piece Wt: <strong>${before.pieceWeight || '-'}</strong> &rarr; <strong>${after.pieceWeight || '-'}</strong>`);
        if (before.outDate && after.outDate && before.outDate !== after.outDate) changes.push(`Date: <strong>${Format.date(before.outDate)}</strong> &rarr; <strong>${Format.date(after.outDate)}</strong>`);
        return `Row #${after.rowNo || before.rowNo || ''}: ${changes.length > 0 ? changes.join(' &bull; ') : 'Updated'}`;
      }
    }

    if (entity === 'materials') {
      const mode = data.deductBy === 'qty_x_piece_weight' ? 'Measured / Weight' : 'Counted / Pieces';
      if (action === 'CREATE') {
        return `Created Material: <strong>${data.name}</strong> &bull; Mode: <strong>${mode}</strong>${data.specLabel ? ` &bull; Spec: <strong>${data.specLabel}</strong>` : ''}`;
      }
      if (action === 'DELETE') {
        return `Deleted Material: <strong>${data.name}</strong>`;
      }
      if (action === 'UPDATE') {
        const changes = [];
        if (before.name && after.name && before.name !== after.name) changes.push(`Name: <strong>${before.name}</strong> &rarr; <strong>${after.name}</strong>`);
        if (before.specLabel !== after.specLabel) changes.push(`Spec: <strong>${before.specLabel || 'None'}</strong> &rarr; <strong>${after.specLabel || 'None'}</strong>`);
        if (before.isActive !== undefined && after.isActive !== undefined && before.isActive !== after.isActive) {
          changes.push(`Status: <strong>${before.isActive ? 'Active' : 'Disabled'}</strong> &rarr; <strong>${after.isActive ? 'Active' : 'Disabled'}</strong>`);
        }
        return changes.length > 0 ? changes.join(' &bull; ') : `Updated Material <strong>${after.name || before.name || ''}</strong>`;
      }
    }

    if (entity === 'units') {
      if (action === 'CREATE') return `Created Unit: <strong>${data.name} (${data.code})</strong>`;
      if (action === 'DELETE') return `Deleted Unit: <strong>${data.name} (${data.code})</strong>`;
      if (action === 'UPDATE') return `Updated Unit: <strong>${after.name} (${after.code})</strong>`;
    }

    if (entity === 'users') {
      if (action === 'CREATE') return `Created User Account: <strong>${data.username}</strong> &bull; Role: <strong>${data.role}</strong>`;
      if (action === 'DELETE') return `Deleted User Account: <strong>${data.username}</strong>`;
      if (action === 'UPDATE') {
        const changes = [];
        if (before.role && after.role && before.role !== after.role) changes.push(`Role: <strong>${before.role}</strong> &rarr; <strong>${after.role}</strong>`);
        if (before.isActive !== undefined && after.isActive !== undefined && before.isActive !== after.isActive) {
          changes.push(`Status: <strong>${before.isActive ? 'Active' : 'Disabled'}</strong> &rarr; <strong>${after.isActive ? 'Active' : 'Disabled'}</strong>`);
        }
        return `User <strong>${after.username || before.username || ''}</strong>: ${changes.length > 0 ? changes.join(' &bull; ') : 'Updated'}`;
      }
    }

    // Generic fallback for any unexpected records: strip technical UUIDs and system metadata
    const ignoredKeys = new Set([
      'id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'version', 'lockSeq',
      'passwordHash', 'password_hash', 'materialId', 'productId', 'partyId', 'unitId',
      'userId', 'incomingEntryId'
    ]);
    const cleanObj = {};
    for (const [k, v] of Object.entries(data)) {
      if (!ignoredKeys.has(k) && v !== null && v !== undefined && typeof v !== 'object') {
        cleanObj[k] = v;
      }
    }
    const pairs = Object.entries(cleanObj).map(([k, v]) => `${k}: <strong>${v}</strong>`).join(' &bull; ');
    return pairs || 'Action completed';
  },
};

