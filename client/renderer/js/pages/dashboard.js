const DashboardPage = {
  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="font-size: 22px;">Material Inventory Overview</h1>
          <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Live summary of raw materials, components and available stock</p>
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" id="dashboard-refresh-btn">Refresh</button>
        </div>
      </div>

      <div id="materials-list" style="display: flex; flex-direction: column; gap: 14px;">
        <div style="text-align: center; padding: 40px; color: var(--neutral);">Loading inventory stock...</div>
      </div>
    `;

    const refreshBtn = document.getElementById('dashboard-refresh-btn');
    if (refreshBtn) {
      refreshBtn.onclick = () => this.loadData();
    }

    await this.loadData();
  },

  async loadData() {
    const list = document.getElementById('materials-list');
    if (!list) return;

    try {
      const summaries = await Api.get('/api/stock');
      if (!document.getElementById('materials-list')) return;

      if (summaries.length === 0) {
        list.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
            <h3 style="color: var(--neutral); margin-bottom: 8px;">No Materials Created Yet</h3>
            <p style="color: var(--neutral-light); font-size: 13.5px; margin-bottom: 16px;">Create raw materials or components to begin tracking incoming challans and dispatch ledgers.</p>
            ${State.isAdmin() ? '<a href="#materials" class="btn btn-primary btn-sm">Add First Material</a>' : ''}
          </div>
        `;
        return;
      }

      list.innerHTML = summaries.map((item) => {
        const mat = item.material;
        const unitCode = mat.unit ? mat.unit.code : '';
        const modeLabel = mat.deductBy === 'qty_x_piece_weight' ? 'Measured / Weight' : 'Counted / Pieces';

        const totalStockNum = Number(item.totalStock || 0);
        const totalInNum = Number(item.totalInQuantity || 0);
        const pct = totalInNum > 0 ? Math.min(100, Math.max(0, Math.round((totalStockNum / totalInNum) * 100))) : 0;
        const bubbleLeft = Math.max(12, Math.min(88, pct));

        return `
          <div class="card material-stock-card" data-material-id="${mat.id}" style="cursor: pointer; padding: 16px 20px; transition: border-color 0.15s, box-shadow 0.15s;">
            <!-- Top Row: Material Name (Wraps if long) -->
            <div style="margin-bottom: 12px;">
              <h3 style="font-size: 16px; font-weight: 700; color: var(--secondary); line-height: 1.35; word-break: break-word;">
                ${mat.name}
              </h3>
            </div>

            <!-- Bottom Row: Badges, Progress Bar, Balance & Action -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
              <!-- Left: Badges & Open Entries Chip -->
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="chip chip-neutral" style="font-size: 12px; font-weight: 500; height: 26px; padding: 0 10px;">
                  ${modeLabel}${mat.specLabel ? ' &bull; Spec: ' + mat.specLabel : ''}
                </span>
                <span class="chip ${item.openEntriesCount > 0 ? 'chip-warning' : 'chip-success'}" style="font-size: 12px; font-weight: 600; height: 26px; padding: 0 10px;">
                  ${item.openEntriesCount} Open Entries
                </span>
              </div>

              <!-- Center: Stock Balance & Visual Progress Bar -->
              <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;" title="Stock Balance: ${Format.number(item.totalStock)} ${unitCode} (${pct}% of ${Format.number(item.totalInQuantity || item.totalStock)} ${unitCode} total received)">
                <span style="font-size: 12px; font-weight: 600; color: var(--neutral); text-transform: uppercase; letter-spacing: 0.04em;">Stock Balance</span>

                <div style="position: relative; width: 170px; height: 8px; background: #E2E8F0; border-radius: 9999px; margin-top: 10px; margin-bottom: 2px;">
                  <div style="height: 100%; width: ${pct}%; background: ${pct > 20 ? 'var(--success)' : (pct > 0 ? 'var(--warning)' : '#CBD5E1')}; border-radius: 9999px; transition: width 0.3s ease;"></div>
                  <div style="position: absolute; top: -19px; left: ${bubbleLeft}%; transform: translateX(-50%); font-size: 10.5px; font-weight: 700; color: var(--secondary); background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 4px; padding: 0 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); white-space: nowrap; line-height: 15px;">
                    ${pct}%
                  </div>
                </div>

                <div style="font-family: var(--font-mono); font-size: 14px; font-weight: 700; color: var(--secondary); white-space: nowrap;">
                  ${Format.number(item.totalStock)} <span style="font-size: 12px; font-weight: 500; color: var(--neutral);">${unitCode}</span>
                </div>
              </div>

              <!-- Right: Open Ledger Button -->
              <div style="margin-left: auto;">
                <button class="btn btn-secondary btn-sm" style="font-weight: 600; white-space: nowrap;">
                  Open Records &rarr;
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Click card to open ledger
      document.querySelectorAll('.material-stock-card').forEach((card) => {
        card.onclick = () => {
          const mId = card.getAttribute('data-material-id');
          Router.navigate(`ledger?materialId=${mId}`);
        };
      });
    } catch (err) {
      list.innerHTML = `<div style="color: var(--error); padding: 20px;">Failed to load stock data: ${err.message}</div>`;
    }
  },
};

