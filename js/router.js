(function () {
  const ROUTES = ['dashboard', 'forecast', 'moon', 'catches', 'analytics', 'alerts', 'settings', 'privacy', 'terms'];
  const DEFAULT_ROUTE = 'dashboard';

  function currentRoute() {
    const hash = location.hash.replace(/^#/, '').trim();
    return ROUTES.indexOf(hash) !== -1 ? hash : DEFAULT_ROUTE;
  }

  function showPage(route) {
    document.querySelectorAll('section[id^="page-"]').forEach(function (section) {
      if (section.id === 'page-' + route) {
        section.removeAttribute('hidden');
      } else {
        section.setAttribute('hidden', '');
      }
    });
  }

  function setActiveNav(route) {
    document.querySelectorAll('[data-route]').forEach(function (item) {
      const isActive = item.dataset.route === route;
      item.classList.toggle('is-active', isActive);
      if (isActive) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });
  }

  function handleRoute() {
    const route = currentRoute();
    showPage(route);
    setActiveNav(route);
    if (!location.hash || ROUTES.indexOf(location.hash.replace(/^#/, '')) === -1) {
      history.replaceState(null, '', '#' + DEFAULT_ROUTE);
    }
  }

  window.addEventListener('hashchange', handleRoute);
  window.setActiveNav = setActiveNav;
  window.Router = { currentRoute: currentRoute, setActiveNav: setActiveNav };

  handleRoute();
})();
