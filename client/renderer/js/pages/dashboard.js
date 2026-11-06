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

      <div id="materials-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--neutral);">Loading inventory stock...</div>
      </div>
    `;

    document.getElementById('dashboard-refresh-btn').onclick = () => this.loadData();
    await this.loadData();
  },

  async loadData() {
    const grid = document.getElementById('materials-grid');
    if (!grid) return;

    try {
      const summaries = await Api.get('/api/stock');
      if (summaries.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
            <h3 style="color: var(--neutral); margin-bottom: 8px;">No Materials Created Yet</h3>
            <p style="color: var(--neutral-light); font-size: 13.5px; margin-bottom: 16px;">Create raw materials or components to begin tracking incoming challans and dispatch ledgers.</p>
            ${State.isAdmin() ? '<a href="#materials" class="btn btn-primary btn-sm">Add First Material</a>' : ''}
          </div>
        `;
        return;
      }

      grid.innerHTML = summaries.map((item) => {
        const mat = item.material;
        const unitCode = mat.unit ? mat.unit.code : '';
        const modeLabel = mat.deductBy === 'qty_x_piece_weight' ? 'Measured / Weight' : 'Counted / Pieces';

        return `
          <div class="card material-stock-card" data-material-id="${mat.id}" style="cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <div>
                <h3 style="font-size: 16px; margin-bottom: 4px; color: var(--secondary);">${mat.name}</h3>
                <span class="chip chip-neutral" style="font-size: 11px;">${modeLabel}</span>
                ${mat.specLabel ? `<span class="chip chip-neutral" style="font-size: 11px;">Spec: ${mat.specLabel}</span>` : ''}
              </div>
              <span class="chip ${item.openEntriesCount > 0 ? 'chip-warning' : 'chip-success'}">
                ${item.openEntriesCount} Open Entries
              </span>
            </div>

            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: baseline;">
              <div>
                <span style="font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--neutral); font-weight: 600;">Total Stock Balance</span>
                <div style="font-size: 24px; font-weight: 700; color: var(--secondary); font-family: var(--font-mono); margin-top: 4px;">
                  ${Format.number(item.totalStock)} <span style="font-size: 14px; font-weight: 500; color: var(--neutral);">${unitCode}</span>
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" style="align-self: flex-end;">Open Ledger &rarr;</button>
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
      grid.innerHTML = `<div style="grid-column: 1/-1; color: var(--error); padding: 20px;">Failed to load stock data: ${err.message}</div>`;
    }
  },
};

