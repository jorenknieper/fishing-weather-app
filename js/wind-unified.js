// #132–#136 — unified wind modal: chart, navigator, barb strip, rotation tape, stats panel
(function () {
  const HIST_HOURS = 168;
  const FORECAST_HOURS = 168;
  const INITIAL_VIEWPORT_HOURS = 24;
  const ZOOM_MIN_RANGE = 4;
  const BARB_SIZE = 28;

  // Closure state
  let chart = null;
  let navValues = null;
  let windTimes = null;
  let windDirs = null;
  let windSpeeds = null;
  let windGusts = null;
  let startIndex = 0;
  let nowSplitAt = 0;
  let initialMin = 0;
  let initialMax = 0;
  let dragging = false;
  let dragStartX = null;
  let dragStartRange = null;
  let originator = null;

  const overlayEl = document.getElementById('wind-unified-modal');
  const focusTrap = makeFocusTrap(overlayEl.querySelector('.modal'));
  attachSwipeGesture(overlayEl);
  setupDoubleTap(document.getElementById('wind-unified-chart'), () => {
    if (chart) reset();
  });

  // -- Navigator (#133) --

  function drawNavigator() {
    const nav = document.getElementById('wind-unified-navigator');
    if (!nav || !navValues || !chart) return;
    const w = nav.offsetWidth;
    const h = nav.offsetHeight;
    if (!w || !h) return;
    nav.width = w;
    nav.height = h;
    const ctx = nav.getContext('2d');
    const n = navValues.length;
    const accentColor = cssVar('--accent-wind');
    ctx.fillStyle = cssVar('--nav-track');
    ctx.fillRect(0, 0, w, h);
    const scale = chart.scales.x;
    const denominator = Math.max(n - 1, 1);
    const rx = Math.max(0, (scale.min / denominator) * w);
    const rx2 = Math.min(w, (scale.max / denominator) * w);
    const rw = Math.max(2, rx2 - rx);
    ctx.fillStyle = cssVar('--accent-wind-soft');
    ctx.fillRect(rx, 0, rw, h);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx + 0.75, 0.75, Math.max(0, rw - 1.5), Math.max(0, h - 1.5));
  }

  function setupNavigatorDrag() {
    const nav = document.getElementById('wind-unified-navigator');
    if (!nav) return;
    function getClientX(e) {
      return e.touches ? e.touches[0].clientX : e.clientX;
    }
    function onStart(e) {
      if (!chart || !navValues) return;
      if (e.cancelable) e.preventDefault();
      dragging = true;
      dragStartX = getClientX(e) - nav.getBoundingClientRect().left;
      dragStartRange = { min: chart.scales.x.min, max: chart.scales.x.max };
      nav.style.cursor = 'grabbing';
    }
    function onMove(e) {
      if (!dragging || !chart || !navValues) return;
      if (e.cancelable) e.preventDefault();
      const currentX = getClientX(e) - nav.getBoundingClientRect().left;
      const deltaX = currentX - dragStartX;
      const n = navValues.length;
      const visibleRange = dragStartRange.max - dragStartRange.min;
      const deltaIndex = (deltaX / nav.offsetWidth) * n;
      const newMin = Math.max(0, Math.min(dragStartRange.min + deltaIndex, n - 1 - visibleRange));
      const newMax = newMin + visibleRange;
      chart.options.scales.x.min = newMin;
      chart.options.scales.x.max = newMax;
      chart.update('none');
      drawNavigator();
      drawBarbsAndTape();
    }
    function onEnd() {
      dragging = false;
      nav.style.cursor = 'grab';
    }
    nav.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    nav.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }

  // -- Arrow strip (#146) + Rotation tape (#135) --

  function drawBarbsAndTape() {
    if (!chart || !windTimes) return;
    drawBarbStrip();
    drawRotationTape();
  }

  function drawBarbStrip() {
    const el = document.getElementById('wind-unified-barb-strip');
    if (!el || !chart) return;
    const scale = chart.scales.x;
    if (!scale) return;
    const visibleRange = Math.round(scale.max - scale.min);
    let step;
    if (visibleRange <= 48) step = 1;
    else if (visibleRange <= 168) step = 3;
    else step = 6;

    const plotArea = chart.chartArea;
    if (!plotArea) return;

    const minIdx = Math.max(0, Math.floor(scale.min));
    const maxIdx = Math.min(navValues ? navValues.length - 1 : 0, Math.ceil(scale.max));

    let html = '';
    for (let i = minIdx; i <= maxIdx; i++) {
      if ((i - minIdx) % step !== 0) continue;
      const dir = windDirs ? windDirs[startIndex + i] : null;
      const speedKmh = windSpeeds ? windSpeeds[startIndex + i] : null;
      const gustKmh = windGusts ? windGusts[startIndex + i] : null;
      const px = scale.getPixelForValue(i);
      const timeStr = windTimes[startIndex + i] || '';
      const hour = timeStr.slice(11, 16);
      const cardinal = dir != null ? degreesToCompass(dir) : '–';
      const speedDisplay = speedKmh != null ? Math.round(speedKmh) : '–';
      const gustDisplay = gustKmh != null ? Math.round(gustKmh) : '–';
      const arrowSvg =
        dir != null
          ? renderWindArrow(dir, { size: BARB_SIZE, speedKmh })
          : `<svg width="${BARB_SIZE}" height="${BARB_SIZE}" aria-hidden="true"></svg>`;
      const dataAttrs = `data-idx="${i}" data-dir="${dir != null ? dir : ''}" data-speed="${speedKmh != null ? speedKmh : ''}" data-gust="${gustKmh != null ? gustKmh : ''}" data-time="${hour}" data-cardinal="${cardinal}"`;
      html +=
        `<span class="wind-barb-cell" tabindex="0" role="button" aria-label="${hour} ${cardinal} ${speedDisplay} km/h gusts ${gustDisplay} km/h" ` +
        `style="left:${px.toFixed(1)}px;width:${BARB_SIZE}px;" ${dataAttrs}>` +
        arrowSvg +
        `<span class="wind-barb-cell__hour">${hour.slice(0, 2)}</span>` +
        `</span>`;
    }
    el.innerHTML = html;

    el.querySelectorAll('.wind-barb-cell').forEach((cell) => {
      cell.addEventListener('click', onBarbActivate);
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onBarbActivate.call(cell, e);
        }
      });
    });
  }

  function drawRotationTape() {
    const el = document.getElementById('wind-unified-rotation-tape');
    if (!el || !chart) return;
    const scale = chart.scales.x;
    if (!scale) return;
    const plotArea = chart.chartArea;
    if (!plotArea) return;

    const minIdx = Math.max(0, Math.floor(scale.min));
    const maxIdx = Math.min(navValues ? navValues.length - 1 : 0, Math.ceil(scale.max));

    let html = '';
    for (let i = minIdx; i < maxIdx; i++) {
      // px values are from chart canvas left; strip div shares the same width as the canvas
      const x1 = scale.getPixelForValue(i);
      const x2 = scale.getPixelForValue(i + 1);
      const w = Math.max(1, x2 - x1);
      const globalI = startIndex + i;
      const { verdict } = computeWindRotation(windDirs || [], globalI, 1);
      let color;
      if (verdict === 'veering') color = 'var(--accent-wind)';
      else if (verdict === 'backing') color = 'var(--wind-stormy)';
      else color = 'var(--border-subtle)';
      html += `<span style="left:${x1.toFixed(1)}px;width:${w.toFixed(1)}px;background:${color};"></span>`;
    }
    el.innerHTML = html;
  }

  // -- Stats panel (#147) — persistent pipe-separated bar --

  function onBarbActivate(e) {
    const cell = e.currentTarget || e.target.closest('.wind-barb-cell') || this;
    if (!cell) return;
    const idx = parseInt(cell.dataset.idx, 10);
    showBarbStats(idx, cell);
  }

  function showBarbStats(idx, sourceCell) {
    const panel = document.getElementById('wind-barb-stats');
    if (!panel) return;

    const globalIdx = startIndex + idx;
    const timeStr = windTimes ? windTimes[globalIdx] : '';
    const localTime = timeStr
      ? new Date(timeStr.replace('T', ' ') + ':00').toLocaleString('en-BE', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Brussels',
        })
      : '–';
    const dir = windDirs ? windDirs[globalIdx] : null;
    const speedKmh = windSpeeds ? windSpeeds[globalIdx] : null;
    const gustKmh = windGusts ? windGusts[globalIdx] : null;
    const cardinal = dir != null ? degreesToCompass(dir) : '–';
    const dirDisplay = dir != null ? `${cardinal} (${Math.round(dir)}°)` : '–';
    const speedDisplay = speedKmh != null ? Math.round(speedKmh) + ' km/h' : '–';
    const gustDisplay = gustKmh != null ? Math.round(gustKmh) + ' km/h' : '–';

    // TREND via 6h window from selected index
    let trendText = 'steady';
    if (windDirs) {
      const { verdict } = computeWindRotation(windDirs, globalIdx, 6);
      if (verdict === 'veering' || verdict === 'backing') {
        const futureIdx = Math.min(windDirs.length - 1, globalIdx + 6);
        const futureDir = windDirs[futureIdx];
        const hint = futureDir != null ? ' ' + degreesToCompass(futureDir) : '';
        trendText = verdict + hint;
      } else {
        trendText = verdict;
      }
    }

    // STABILITY via gust ratio + 3h variance
    let stability = 'steady';
    if (windDirs) {
      const gustRatio =
        speedKmh != null && speedKmh > 0 && gustKmh != null ? gustKmh / speedKmh : 0;
      const { variance } = computeWindRotation(windDirs, globalIdx, 3);
      if (gustRatio > 1.5) stability = 'gusty';
      else if (variance > 100) stability = 'variable';
    }

    panel.innerHTML =
      `<span class="wind-stats-seg wind-stats-seg--time">${localTime}</span>` +
      `<span class="wind-stats-pipe" aria-hidden="true">│</span>` +
      `<span class="wind-stats-seg">FROM: ${dirDisplay}</span>` +
      `<span class="wind-stats-pipe" aria-hidden="true">│</span>` +
      `<span class="wind-stats-seg">SUSTAINED: ${speedDisplay}</span>` +
      `<span class="wind-stats-pipe" aria-hidden="true">│</span>` +
      `<span class="wind-stats-seg">GUSTS: ${gustDisplay}</span>` +
      `<span class="wind-stats-pipe" aria-hidden="true">│</span>` +
      `<span class="wind-stats-seg">TREND: ${trendText}</span>` +
      `<span class="wind-stats-pipe" aria-hidden="true">│</span>` +
      `<span class="wind-stats-seg">STABILITY: ${stability}</span>`;

    document
      .querySelectorAll('.wind-barb-cell--active')
      .forEach((c) => c.classList.remove('wind-barb-cell--active'));
    if (sourceCell) sourceCell.classList.add('wind-barb-cell--active');
  }

  // -- Chart (#132) --

  function renderChart() {
    const canvas = document.getElementById('wind-unified-chart');
    const noData = document.getElementById('wind-unified-no-data');
    const hourly = window.hourlyData;

    if (
      !hourly ||
      !hourly.time ||
      !Array.isArray(hourly.wind_speed_10m) ||
      !Array.isArray(hourly.wind_gusts_10m) ||
      !Array.isArray(hourly.wind_direction_10m) ||
      typeof Chart === 'undefined'
    ) {
      canvas.classList.add('hidden');
      noData.classList.remove('hidden');
      return;
    }

    canvas.classList.remove('hidden');
    noData.classList.add('hidden');

    const nowISO = new Date()
      .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
      .slice(0, 16)
      .replace(' ', 'T');

    let boundaryIndex = hourly.time.findIndex((t) => t >= nowISO);
    if (boundaryIndex === -1) boundaryIndex = hourly.time.length;

    startIndex = Math.max(0, boundaryIndex - HIST_HOURS);
    const endIndex = Math.min(hourly.time.length, boundaryIndex + FORECAST_HOURS);
    const splitAt = boundaryIndex - startIndex;
    nowSplitAt = splitAt;

    windTimes = hourly.time;
    windDirs = hourly.wind_direction_10m;
    windSpeeds = hourly.wind_speed_10m;
    windGusts = hourly.wind_gusts_10m;

    const times = hourly.time.slice(startIndex, endIndex);
    const labels = times.map((t) => t.slice(11, 16));

    const speeds = hourly.wind_speed_10m.slice(startIndex, endIndex);
    const gusts = hourly.wind_gusts_10m.slice(startIndex, endIndex);

    navValues = speeds;

    const textColor = cssVar('--text-muted');
    const gridColor = cssVar('--color-shadow');
    const accentColor = cssVar('--accent-wind');
    const accentSoftColor = cssVar('--accent-wind-soft');

    const allValid = [...speeds, ...gusts].filter((v) => v != null);
    const yMin = allValid.length ? Math.floor((Math.min(...allValid) - 5) / 5) * 5 : 0;
    const yMax = allValid.length ? Math.ceil((Math.max(...allValid) + 10) / 10) * 10 : 80;

    function buildDs(label, data, color, isForecast) {
      const ds = {
        label,
        data,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        spanGaps: false,
        tension: 0.3,
      };
      if (isForecast) ds.borderDash = [5, 5];
      return ds;
    }

    const speedPast = speeds.map((v, i) => (i <= splitAt ? v : null));
    const speedFcast = speeds.map((v, i) => (i >= splitAt ? v : null));
    const gustsPast = gusts.map((v, i) => (i <= splitAt ? v : null));
    const gustsFcast = gusts.map((v, i) => (i >= splitAt ? v : null));

    if (chart) {
      try {
        chart.destroy();
      } catch {
        /* ignore */
      }
      chart = null;
    }

    try {
      chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            buildDs('Sustained', speedPast, accentColor, false),
            buildDs('Sustained (forecast)', speedFcast, accentColor, true),
            buildDs('Gusts', gustsPast, accentSoftColor, false),
            buildDs('Gusts (forecast)', gustsFcast, accentSoftColor, true),
          ],
        },
        plugins: [makeDayLabelsPlugin(times, textColor), makeNowLinePlugin(splitAt)],
        options: {
          responsive: true,
          maintainAspectRatio: true,
          layout: { padding: { top: 20 } },
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { color: textColor, boxWidth: 20 },
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              enabled: false,
              external: makeExternalTooltipHandler(times),
            },
            zoom: {
              limits: { x: { min: 0, max: times.length - 1, minRange: ZOOM_MIN_RANGE } },
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
              pan: { enabled: true, mode: 'x' },
              onZoomComplete: () => {
                drawNavigator();
                drawBarbsAndTape();
              },
              onPanComplete: () => {
                drawNavigator();
                drawBarbsAndTape();
              },
            },
          },
          scales: {
            x: {
              min: 0,
              max: times.length - 1,
              ticks: {
                color: textColor,
                maxRotation: 0,
                callback: function (value) {
                  const t = times[value];
                  if (!t) return undefined;
                  const time = t.slice(11, 16);
                  const visible = Math.round(this.max - this.min);
                  if (visible > 168) return time === '00:00' ? time : undefined;
                  if (visible > 96) return time === '00:00' || time === '12:00' ? time : undefined;
                  if (visible > 24) return value % 4 === 0 ? time : undefined;
                  if (visible >= 8) return value % 2 === 0 ? time : undefined;
                  return time;
                },
              },
              grid: {
                color: function (context) {
                  const t = context.tick && times[context.tick.value];
                  if (t && t.slice(11, 16) === '00:00') return accentColor;
                  return gridColor;
                },
              },
            },
            y: {
              min: yMin,
              max: yMax,
              ticks: { color: textColor, stepSize: 10 },
              grid: { color: gridColor },
              title: { display: true, text: 'km/h', color: textColor },
            },
          },
        },
      });
    } catch (err) {
      console.error('Wind chart creation failed:', err);
      if (chart) {
        try {
          chart.destroy();
        } catch {
          /* ignore */
        }
        chart = null;
      }
      canvas.classList.add('hidden');
      noData.classList.remove('hidden');
      return;
    }

    initialMin = Math.max(0, splitAt - INITIAL_VIEWPORT_HOURS);
    initialMax = Math.min(times.length - 1, splitAt + INITIAL_VIEWPORT_HOURS);
    if (typeof chart.zoomScale === 'function') {
      chart.zoomScale('x', { min: initialMin, max: initialMax }, 'none');
    } else {
      chart.options.scales.x.min = initialMin;
      chart.options.scales.x.max = initialMax;
      chart.update('none');
    }

    requestAnimationFrame(() => {
      drawNavigator();
      drawBarbsAndTape();
      // Default stats bar to now-cell (#147)
      showBarbStats(nowSplitAt, null);
    });
  }

  // -- Compass dial (#131) --

  function renderDial() {
    const el = document.getElementById('wind-modal-dial');
    if (!el) return;
    const current = window._windUnifiedCurrentData;
    renderWindCompassDialInto(el, current, 200);
  }

  // -- Public API --

  function open() {
    originator = document.activeElement;
    overlayEl.classList.remove('hidden');
    overlayEl.querySelector('.modal-close').focus();
    focusTrap.activate();
    renderDial();
    renderChart();
  }

  function close() {
    focusTrap.deactivate();
    if (typeof getOrCreateTooltipEl === 'function') getOrCreateTooltipEl().style.opacity = '0';
    animatedClose(overlayEl);
    originator?.focus();
    originator = null;
  }

  function reset() {
    if (chart) {
      chart.resetZoom();
      if (typeof chart.zoomScale === 'function') {
        chart.zoomScale('x', { min: initialMin, max: initialMax }, 'none');
      } else {
        chart.options.scales.x.min = initialMin;
        chart.options.scales.x.max = initialMax;
        chart.update('none');
      }
      drawNavigator();
      drawBarbsAndTape();
    }
  }

  // Register theme re-render callback
  _themeRerenderCallbacks.push(function () {
    if (!overlayEl.classList.contains('hidden') && chart) renderChart();
  });

  setupNavigatorDrag();

  window.WindUnified = { open, close, reset };
})();
