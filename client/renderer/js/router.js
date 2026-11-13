const Router = {
  routes: {
    login: { page: LoginPage, title: 'Login', auth: false },
    dashboard: { page: DashboardPage, title: 'Dashboard', auth: true },
    ledger: { page: LedgerPage, title: 'Report', auth: true },
    inward: { page: InwardPage, title: 'Inward ', auth: true },
    calculator: { page: CalculatorPage, title: 'Dispatch & Calculator', auth: true },
    materials: { page: MaterialsPage, title: 'Materials & Units', auth: true, admin: true },
    'parties-products': { page: PartiesProductsPage, title: 'Parties & Products', auth: true, admin: true },
    'bom-editor': { page: BomEditorPage, title: 'BOM Editor', auth: true, admin: true },
    export: { page: ExportPage, title: 'Excel Export', auth: true },
    import: { page: ImportWizardPage, title: 'Excel Import Wizard', auth: true, admin: true },
    users: { page: UsersPage, title: 'Users & Permissions', auth: true, admin: true },
    audit: { page: AuditPage, title: 'Security Audit Log', auth: true, admin: true },
    settings: { page: SettingsPage, title: 'Backup & Settings', auth: true, admin: true },
  },

  currentRoute: null,
  currentParams: {},

  init() {
    window.addEventListener('hashchange', () => this.handleHashChange());
    this.handleHashChange();
  },

  parseHash() {
    const raw = window.location.hash.replace(/^#/, '').trim() || 'dashboard';
    const [path, queryString] = raw.split('?');
    const params = {};
    if (queryString) {
      new URLSearchParams(queryString).forEach((val, key) => {
        params[key] = val;
      });
    }
    return { path, params };
  },

  navigate(pathWithQuery) {
    window.location.hash = pathWithQuery;
  },

  handleHashChange() {
    const { path, params } = this.parseHash();
    const route = this.routes[path] || this.routes.dashboard;

    // Check auth
    if (route.auth && !State.currentUser) {
      this.navigate('login');
      return;
    }

    // Check admin
    if (route.admin && !State.isAdmin()) {
      Toast.show('Access restricted to administrators', 'error');
      this.navigate('dashboard');
      return;
    }

    // Toggle sidebar & header visibility
    const sidebar = document.getElementById('sidebar');
    const header = document.getElementById('header');
    if (path === 'login') {
      sidebar.style.display = 'none';
      header.style.display = 'none';
    } else {
      sidebar.style.display = 'flex';
      header.style.display = 'flex';
    }

    // Update active nav class
    document.querySelectorAll('.nav-item').forEach((item) => {
      const targetRoute = item.getAttribute('data-route');
      if (targetRoute === path) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    document.getElementById('current-page-title').textContent = route.title;
    this.currentRoute = path;
    this.currentParams = params;

    const contentContainer = document.getElementById('content');
    route.page.render(contentContainer, params);
  },

  refreshCurrentPage() {
    if (this.currentRoute && this.routes[this.currentRoute]) {
      const contentContainer = document.getElementById('content');
      this.routes[this.currentRoute].page.render(contentContainer, this.currentParams);
    }
  },
};

