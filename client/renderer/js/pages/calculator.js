const CalculatorPage = {
  products: [],

  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px;">Production Material Requirement Calculator</h1>
        <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Calculate expected raw material and component consumption against current live inventory stock</p>
      </div>

      <div class="card" style="margin-bottom: 24px; padding: 24px;">
        <form id="calc-form" style="display: flex; gap: 20px; align-items: flex-end; flex-wrap: wrap;">
          <div style="flex: 2; min-width: 300px;">
            <label class="form-label">Finished Product</label>
            <select id="calc-product-select" class="form-control" style="font-weight: 600;" required></select>
          </div>
          <div style="flex: 1; min-width: 160px;">
            <label class="form-label">Planned Production Quantity</label>
            <input type="number" id="calc-qty-input" class="form-control" value="100" min="1" step="any" required>
          </div>
          <div>
            <button type="submit" class="btn btn-primary" style="height: 38px;">Calculate Requirements</button>
          </div>
        </form>
      </div>

      <!-- Results Container -->
      <div id="calc-results-container"></div>
    `;

    const form = document.getElementById('calc-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        this.calculate();
      };
    }

    await this.initProducts();
  },

  async initProducts() {
    try {
      const products = await Api.get('/api/products');
      this.products = products;

      const select = document.getElementById('calc-product-select');
      if (!select) return;

      if (products.length === 0) {
        select.innerHTML = '<option value="">No products available</option>';
        return;
      }

      select.innerHTML = products.map((p) => {
        const partyName = p.party ? p.party.name : 'Unknown';
        return `<option value="${p.id}">${partyName} — ${p.name}</option>`;
      }).join('');

      // Auto-run first calculation only if form container is still attached
      if (document.getElementById('calc-results-container')) {
        this.calculate();
      }
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  async calculate() {
    const select = document.getElementById('calc-product-select');
    const qtyInput = document.getElementById('calc-qty-input');
    const container = document.getElementById('calc-results-container');
    if (!select || !qtyInput || !container) return;

    const productId = select.value;
    const qty = qtyInput.value;

    if (!productId || !qty || Number(qty) <= 0) return;

    container.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--neutral);">Calculating...</div>';

    try {
      const result = await Api.get(`/api/products/${productId}/requirement`, { qty });
      const reqs = result.requirements || [];

      if (reqs.length === 0) {
        container.innerHTML = `
          <div class="card" style="text-align: center; padding: 40px; color: var(--neutral);">
            This product has no BOM lines defined. <a href="#bom-editor?productId=${productId}">Define BOM lines &rarr;</a>
          </div>
        `;
        return;
      }

      const hasShortfall = reqs.some((r) => r.isShort);

      container.innerHTML = `
        <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 16px; color: var(--secondary);">
            Requirements for <strong>${Format.number(qty)} units</strong> of <em>${result.productName}</em>
          </h3>
          <span class="chip ${hasShortfall ? 'chip-error' : 'chip-success'}" style="font-size: 13px; padding: 4px 12px;">
            ${hasShortfall ? 'Insufficient Stock (Shortfall Detected)' : 'Stock Available (All Clear)'}
          </span>
        </div>

        <div class="card" style="padding: 0; overflow: hidden;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Required Material</th>
                <th>Consumption / Unit</th>
                <th class="num-cell">Total Required</th>
                <th class="num-cell">Live Available Stock</th>
                <th class="num-cell">Shortfall</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${reqs.map((r) => {
                const mat = r.material || {};
                const unitCode = mat.unit ? mat.unit.code : '';
                return `
                  <tr style="${r.isShort ? 'background-color: #FFF5F5;' : ''}">
                    <td>
                      <div style="font-weight: 600; color: var(--secondary);">${mat.name || 'Unknown'}</div>
                      ${r.specValue ? `<div style="font-size: 11.5px; color: var(--neutral);">${mat.specLabel || 'Spec'}: ${r.specValue}</div>` : ''}
                    </td>
                    <td>${Format.number(r.consumption)} ${unitCode}</td>
                    <td class="num-cell" style="font-weight: 700; font-family: var(--font-mono); font-size: 14px;">
                      ${Format.number(r.required)} ${unitCode}
                    </td>
                    <td class="num-cell" style="font-family: var(--font-mono); color: var(--secondary);">
                      ${Format.number(r.availableStock)} ${unitCode}
                    </td>
                    <td class="num-cell" style="font-weight: 700; font-family: var(--font-mono); color: ${r.isShort ? 'var(--error)' : 'var(--neutral)'};">
                      ${r.isShort ? `${Format.number(r.shortfall)} ${unitCode}` : '0'}
                    </td>
                    <td style="text-align: center;">
                      <span class="chip ${r.isShort ? 'chip-error' : 'chip-success'}">
                        ${r.isShort ? 'Shortfall' : 'Sufficient'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color: var(--error); padding: 20px;">Failed to calculate: ${err.message}</div>`;
    }
  },
};

