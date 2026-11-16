const Banner = {
  show(message, type = 'error') {
    // Do not show connection warning banner on login page or when no user is logged in
    if (!State.currentUser || (typeof Router !== 'undefined' && Router.currentRoute === 'login')) {
      return;
    }

    const container = document.getElementById('banner-container');
    if (!container) return;

    container.innerHTML = `
      <div class="banner banner-${type}">
        <span>${message}</span>
      </div>
    `;
  },

  clear() {
    const container = document.getElementById('banner-container');
    if (container) {
      container.innerHTML = '';
    }
  },
};

