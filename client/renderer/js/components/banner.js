const Banner = {
  show(message, type = 'error') {
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

