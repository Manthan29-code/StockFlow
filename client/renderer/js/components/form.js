const FormHelper = {
  showConflictPrompt() {
    Modal.confirm({
      title: 'Version Conflict (409)',
      message: 'This record was modified by another user while you were editing it. Would you like to reload the latest data?',
      confirmText: 'Reload Latest Data',
      onConfirm: () => {
        Router.refreshCurrentPage();
      },
    });
  },

  displayFieldErrors(formElement, details = {}) {
    // Clear existing field errors
    formElement.querySelectorAll('.form-error').forEach((el) => el.remove());

    for (const [field, errors] of Object.entries(details)) {
      const input = formElement.querySelector(`[name="${field}"]`);
      if (input) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        errorDiv.textContent = Array.isArray(errors) ? errors[0] : errors;
        input.parentNode.appendChild(errorDiv);
      }
    }
  },
};

