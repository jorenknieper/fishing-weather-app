(function () {
  // ---- constants ----
  const SPECIES_LIST = ['Mirror Carp','Common Carp','Grass Carp','Tench','Pike','Bream','Crucian Carp','Perch'];
  const RIG_LIST = ['Blowback Rig','KD Rig','Ronnie Rig','PVA Bag Rig','Chod Rig','Hair Rig','Helicopter Rig'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ---- state ----
  let _filters = { species: [], dateFrom: '', dateTo: '', bait: '', rigs: [], sort: 'date-desc' };
  let _detailId = null;  // id currently open in detail overlay
  // focus traps (initialised once in initCatchesPage)
  let _formTrap = null;
  let _detailTrap = null;
  let _filterTrap = null;

  // ---- helpers ----

  // Format date from ISO string → "15 Apr 2026 · 14:30"
  function _fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2,'0');
    const mon = MONTHS[d.getMonth()];
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${day} ${mon} ${d.getFullYear()} · ${hh}:${mm}`;
  }

  // Current hour index in hourlyData using Brussels-time pattern
  function _nowHourlyIdx() {
    const h = window.hourlyData;
    if (!h || !h.time) return -1;
    const nowISO = new Date().toLocaleString('sv', { timeZone: 'Europe/Brussels' }).slice(0,16).replace(' ','T');
    let idx = 0;
    for (let i = 0; i < h.time.length; i++) {
      if (h.time[i] <= nowISO) idx = i; else break;
    }
    return idx;
  }

  // Placeholder fish SVG thumbnail
  function _placeholderThumb() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="28" height="28" aria-hidden="true"><path d="M6 12C6 7 10 4 16 4C16 4 20 8 20 12C20 16 16 20 16 20C10 20 6 17 6 12Z"/><path d="M16 4L22 8L22 16L16 20"/><circle cx="18" cy="12" r="1" fill="currentColor"/></svg>`;
  }

  // ---- rendering ----

  // #193 — catch card HTML
  function renderCatchCard(c) {
    const thumb = c.photoDataUrl
      ? `<img src="${c.photoDataUrl}" alt="${c.species}" loading="lazy">`
      : _placeholderThumb();
    const weight = c.weightKg != null ? `${c.weightKg} kg` : '—';
    const length = c.lengthCm != null ? `${c.lengthCm} cm` : '—';
    const wind = (c.windDir && c.windSpeedKmh != null) ? `${c.windDir} ${c.windSpeedKmh} km/h` : '';
    const pressure = c.pressureHPa != null ? `${c.pressureHPa} hPa` : '';
    const weatherRow = [wind, pressure].filter(Boolean).join(' · ');
    const gear = [c.bait, c.rig].filter(Boolean).join(' · ');

    return `<article class="catch-card" data-id="${c.id}" role="button" tabindex="0" aria-label="${c.species}, ${weight}">
  <div class="catch-card__thumb">${thumb}</div>
  <div class="catch-card__body">
    <div class="catch-card__species">${c.species || '—'}</div>
    <div class="catch-card__date">${_fmtDate(c.caughtAt)}</div>
    <div class="catch-card__measure">${weight} · ${length}</div>
    ${weatherRow ? `<div class="catch-card__weather">${weatherRow}</div>` : ''}
    ${gear ? `<div class="catch-card__gear">${gear}</div>` : ''}
  </div>
  <div class="catch-card__menu">
    <button class="catch-card__menu-btn" type="button" aria-label="More options" aria-haspopup="menu">⋯</button>
    <div class="catch-card__menu-list" hidden role="menu">
      <button data-action="edit" role="menuitem">Edit</button>
      <button data-action="delete" role="menuitem">Delete</button>
    </div>
  </div>
</article>`;
  }

  function _renderList() {
    const listEl = document.getElementById('catch-list');
    if (!listEl) return;
    let catches = window.CatchesStore.getAllCatches();
    catches = _applyFilters(catches);
    if (!catches.length) {
      listEl.innerHTML = `<div class="catch-empty">No catches logged yet. Tap "+ Add Catch" to log your first catch.</div>`;
      return;
    }
    listEl.innerHTML = catches.map(renderCatchCard).join('');
    _wireCardEvents(listEl);
  }

  function _wireCardEvents(listEl) {
    // Card click → detail
    listEl.querySelectorAll('.catch-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.catch-card__menu')) return;
        _openDetail(card.dataset.id);
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _openDetail(card.dataset.id); }
      });
      // Three-dot menu
      const menuBtn = card.querySelector('.catch-card__menu-btn');
      const menuList = card.querySelector('.catch-card__menu-list');
      menuBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = !menuList.hidden;
        // close all other open menus
        document.querySelectorAll('.catch-card__menu-list').forEach(m => { m.hidden = true; });
        menuList.hidden = isOpen;
      });
      menuList.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          menuList.hidden = true;
          if (btn.dataset.action === 'edit') _openForm(window.CatchesStore.getCatchById(card.dataset.id));
          if (btn.dataset.action === 'delete') _confirmDelete(card.dataset.id);
        });
      });
    });
    // Close menus on outside click
    document.addEventListener('click', () => {
      document.querySelectorAll('.catch-card__menu-list').forEach(m => { m.hidden = true; });
    }, { capture: true, once: false });
  }

  function _renderChips() {
    const el = document.getElementById('catch-active-chips');
    if (!el) return;
    const chips = [];
    _filters.species.forEach(s => chips.push({ key: 'species', val: s, label: s }));
    _filters.rigs.forEach(r => chips.push({ key: 'rigs', val: r, label: r }));
    if (_filters.dateFrom) chips.push({ key: 'dateFrom', val: '', label: `From ${_filters.dateFrom}` });
    if (_filters.dateTo) chips.push({ key: 'dateTo', val: '', label: `To ${_filters.dateTo}` });
    if (_filters.bait) chips.push({ key: 'bait', val: '', label: `Bait: ${_filters.bait}` });
    el.innerHTML = chips.map(c =>
      `<span class="catch-chip">${c.label}<button class="catch-chip__remove" data-chip-key="${c.key}" data-chip-val="${c.val}" aria-label="Remove filter" type="button">×</button></span>`
    ).join('');
    el.querySelectorAll('.catch-chip__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.chipKey;
        const val = btn.dataset.chipVal;
        if (key === 'species') _filters.species = _filters.species.filter(s => s !== val);
        else if (key === 'rigs') _filters.rigs = _filters.rigs.filter(r => r !== val);
        else _filters[key] = '';
        _renderChips();
        _renderList();
      });
    });
  }

  // ---- filter / sort ----

  function _applyFilters(catches) {
    let result = catches.slice();
    if (_filters.species.length) result = result.filter(c => _filters.species.includes(c.species));
    if (_filters.dateFrom) result = result.filter(c => c.caughtAt && c.caughtAt >= _filters.dateFrom);
    if (_filters.dateTo) result = result.filter(c => c.caughtAt && c.caughtAt.slice(0,10) <= _filters.dateTo);
    if (_filters.bait) result = result.filter(c => c.bait && c.bait.toLowerCase().includes(_filters.bait.toLowerCase()));
    if (_filters.rigs.length) result = result.filter(c => _filters.rigs.includes(c.rig));
    if (_filters.sort === 'date-asc') result.sort((a,b) => (a.caughtAt||'') < (b.caughtAt||'') ? -1 : 1);
    else if (_filters.sort === 'weight-desc') result.sort((a,b) => (b.weightKg||0) - (a.weightKg||0));
    // default: date-desc already from getAllCatches
    return result;
  }

  // ---- add/edit form (#196 #198 #199 #233) ----

  function _openForm(catchObj) {
    const overlay = document.getElementById('catch-form-overlay');
    const titleEl = document.getElementById('catch-form-title');
    if (!overlay) return;

    // Reset form
    const form = document.getElementById('catch-form');
    form.reset();
    document.getElementById('cf-photo-url').value = '';
    document.getElementById('catch-photo-preview').hidden = true;
    document.getElementById('catch-photo-preview').src = '';

    if (catchObj) {
      // Edit mode — pre-fill
      titleEl.textContent = 'Edit Catch';
      document.getElementById('cf-editing-id').value = catchObj.id;
      document.getElementById('cf-species').value = catchObj.species || '';
      document.getElementById('cf-weight').value = catchObj.weightKg != null ? catchObj.weightKg : '';
      document.getElementById('cf-length').value = catchObj.lengthCm != null ? catchObj.lengthCm : '';
      const dt = catchObj.caughtAt ? new Date(catchObj.caughtAt) : null;
      if (dt) {
        document.getElementById('cf-date').value = dt.toLocaleDateString('sv', { timeZone: 'Europe/Brussels' }).slice(0,10);
        document.getElementById('cf-time').value = dt.toLocaleTimeString('nl-BE', { hour:'2-digit', minute:'2-digit', hour12: false, timeZone: 'Europe/Brussels' });
      }
      document.getElementById('cf-bait').value = catchObj.bait || '';
      document.getElementById('cf-rig').value = catchObj.rig || '';
      document.getElementById('cf-notes').value = catchObj.notes || '';
      // Photo
      if (catchObj.photoDataUrl) {
        document.getElementById('cf-photo-url').value = catchObj.photoDataUrl;
        const prev = document.getElementById('catch-photo-preview');
        prev.src = catchObj.photoDataUrl;
        prev.hidden = false;
      }
      // Weather (restore stored snapshot, don't re-fetch)
      _setWeatherDisplay(catchObj.windSpeedKmh, catchObj.windDir, catchObj.pressureHPa, catchObj.temperatureC, catchObj.precipMm, catchObj.moonPhase);
      document.getElementById('cf-wind-speed').value = catchObj.windSpeedKmh != null ? catchObj.windSpeedKmh : '';
      document.getElementById('cf-wind-dir').value = catchObj.windDir || '';
      document.getElementById('cf-pressure-val').value = catchObj.pressureHPa != null ? catchObj.pressureHPa : '';
      document.getElementById('cf-temp-val').value = catchObj.temperatureC != null ? catchObj.temperatureC : '';
      document.getElementById('cf-precip-val').value = catchObj.precipMm != null ? catchObj.precipMm : '';
      document.getElementById('cf-moon-phase').value = catchObj.moonPhase || '';
      // Advanced
      document.getElementById('cf-hook-size').value = catchObj.hookSize != null ? catchObj.hookSize : '';
      document.getElementById('cf-hook-pattern').value = catchObj.hookPattern || '';
      document.getElementById('cf-mainline').value = catchObj.mainlineStrengthKg != null ? catchObj.mainlineStrengthKg : '';
      document.getElementById('cf-leader').value = catchObj.leaderStrengthKg != null ? catchObj.leaderStrengthKg : '';
      document.getElementById('cf-leader-material').value = catchObj.leaderMaterial || '';
      document.getElementById('cf-water-temp').value = catchObj.waterTempC != null ? catchObj.waterTempC : '';
      document.getElementById('cf-depth').value = catchObj.depthM != null ? catchObj.depthM : '';
      document.getElementById('cf-clarity').value = catchObj.waterClarity || '';
      document.getElementById('cf-venue').value = catchObj.venueName || '';
      document.getElementById('cf-swim').value = catchObj.swimDescription || '';
    } else {
      // Add mode — defaults
      titleEl.textContent = 'Add Catch';
      document.getElementById('cf-editing-id').value = '';
      const now = new Date();
      document.getElementById('cf-date').value = now.toLocaleDateString('sv', { timeZone: 'Europe/Brussels' }).slice(0,10);
      document.getElementById('cf-time').value = now.toLocaleTimeString('nl-BE', { hour:'2-digit', minute:'2-digit', hour12: false, timeZone: 'Europe/Brussels' });
      // #199 — auto-populate weather from current conditions
      _populateWeather();
    }

    overlay.classList.remove('hidden');
    if (_formTrap) _formTrap.activate();
  }

  function _setWeatherDisplay(windSpd, windDir, pressure, temp, precip, moonPhase) {
    const windStr = (windDir && windSpd != null) ? `${windDir} ${windSpd} km/h` : '—';
    const pressureStr = pressure != null ? `${pressure} hPa` : '—';
    const tempStr = temp != null ? `${temp}°C` : '—';
    const precipStr = precip != null ? `${precip} mm` : '—';
    const moonStr = moonPhase || '—';
    const el = id => document.getElementById(id);
    if (el('cf-wind')) el('cf-wind').textContent = windStr;
    if (el('cf-pressure')) el('cf-pressure').textContent = pressureStr;
    if (el('cf-temp')) el('cf-temp').textContent = tempStr;
    if (el('cf-precip')) el('cf-precip').textContent = precipStr;
    if (el('cf-moon')) el('cf-moon').textContent = moonStr;
  }

  // #199 — populate weather snapshot from current hourlyData + Moon
  function _populateWeather() {
    const idx = _nowHourlyIdx();
    const h = window.hourlyData;
    let windSpd = null, windDir = null, pressure = null, temp = null, precip = null;
    if (h && idx >= 0) {
      windSpd = h.wind_speed_10m ? Math.round(h.wind_speed_10m[idx]) : null;
      const deg = h.wind_direction_10m ? h.wind_direction_10m[idx] : null;
      windDir = deg != null ? _degToAbbr(deg) : null;
      pressure = h.pressure_msl ? Math.round(h.pressure_msl[idx]) : null;
      temp = h.temperature_2m ? Math.round(h.temperature_2m[idx] * 10) / 10 : null;
      precip = h.precipitation ? h.precipitation[idx] : null;
    }
    const moonPhase = (window.Moon ? window.Moon.getMoonPhase(new Date()).phaseName : null) || null;

    _setWeatherDisplay(windSpd, windDir, pressure, temp, precip, moonPhase);
    const el = id => document.getElementById(id);
    if (el('cf-wind-speed')) el('cf-wind-speed').value = windSpd != null ? windSpd : '';
    if (el('cf-wind-dir')) el('cf-wind-dir').value = windDir || '';
    if (el('cf-pressure-val')) el('cf-pressure-val').value = pressure != null ? pressure : '';
    if (el('cf-temp-val')) el('cf-temp-val').value = temp != null ? temp : '';
    if (el('cf-precip-val')) el('cf-precip-val').value = precip != null ? precip : '';
    if (el('cf-moon-phase')) el('cf-moon-phase').value = moonPhase || '';
  }

  function _degToAbbr(deg) {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
  }

  function _closeForm() {
    const overlay = document.getElementById('catch-form-overlay');
    if (!overlay) return;
    if (_formTrap) _formTrap.deactivate();
    animatedClose(overlay);
  }

  // #233 — photo handling
  function _handlePhoto(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const sizeKB = Math.round(dataUrl.length * 0.75 / 1024);
        if (sizeKB > 200) {
          alert(`Photo is ${sizeKB} KB — storage may fill up quickly. Consider a smaller image.`);
        }
        document.getElementById('cf-photo-url').value = dataUrl;
        const prev = document.getElementById('catch-photo-preview');
        prev.src = dataUrl; prev.hidden = false;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // form submit → saveCatch
  function _onSave(e) {
    e.preventDefault();
    const el = id => document.getElementById(id);
    const editingId = el('cf-editing-id').value.trim();
    const dateStr = el('cf-date').value;
    const timeStr = el('cf-time').value || '00:00';
    const caughtAt = dateStr ? new Date(`${dateStr}T${timeStr}`).toISOString() : new Date().toISOString();

    const obj = {
      id: editingId || undefined,
      species: el('cf-species').value.trim(),
      weightKg: el('cf-weight').value !== '' ? parseFloat(el('cf-weight').value) : null,
      lengthCm: el('cf-length').value !== '' ? parseFloat(el('cf-length').value) : null,
      caughtAt,
      bait: el('cf-bait').value.trim(),
      rig: el('cf-rig').value.trim(),
      notes: el('cf-notes').value.trim(),
      photoDataUrl: el('cf-photo-url').value || null,
      windSpeedKmh: el('cf-wind-speed').value !== '' ? parseFloat(el('cf-wind-speed').value) : null,
      windDir: el('cf-wind-dir').value || null,
      pressureHPa: el('cf-pressure-val').value !== '' ? parseFloat(el('cf-pressure-val').value) : null,
      temperatureC: el('cf-temp-val').value !== '' ? parseFloat(el('cf-temp-val').value) : null,
      precipMm: el('cf-precip-val').value !== '' ? parseFloat(el('cf-precip-val').value) : null,
      moonPhase: el('cf-moon-phase').value || null,
      hookSize: el('cf-hook-size').value !== '' ? parseFloat(el('cf-hook-size').value) : null,
      hookPattern: el('cf-hook-pattern').value.trim() || null,
      mainlineStrengthKg: el('cf-mainline').value !== '' ? parseFloat(el('cf-mainline').value) : null,
      leaderStrengthKg: el('cf-leader').value !== '' ? parseFloat(el('cf-leader').value) : null,
      leaderMaterial: el('cf-leader-material').value.trim() || null,
      waterTempC: el('cf-water-temp').value !== '' ? parseFloat(el('cf-water-temp').value) : null,
      depthM: el('cf-depth').value !== '' ? parseFloat(el('cf-depth').value) : null,
      waterClarity: el('cf-clarity').value || null,
      venueName: el('cf-venue').value.trim() || null,
      swimDescription: el('cf-swim').value.trim() || null,
    };
    if (!obj.id) delete obj.id;

    const saved = window.CatchesStore.saveCatch(obj);
    if (!saved) {
      alert('Storage is full. Please delete some catches or photos to free space.');
      return;
    }
    _closeForm();
    _renderList();
  }

  // ---- detail overlay (#204) ----

  function _openDetail(id) {
    const c = window.CatchesStore.getCatchById(id);
    if (!c) return;
    _detailId = id;
    const body = document.getElementById('catch-detail-body');
    if (!body) return;

    const photoHtml = c.photoDataUrl
      ? `<img class="catch-detail__photo" src="${c.photoDataUrl}" alt="${c.species}">`
      : '';

    const row = (label, value) =>
      `<div class="catch-detail__row"><span class="catch-detail__field-label">${label}</span><span class="catch-detail__field-value">${value != null && value !== '' ? value : '—'}</span></div>`;

    const advancedFields = [
      c.hookSize != null && row('Hook size', c.hookSize),
      c.hookPattern && row('Hook pattern', c.hookPattern),
      c.mainlineStrengthKg != null && row('Mainline', `${c.mainlineStrengthKg} kg`),
      c.leaderStrengthKg != null && row('Leader', `${c.leaderStrengthKg} kg${c.leaderMaterial ? ' ' + c.leaderMaterial : ''}`),
      c.waterTempC != null && row('Water temp', `${c.waterTempC}°C`),
      c.depthM != null && row('Depth', `${c.depthM} m`),
      c.waterClarity && row('Clarity', c.waterClarity),
      c.venueName && row('Venue', c.venueName),
      c.swimDescription && row('Swim', c.swimDescription),
    ].filter(Boolean).join('');

    body.innerHTML =
      photoHtml +
      `<div class="catch-detail__species">${c.species || '—'}</div>` +
      `<div class="catch-detail__measure">${c.weightKg != null ? c.weightKg + ' kg' : '—'} · ${c.lengthCm != null ? c.lengthCm + ' cm' : '—'}</div>` +
      `<div class="catch-detail__section">` +
        `<div class="catch-detail__section-title">Details</div>` +
        row('Date', _fmtDate(c.caughtAt)) +
        row('Bait', c.bait) +
        row('Rig', c.rig) +
        row('Notes', c.notes) +
      `</div>` +
      `<div class="catch-detail__section">` +
        `<div class="catch-detail__section-title">Conditions</div>` +
        row('Wind', c.windDir && c.windSpeedKmh != null ? `${c.windDir} ${c.windSpeedKmh} km/h` : null) +
        row('Pressure', c.pressureHPa != null ? `${c.pressureHPa} hPa` : null) +
        row('Temperature', c.temperatureC != null ? `${c.temperatureC}°C` : null) +
        row('Precipitation', c.precipMm != null ? `${c.precipMm} mm` : null) +
        row('Moon', c.moonPhase) +
      `</div>` +
      (advancedFields ? `<div class="catch-detail__section"><div class="catch-detail__section-title">Advanced</div>${advancedFields}</div>` : '');

    const overlay = document.getElementById('catch-detail-overlay');
    overlay.classList.remove('hidden');
    if (_detailTrap) _detailTrap.activate();
  }

  function _closeDetail() {
    if (_detailTrap) _detailTrap.deactivate();
    animatedClose(document.getElementById('catch-detail-overlay'));
    _detailId = null;
  }

  function _confirmDelete(id) {
    if (!confirm('Delete this catch? This cannot be undone.')) return;
    window.CatchesStore.deleteCatch(id);
    _renderList();
  }

  // ---- filter panel (#203) ----

  function _openFilter() {
    const overlay = document.getElementById('catch-filter-overlay');
    if (!overlay) return;

    // Build species checkboxes
    const speciesContainer = document.getElementById('catch-filter-species-checks');
    if (speciesContainer) {
      speciesContainer.innerHTML = SPECIES_LIST.map(s =>
        `<label class="catch-filter__check-label"><input type="checkbox" value="${s}" ${_filters.species.includes(s) ? 'checked' : ''}>${s}</label>`
      ).join('');
    }

    // Build rig checkboxes
    const rigContainer = document.getElementById('catch-filter-rig-checks');
    if (rigContainer) {
      rigContainer.innerHTML = RIG_LIST.map(r =>
        `<label class="catch-filter__check-label"><input type="checkbox" value="${r}" ${_filters.rigs.includes(r) ? 'checked' : ''}>${r}</label>`
      ).join('');
    }

    const el = id => document.getElementById(id);
    if (el('cf-date-from')) el('cf-date-from').value = _filters.dateFrom || '';
    if (el('cf-date-to')) el('cf-date-to').value = _filters.dateTo || '';
    if (el('cf-filter-bait')) el('cf-filter-bait').value = _filters.bait || '';
    if (el('cf-sort')) el('cf-sort').value = _filters.sort || 'date-desc';

    overlay.classList.remove('hidden');
    if (_filterTrap) _filterTrap.activate();
  }

  function _applyFilterPanel() {
    const el = id => document.getElementById(id);
    _filters.species = [...document.querySelectorAll('#catch-filter-species-checks input:checked')].map(i => i.value);
    _filters.rigs = [...document.querySelectorAll('#catch-filter-rig-checks input:checked')].map(i => i.value);
    _filters.dateFrom = el('cf-date-from') ? el('cf-date-from').value : '';
    _filters.dateTo = el('cf-date-to') ? el('cf-date-to').value : '';
    _filters.bait = el('cf-filter-bait') ? el('cf-filter-bait').value.trim() : '';
    _filters.sort = el('cf-sort') ? el('cf-sort').value : 'date-desc';

    if (_filterTrap) _filterTrap.deactivate();
    animatedClose(document.getElementById('catch-filter-overlay'));
    _renderChips();
    _renderList();
  }

  function _clearFilters() {
    _filters = { species: [], dateFrom: '', dateTo: '', bait: '', rigs: [], sort: 'date-desc' };
    if (_filterTrap) _filterTrap.deactivate();
    animatedClose(document.getElementById('catch-filter-overlay'));
    _renderChips();
    _renderList();
  }

  // ---- export/import (#236) ----

  function _exportFile() {
    const json = window.CatchesStore.exportCatches();
    const today = new Date().toLocaleDateString('sv').slice(0,10);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `catches-backup-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function _importFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const result = window.CatchesStore.importCatches(e.target.result);
      alert(`Import complete: ${result.added} added, ${result.skipped} skipped.`);
      _renderList();
    };
    reader.readAsText(file);
  }

  // ---- page init (#191 #230) ----

  function initCatchesPage() {
    const page = document.getElementById('page-catches');
    if (!page || page.dataset.loaded === '1') return;
    page.dataset.loaded = '1';

    // Setup focus traps
    const formOverlay = document.getElementById('catch-form-overlay');
    const detailOverlay = document.getElementById('catch-detail-overlay');
    const filterOverlay = document.getElementById('catch-filter-overlay');
    if (formOverlay && window.makeFocusTrap) _formTrap = window.makeFocusTrap(formOverlay.querySelector('.modal'));
    if (detailOverlay && window.makeFocusTrap) _detailTrap = window.makeFocusTrap(detailOverlay.querySelector('.modal'));
    if (filterOverlay && window.makeFocusTrap) _filterTrap = window.makeFocusTrap(filterOverlay.querySelector('.modal'));

    // Wire static buttons
    document.getElementById('catch-add-btn')?.addEventListener('click', () => _openForm(null));
    document.getElementById('catch-filter-btn')?.addEventListener('click', _openFilter);
    document.getElementById('catch-export-btn')?.addEventListener('click', _exportFile);
    document.getElementById('catch-import-btn')?.addEventListener('click', () => document.getElementById('catch-import-input')?.click());
    document.getElementById('catch-import-input')?.addEventListener('change', e => { _importFile(e.target.files[0]); e.target.value = ''; });

    // Quick species filter
    document.getElementById('catch-species-filter')?.addEventListener('change', e => {
      _filters.species = e.target.value ? [e.target.value] : [];
      _renderChips();
      _renderList();
    });

    // Form events
    document.getElementById('catch-form')?.addEventListener('submit', _onSave);
    document.getElementById('catch-form-close')?.addEventListener('click', _closeForm);
    document.getElementById('catch-form-cancel')?.addEventListener('click', _closeForm);
    document.getElementById('catch-form-overlay')?.addEventListener('click', _closeForm);
    document.getElementById('catch-photo-input')?.addEventListener('change', e => _handlePhoto(e.target.files[0]));

    // Detail events
    document.getElementById('catch-detail-close')?.addEventListener('click', _closeDetail);
    document.getElementById('catch-detail-overlay')?.addEventListener('click', _closeDetail);
    document.getElementById('catch-detail-edit')?.addEventListener('click', () => {
      _closeDetail();
      if (_detailId) _openForm(window.CatchesStore.getCatchById(_detailId));
    });
    document.getElementById('catch-detail-delete')?.addEventListener('click', () => {
      if (!_detailId) return;
      if (!confirm('Delete this catch? This cannot be undone.')) return;
      const id = _detailId;
      _closeDetail();
      window.CatchesStore.deleteCatch(id);
      _renderList();
    });

    // Filter panel events
    document.getElementById('catch-filter-apply')?.addEventListener('click', _applyFilterPanel);
    document.getElementById('catch-filter-clear')?.addEventListener('click', _clearFilters);
    document.getElementById('catch-filter-close')?.addEventListener('click', () => {
      if (_filterTrap) _filterTrap.deactivate();
      animatedClose(document.getElementById('catch-filter-overlay'));
    });
    document.getElementById('catch-filter-overlay')?.addEventListener('click', () => {
      if (_filterTrap) _filterTrap.deactivate();
      animatedClose(document.getElementById('catch-filter-overlay'));
    });

    // Show skeletons immediately
    const listEl = document.getElementById('catch-list');
    if (listEl) {
      listEl.innerHTML = ['','',''].map(() => '<div class="catch-card catch-card--skeleton"></div>').join('');
    }

    // Seed mock data on first visit if store empty, then render
    if (window.CatchesStore.getAllCatches().length === 0) {
      fetch('./data/mock-catches.json')
        .then(r => r.json())
        .then(data => { window.CatchesStore.importCatches(data); _renderList(); })
        .catch(() => _renderList());
    } else {
      _renderList();
    }
  }

  function _onRouteChange() {
    if (location.hash === '#catches') initCatchesPage();
  }
  window.addEventListener('hashchange', _onRouteChange);
  _onRouteChange();

  window.Catches = { renderCatchCard, initCatchesPage };
})();
