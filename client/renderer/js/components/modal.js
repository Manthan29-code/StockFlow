const Modal = {
  open({ title, bodyHtml, confirmText = 'Save', cancelText = 'Cancel', onConfirm, onCancel, width = '500px' }) {
    const container = document.getElementById('modal-container');
    if (!container) return;

    container.innerHTML = `
      <div class="modal-overlay" id="active-modal-overlay">
        <div class="modal-card" style="max-width: ${width};">
          <div class="modal-header">
            <h3 class="card-title">${title}</h3>
            <button class="btn btn-secondary btn-sm" id="modal-close-btn">&times;</button>
          </div>
          <div class="modal-body" id="modal-body-content">
            ${bodyHtml}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="modal-cancel-btn">${cancelText}</button>
            <button class="btn btn-primary" id="modal-confirm-btn">${confirmText}</button>
          </div>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    const close = () => {
      container.innerHTML = '';
      if (onCancel) onCancel();
    };

    closeBtn.onclick = close;
    cancelBtn.onclick = close;

    confirmBtn.onclick = async () => {
      if (onConfirm) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';
        try {
          const shouldClose = await onConfirm();
          if (shouldClose !== false) {
            container.innerHTML = '';
          }
        } catch (err) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = confirmText;
          Toast.show(err.message || 'Operation failed', 'error');
        }
      } else {
        container.innerHTML = '';
      }
    };
  },

  confirm({ title = 'Confirm Action', message, confirmText = 'Confirm', onConfirm }) {
    this.open({
      title,
      bodyHtml: `<p style="font-size: 14px; color: var(--text-secondary);">${message}</p>`,
      confirmText,
      onConfirm,
    });
  },

  close() {
    const container = document.getElementById('modal-container');
    if (container) {
      container.innerHTML = '';
    }
  },
};

