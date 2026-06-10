(function () {
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const WEEKDAY_HEADERS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  let _viewYear, _viewMonth; // currently displayed month (0-based)
  let _selectedDate = null;

  // Brussels "today" using codebase pattern
  function _todayBrussels() {
    const iso = new Date().toLocaleString('sv', { timeZone: 'Europe/Brussels' }).slice(0, 10);
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function _isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  // Brussels-local HH:MM or '—' if date is null/invalid
  function _fmtTime(date) {
    if (!date || isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('nl-BE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Brussels',
    });
  }

  // "DD Month YYYY" e.g. "10 June 2026"
  function _fmtLongDate(date) {
    const d = String(date.getDate()).padStart(2, '0');
    return `${d} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  }

  // {start, end} Date pair → 'HH:MM – HH:MM' or '—'
  function _fmtPeriod(period) {
    if (!period || !period.start || !period.end) return '—';
    return `${_fmtTime(period.start)} – ${_fmtTime(period.end)}`;
  }

  // JS getDay() 0=Sun → Mon=0..Sun=6
  function _mondayIdx(jsDay) {
    return (jsDay + 6) % 7;
  }

  // #167 — calendar grid
  function renderMoonCalendar(year, month) {
    _viewYear = year;
    _viewMonth = month;

    const gridEl = document.getElementById('moon-calendar-grid');
    const labelEl = document.getElementById('moon-month-label');
    if (!gridEl) return;

    if (labelEl) labelEl.textContent = `${MONTH_NAMES[month]} ${year}`;

    const today = _todayBrussels();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIdx = _mondayIdx(new Date(year, month, 1).getDay()); // leading blanks

    const cells = [];

    // Weekday headers
    WEEKDAY_HEADERS.forEach(function (h) {
      cells.push(`<div class="moon-cal__weekday">${h}</div>`);
    });

    // Leading blanks
    for (let i = 0; i < firstDayIdx; i++) {
      cells.push('<div class="moon-cal__cell moon-cal__cell--empty"></div>');
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isToday = _isSameDay(date, today);
      const isSelected = _selectedDate && _isSameDay(date, _selectedDate);
      const moonData = window.Moon
        ? window.Moon.getMoonPhase(new Date(year, month, d, 12, 0))
        : {};
      const icon = window.Moon
        ? window.Moon.moonPhaseIcon(moonData.phaseName || 'New Moon', 20)
        : '';
      const illum = moonData.illumination != null ? `${moonData.illumination}%` : '';

      let cls = 'moon-cal__cell';
      if (isToday) cls += ' moon-cal__cell--today';
      if (isSelected) cls += ' moon-cal__cell--selected';

      const dateStr =
        `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      cells.push(
        `<div class="${cls}" role="button" tabindex="0" data-date="${dateStr}">` +
          `<span class="moon-cal__daynum">${d}</span>` +
          `<span class="moon-cal__icon">${icon}</span>` +
          `<span class="moon-cal__illum">${illum}</span>` +
        `</div>`,
      );
    }

    gridEl.innerHTML = `<div class="moon-cal__grid">${cells.join('')}</div>`;

    // Wire day cell clicks
    gridEl.querySelectorAll('.moon-cal__cell:not(.moon-cal__cell--empty)').forEach(function (cell) {
      cell.addEventListener('click', function () { _selectDay(cell.dataset.date); });
      cell.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          _selectDay(cell.dataset.date);
        }
      });
    });
  }

  function _selectDay(dateStr) {
    // dateStr = 'YYYY-MM-DD'
    const [y, m, d] = dateStr.split('-').map(Number);
    _selectedDate = new Date(y, m - 1, d);
    renderMoonDetailPanel(_selectedDate);
    _markSelectedCell(_selectedDate);
  }

  function _markSelectedCell(date) {
    const gridEl = document.getElementById('moon-calendar-grid');
    if (!gridEl) return;
    gridEl.querySelectorAll('.moon-cal__cell--selected').forEach(function (el) {
      el.classList.remove('moon-cal__cell--selected');
    });
    const str =
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const cell = gridEl.querySelector(`[data-date="${str}"]`);
    if (cell) cell.classList.add('moon-cal__cell--selected');
  }

  // #171 — detail panel
  function renderMoonDetailPanel(date) {
    const panelEl = document.getElementById('moon-detail-panel');
    if (!panelEl) return;

    let icon = '';
    let phaseName = '—';
    let illum = '—';
    let rise = '—';
    let set = '—';
    let majorStr = '—';
    let minorStr = '—';

    if (window.Moon) {
      const moonData = window.Moon.getMoonPhase(
        new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0),
      );
      phaseName = moonData.phaseName || '—';
      illum = moonData.illumination != null ? `${moonData.illumination}%` : '—';
      icon = window.Moon.moonPhaseIcon(phaseName, 96);

      const times = window.Moon.getMoonTimes(date);
      rise = _fmtTime(times.rise);
      set = _fmtTime(times.set);

      const sol = window.Moon.getSolunarPeriods(date);
      majorStr = _fmtPeriod(sol.major[0]);
      minorStr = _fmtPeriod(sol.minor[0]);
    }

    panelEl.innerHTML =
      `<div class="moon-detail__icon">${icon}</div>` +
      `<div class="moon-detail__date">${_fmtLongDate(date)}</div>` +
      `<div class="moon-detail__phase">${phaseName}</div>` +
      `<div class="moon-detail__illum">${illum} illuminated</div>` +
      `<div class="moon-detail__times">` +
        `<div class="moon-detail__row"><span class="moon-detail__label">Moonrise</span><span class="moon-detail__value">${rise}</span></div>` +
        `<div class="moon-detail__row"><span class="moon-detail__label">Moonset</span><span class="moon-detail__value">${set}</span></div>` +
      `</div>` +
      `<div class="moon-detail__solunar">` +
        `<div class="moon-detail__row"><span class="moon-detail__label">Major period</span><span class="moon-detail__value">${majorStr}</span></div>` +
        `<div class="moon-detail__row"><span class="moon-detail__label">Minor period</span><span class="moon-detail__value">${minorStr}</span></div>` +
      `</div>`;
  }

  // #174 — initialize page once on first visit
  function initMoonPage() {
    const page = document.getElementById('page-moon');
    if (!page || page.dataset.loaded === '1') return;
    page.dataset.loaded = '1';

    // Wire nav buttons once
    const prevBtn = document.getElementById('moon-prev');
    const nextBtn = document.getElementById('moon-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        let m = _viewMonth - 1;
        let y = _viewYear;
        if (m < 0) { m = 11; y--; }
        renderMoonCalendar(y, m);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        let m = _viewMonth + 1;
        let y = _viewYear;
        if (m > 11) { m = 0; y++; }
        renderMoonCalendar(y, m);
      });
    }

    const today = _todayBrussels();
    _selectedDate = today;
    renderMoonCalendar(today.getFullYear(), today.getMonth());
    renderMoonDetailPanel(today);
  }

  function _onRouteChange() {
    if (location.hash === '#moon') initMoonPage();
  }
  window.addEventListener('hashchange', _onRouteChange);
  _onRouteChange();

  window.MoonCalendar = { renderMoonCalendar, renderMoonDetailPanel, initMoonPage };
})();
