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
              <th style="width: 170px;">Timestamp</th>
              <th style="width: 110px;">Action</th>
              <th style="width: 160px;">Entity</th>
              <th>Details / Diff</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map((log) => {
              let actionClass = 'chip-neutral';
              if (log.action === 'CREATE') actionClass = 'chip-success';
              else if (log.action === 'UPDATE') actionClass = 'chip-warning';
              else if (log.action === 'DELETE') actionClass = 'chip-error';

              let diffHtml = '';
              if (log.after) {
                diffHtml += `<span style="font-size: 11.5px; color: var(--neutral);">Data: </span><code class="mono" style="font-size: 11px;">${JSON.stringify(log.after)}</code>`;
              }
              if (log.before && log.action === 'UPDATE') {
                diffHtml += `<div style="font-size: 11px; color: var(--neutral-light); margin-top: 2px;">Prev: <code class="mono">${JSON.stringify(log.before)}</code></div>`;
              }

              return `
                <tr>
                  <td style="font-size: 12px; color: var(--text-secondary);">${Format.dateTime(log.at)}</td>
                  <td><span class="chip ${actionClass}">${log.action}</span></td>
                  <td style="font-weight: 500;">${log.entity}</td>
                  <td>${diffHtml || '-'}</td>
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
};

