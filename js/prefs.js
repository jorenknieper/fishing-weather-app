(function () {
  const LS_KEY = 'prefs';
  const DEFAULTS = {
    weightUnit: 'kg',
    windUnit: 'km/h',
    theme: 'auto',
    locationName: 'Aalter',
    displayName: '',
    homeLake: '',
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    notifications: { push: true, kmi: true, fishing: true },
  };

  function _read() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function _save(obj) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    } catch {
      // quota exceeded — silently ignore
    }
  }

  function getPrefs() {
    const stored = _read();
    return {
      ...DEFAULTS,
      ...stored,
      notifications: { ...DEFAULTS.notifications, ...(stored.notifications || {}) },
    };
  }

  function setPrefs(partial) {
    const merged = { ...getPrefs(), ...partial };
    _save(merged);
    window.dispatchEvent(new CustomEvent('prefsChanged', { detail: merged }));
    return merged;
  }

  function resetPrefs() {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('prefsChanged', { detail: { ...DEFAULTS } }));
  }

  window.Prefs = { getPrefs, setPrefs, resetPrefs, DEFAULTS };
})();
