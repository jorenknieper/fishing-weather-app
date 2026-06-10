(function () {
  const LS_KEY = 'catches';

  function _genId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function _read() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function _write(arr) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      if (e && e.name === 'QuotaExceededError') return false;
      return false;
    }
  }

  function getAllCatches() {
    return _read().slice().sort((a, b) => {
      const ta = a.caughtAt ? new Date(a.caughtAt).getTime() : 0;
      const tb = b.caughtAt ? new Date(b.caughtAt).getTime() : 0;
      return tb - ta;
    });
  }

  function getCatchById(id) {
    return _read().find((c) => c.id === id) || null;
  }

  function saveCatch(obj) {
    const arr = _read();
    const now = new Date().toISOString();
    if (obj.id) {
      const idx = arr.findIndex((c) => c.id === obj.id);
      const updated = { ...obj, updatedAt: now };
      if (idx !== -1) {
        arr[idx] = updated;
      } else {
        arr.unshift({ ...updated, createdAt: now });
      }
      _write(arr);
      return updated;
    } else {
      const newCatch = { ...obj, id: _genId(), createdAt: now, updatedAt: now };
      arr.unshift(newCatch);
      _write(arr);
      return newCatch;
    }
  }

  function deleteCatch(id) {
    const arr = _read().filter((c) => c.id !== id);
    _write(arr);
  }

  function exportCatches() {
    return JSON.stringify(getAllCatches(), null, 2);
  }

  function importCatches(json) {
    let incoming;
    try {
      incoming = typeof json === 'string' ? JSON.parse(json) : json;
    } catch {
      return { added: 0, skipped: 0 };
    }
    if (!Array.isArray(incoming)) return { added: 0, skipped: 0 };

    const arr = _read();
    const existingIds = new Set(arr.map((c) => c.id));
    let added = 0;
    let skipped = 0;

    for (const item of incoming) {
      if (!item || typeof item !== 'object') { skipped++; continue; }
      if (item.id && existingIds.has(item.id)) { skipped++; continue; }
      const id = item.id || _genId();
      arr.push({ ...item, id });
      existingIds.add(id);
      added++;
    }

    _write(arr);
    return { added, skipped };
  }

  window.CatchesStore = {
    getAllCatches,
    getCatchById,
    saveCatch,
    deleteCatch,
    exportCatches,
    importCatches,
  };
})();
