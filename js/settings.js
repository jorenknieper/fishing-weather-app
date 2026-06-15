(function () {
  'use strict';

  let _wired = false;

  // ---- Header avatar (#235) ----
  function _initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return 'VK';
  }

  function _updateHeaderAvatar(displayName) {
    const avatarEl = document.getElementById('header-avatar');
    const nameEl = document.getElementById('header-display-name');
    if (avatarEl) avatarEl.textContent = displayName ? _initials(displayName) : 'VK';
    if (nameEl) nameEl.textContent = displayName || '';
  }

  // ---- Sub-panel navigation ----
  function _showPanel(name) {
    const panels = ['settings-main', 'settings-profile', 'settings-preferences'];
    panels.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        if (id === 'settings-' + name || (name === 'main' && id === 'settings-main')) {
          el.removeAttribute('hidden');
        } else {
          el.setAttribute('hidden', '');
        }
      }
    });
  }

  // ---- Populate forms ----
  function _populateNotifications() {
    const prefs = window.Prefs.getPrefs();
    const notif = prefs.notifications;
    const push = document.getElementById('notif-push');
    const kmi = document.getElementById('notif-kmi');
    const fishing = document.getElementById('notif-fishing');
    if (push) push.checked = !!notif.push;
    if (kmi) kmi.checked = !!notif.kmi;
    if (fishing) fishing.checked = !!notif.fishing;
  }

  function _populatePreferences() {
    const prefs = window.Prefs.getPrefs();
    const $ = (id) => document.getElementById(id);
    if ($('pref-weight-unit')) $('pref-weight-unit').value = prefs.weightUnit;
    if ($('pref-wind-unit')) $('pref-wind-unit').value = prefs.windUnit;
    if ($('pref-language')) $('pref-language').value = prefs.language;
    if ($('pref-date-format')) $('pref-date-format').value = prefs.dateFormat;
    if ($('pref-theme')) $('pref-theme').value = prefs.theme;
  }

  function _populateProfile() {
    const prefs = window.Prefs.getPrefs();
    const nameEl = document.getElementById('profile-display-name');
    const lakeEl = document.getElementById('profile-home-lake');
    if (nameEl) nameEl.value = prefs.displayName || '';
    if (lakeEl) lakeEl.value = prefs.homeLake || '';
  }

  // ---- Wire preferences (#234) ----
  function _wirePreferences() {
    const $ = (id) => document.getElementById(id);

    $('pref-weight-unit')?.addEventListener('change', (e) => {
      window.Prefs.setPrefs({ weightUnit: e.target.value });
    });
    $('pref-wind-unit')?.addEventListener('change', (e) => {
      window.Prefs.setPrefs({ windUnit: e.target.value });
    });
    $('pref-language')?.addEventListener('change', (e) => {
      window.Prefs.setPrefs({ language: e.target.value });
    });
    $('pref-date-format')?.addEventListener('change', (e) => {
      window.Prefs.setPrefs({ dateFormat: e.target.value });
    });
    $('pref-theme')?.addEventListener('change', (e) => {
      const next = e.target.value;
      const resolved =
        next === 'auto'
          ? window.matchMedia('(prefers-color-scheme: light)').matches
            ? 'light'
            : 'dark'
          : next;
      document.documentElement.setAttribute('data-theme', resolved);
      localStorage.setItem('theme', resolved);
      if (window.updateThemeButton) window.updateThemeButton();
      if (window._themeRerenderCallbacks) {
        for (const cb of window._themeRerenderCallbacks) cb();
      }
      window.Prefs.setPrefs({ theme: next });
    });
  }

  // ---- Wire profile (#219) ----
  function _wireProfile() {
    document.getElementById('profile-display-name')?.addEventListener('input', (e) => {
      const name = e.target.value.trim();
      window.Prefs.setPrefs({ displayName: name });
      _updateHeaderAvatar(name);
    });
    document.getElementById('profile-home-lake')?.addEventListener('input', (e) => {
      window.Prefs.setPrefs({ homeLake: e.target.value.trim() });
    });
  }

  // ---- Wire notification toggles (#221 #237) ----
  function _wireNotifications() {
    ['kmi', 'fishing'].forEach((key) => {
      document.getElementById(`notif-${key}`)?.addEventListener('change', (e) => {
        const prefs = window.Prefs.getPrefs();
        window.Prefs.setPrefs({
          notifications: { ...prefs.notifications, [key]: e.target.checked },
        });
      });
    });
    // Push: disabled (coming soon) — no event wiring needed
  }

  // ---- Load version (#222) ----
  function _loadVersion() {
    const el = document.getElementById('settings-version');
    if (!el) return;
    fetch('./data/build-info.json')
      .then((r) => r.json())
      .then((info) => {
        el.textContent = info.version
          ? `Version ${info.version}`
          : info.commitShaShort
            ? `Build ${info.commitShaShort}`
            : 'VGK Patersveld';
      })
      .catch(() => {
        el.textContent = 'VGK Patersveld';
      });
  }

  // ---- Sub-panel navigation wiring ----
  function _wireNavigation() {
    document.querySelectorAll('[data-subpanel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.subpanel;
        if (panel === 'profile') _populateProfile();
        if (panel === 'preferences') _populatePreferences();
        _showPanel(panel);
      });
    });
    document.querySelectorAll('#page-settings [data-back]').forEach((btn) => {
      btn.addEventListener('click', () => _showPanel('main'));
    });
  }

  // ---- Welcome modal (#235) ----
  function _initWelcomeModal() {
    const overlay = document.getElementById('welcome-overlay');
    if (!overlay) return;

    const prefs = window.Prefs.getPrefs();
    if (prefs.displayName) {
      _updateHeaderAvatar(prefs.displayName);
      return;
    }

    overlay.classList.remove('hidden');
    const input = document.getElementById('welcome-name');
    const submitBtn = document.getElementById('welcome-submit');
    const skipBtn = document.getElementById('welcome-skip');

    let trap;
    if (window.makeFocusTrap) trap = window.makeFocusTrap(overlay.querySelector('.modal'));

    const close = () => {
      if (trap) trap.deactivate();
      if (window.animatedClose) window.animatedClose(overlay);
      else overlay.classList.add('hidden');
    };

    submitBtn?.addEventListener('click', () => {
      const name = input?.value.trim() || '';
      window.Prefs.setPrefs({ displayName: name });
      _updateHeaderAvatar(name);
      close();
    });
    skipBtn?.addEventListener('click', close);

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitBtn?.click();
    });
    setTimeout(() => input?.focus(), 50);
  }

  // ---- Page init ----
  function initSettingsPage() {
    if (_wired) {
      _populateNotifications();
      _populatePreferences();
      return;
    }
    _wired = true;

    _wireNavigation();
    _wirePreferences();
    _wireProfile();
    _wireNotifications();
    _populateNotifications();
    _populatePreferences();
    _loadVersion();
    _showPanel('main');
  }

  // ---- Routing ----
  function _onRoute() {
    if (location.hash === '#settings') initSettingsPage();
  }

  window.addEventListener('hashchange', _onRoute);

  // Header avatar + welcome modal on first load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      _initWelcomeModal();
      const prefs = window.Prefs?.getPrefs();
      if (prefs?.displayName) _updateHeaderAvatar(prefs.displayName);
      _onRoute();
    });
  } else {
    _initWelcomeModal();
    const prefs = window.Prefs?.getPrefs();
    if (prefs?.displayName) _updateHeaderAvatar(prefs.displayName);
    _onRoute();
  }

  // Keep header in sync when prefs change from any source
  window.addEventListener('prefsChanged', (e) => {
    if (e.detail?.displayName !== undefined) _updateHeaderAvatar(e.detail.displayName);
  });

  window.Settings = { initSettingsPage };
})();
