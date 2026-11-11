const CalculatorPage = {
  products: [],
  selectedProductId: null,

  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 22px;">Production Material Requirement Calculator</h1>
        <p style="color: var(--neutral); font-size: 13.5px; margin-top: 4px;">Calculate expected raw material and component consumption against current live inventory stock</p>
      </div>

      <div class="card" style="margin-bottom: 24px; padding: 24px;">
        <form id="calc-form" style="display: flex; gap: 20px; align-items: flex-end; flex-wrap: wrap;">
          <div style="flex: 2; min-width: 320px; position: relative;">
            <label class="form-label">Search Finished Product</label>
            <div style="position: relative;">
              <input type="text" id="calc-product-search" class="form-control" autocomplete="off" style="font-weight: 600; padding-right: 30px;" required>
              <span id="calc-product-clear" title="Clear / View All" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--neutral); font-size: 16px; font-weight: bold; line-height: 1; user-select: none;">&times;</span>
            </div>
            <input type="hidden" id="calc-product-id" required>
            <!-- Autocomplete Dropdown List -->
            <div id="calc-product-dropdown" class="card no-scrollbar" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; width: 100%; max-height: 280px; overflow-y: auto; z-index: 100; box-shadow: var(--shadow-lg); padding: 4px 0; border: 1px solid var(--border); background: #FFFFFF;"></div>
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
    const searchInput = document.getElementById('calc-product-search');
    const hiddenId = document.getElementById('calc-product-id');
    const dropdown = document.getElementById('calc-product-dropdown');
    const clearBtn = document.getElementById('calc-product-clear');
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

      // Default select first product or previously selected product
      let chosen = products.find((p) => p.id === this.selectedProductId) || products[0];
      this.selectProduct(chosen);

      // Render Dropdown List
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
            <div class="product-search-item" data-id="${p.id}" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: ${isSelected ? '#F0F4FF' : '#FFFFFF'}; transition: background 0.15s;">
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

        dropdown.querySelectorAll('.product-search-item').forEach((item) => {
          item.onmouseenter = () => {
            if (item.getAttribute('data-id') !== this.selectedProductId) {
              item.style.backgroundColor = '#F8FAFC';
            }
          };
          item.onmouseleave = () => {
            if (item.getAttribute('data-id') !== this.selectedProductId) {
              item.style.backgroundColor = '#FFFFFF';
            }
          };
          item.onclick = (e) => {
            e.stopPropagation();
            const id = item.getAttribute('data-id');
            const found = products.find((p) => p.id === id);
            if (found) {
              this.selectProduct(found);
              dropdown.style.display = 'none';
              this.calculate();
            }
          };
        });

        dropdown.style.display = 'block';
      };

      // Search input events
      searchInput.onfocus = () => renderDropdown(searchInput.value);
      searchInput.oninput = () => renderDropdown(searchInput.value);

      if (clearBtn) {
        clearBtn.onclick = (e) => {
          e.stopPropagation();
          searchInput.value = '';
          searchInput.focus();
          renderDropdown('');
        };
      }

      // Close dropdown on click outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#calc-product-search') && !e.target.closest('#calc-product-dropdown') && !e.target.closest('#calc-product-clear')) {
          dropdown.style.display = 'none';
        }
      });

      // Auto-run first calculation only if form container is still attached
      if (document.getElementById('calc-results-container')) {
        this.calculate();
      }
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  selectProduct(p) {
    if (!p) return;
    this.selectedProductId = p.id;
    const searchInput = document.getElementById('calc-product-search');
    const hiddenId = document.getElementById('calc-product-id');
    const partyName = p.party ? p.party.name : 'Unknown';
    if (searchInput) {
      searchInput.value = `${partyName} — ${p.name}`;
    }
    if (hiddenId) {
      hiddenId.value = p.id;
    }
  },

  async calculate() {
    const hiddenId = document.getElementById('calc-product-id');
    const searchInput = document.getElementById('calc-product-search');
    const qtyInput = document.getElementById('calc-qty-input');
    const container = document.getElementById('calc-results-container');
    if (!hiddenId || !qtyInput || !container) return;

    let productId = hiddenId.value;
    if (!productId && searchInput && searchInput.value.trim()) {
      const q = searchInput.value.trim().toLowerCase();
      const match = this.products.find((p) => {
        const partyName = (p.party ? p.party.name : '').toLowerCase();
        const pName = (p.name || '').toLowerCase();
        return `${partyName} — ${pName}`.toLowerCase() === q || pName === q;
      });
      if (match) {
        this.selectProduct(match);
        productId = match.id;
      }
    }

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

