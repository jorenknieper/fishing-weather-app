function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function makeFocusTrap(modalEl) {
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function handler(e) {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(modalEl.querySelectorAll(FOCUSABLE));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  return {
    activate() { modalEl.addEventListener('keydown', handler); },
    deactivate() { modalEl.removeEventListener('keydown', handler); },
  };
}

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

const SWIPE_THRESHOLD = 80;

function isMobileViewport() {
  return window.matchMedia('(max-width: 639px)').matches;
}

function animatedClose(overlayEl) {
  if (!isMobileViewport() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    overlayEl.classList.add('hidden');
    return;
  }
  overlayEl.classList.add('sheet-closing');
  const modal = overlayEl.querySelector('.modal');
  function finish() {
    overlayEl.classList.remove('sheet-closing');
    overlayEl.classList.add('hidden');
    modal.style.transform = '';
  }
  modal.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 350); // safety fallback
}

function setupDoubleTap(canvas, onDoubleTap) {
  if (!canvas) return;
  let lastTap = 0;
  canvas.addEventListener('touchend', function (e) {
    // Ignore multi-finger gestures (pinch)
    if (e.changedTouches.length !== 1) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      onDoubleTap();
      lastTap = 0;
    } else {
      lastTap = now;
    }
  });
}

function attachSwipeGesture(overlayEl) {
  const modal = overlayEl.querySelector('.modal');
  if (!modal) return;
  let startY = 0;
  let dragging = false;
  modal.addEventListener('pointerdown', (e) => {
    if (!isMobileViewport()) return;
    startY = e.clientY;
    dragging = true;
    modal.setPointerCapture(e.pointerId);
  });
  modal.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const delta = Math.max(0, e.clientY - startY);
    modal.style.transform = `translateY(${delta}px)`;
  });
  modal.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    const delta = e.clientY - startY;
    if (delta > SWIPE_THRESHOLD) {
      animatedClose(overlayEl);
    } else {
      modal.style.transform = '';
    }
  });
}

function degreesToCompass(degrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

// Wind speed buckets (#92)
// Thresholds in km/h — tune by adjusting these constants.
const WIND_BUCKETS = [
  { max: 5,   bucket: 'calm' },
  { max: 15,  bucket: 'moderate' },
  { max: 30,  bucket: 'strong' },
  { max: Infinity, bucket: 'stormy' },
];

function getWindBucket(speedKmh) {
  if (speedKmh == null) return null;
  for (const { max, bucket } of WIND_BUCKETS) {
    if (speedKmh < max) return bucket;
  }
  return 'stormy';
}

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleString('en-BE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Brussels',
  });
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  let theme;
  if (saved) {
    // User has manually toggled before — honour their choice.
    theme = saved;
  } else {
    // No stored preference: respect the OS colour scheme.
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeButton();
}

function updateThemeButton() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
}

// Registry of open-chart re-render callbacks, populated by createChartModal.
const _themeRerenderCallbacks = [];

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeButton();
  // Re-render any chart currently visible so colours update immediately (#96).
  for (const cb of _themeRerenderCallbacks) cb();
}

// Suppress CSS transitions on first paint (#99): add class before theme init,
// remove it after two animation frames so the initial colour is set instantly.
document.documentElement.classList.add('no-transitions');
initTheme();
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.documentElement.classList.remove('no-transitions');
  });
});

// hourlyData is also exposed as window.hourlyData for js/pressure-inline.js
let hourlyData = null;
let _currentData = null; // #131 — stored for re-render when unified modal opens

function createChartModal(config) {
  // Private closure state
  let chart = null;
  let navValues = null;
  let navSplitAt = 0;
  let dragging = false;
  let dragStartX = null;
  let dragStartRange = null;
  let initialMin = 0;
  let initialMax = 0;
  let originator = null;

  function drawNavigator() {
    const nav = document.getElementById(config.navigatorId);
    if (!nav || !navValues || !chart) return;
    const w = nav.offsetWidth;
    const h = nav.offsetHeight;
    if (!w || !h) return;
    nav.width = w;
    nav.height = h;

    const ctx = nav.getContext('2d');
    const n = navValues.length;
    // Accent color re-read on every call so dark-mode toggle takes effect immediately
    const accentColor = cssVar(config.colors.accentToken);

    // Background track
    ctx.fillStyle = cssVar('--nav-track');
    ctx.fillRect(0, 0, w, h);

    // Viewport window
    const scale = chart.scales.x;
    const denominator = Math.max(n - 1, 1);
    const rx = Math.max(0, (scale.min / denominator) * w);
    const rx2 = Math.min(w, (scale.max / denominator) * w);
    const rw = Math.max(2, rx2 - rx);

    ctx.fillStyle = cssVar(config.colors.accentSoftToken);
    ctx.fillRect(rx, 0, rw, h);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx + 0.75, 0.75, Math.max(0, rw - 1.5), Math.max(0, h - 1.5));
  }

  function setupNavigatorDrag() {
    const nav = document.getElementById(config.navigatorId);
    if (!nav) return;

    function getClientX(e) {
      return e.touches ? e.touches[0].clientX : e.clientX;
    }

    function onStart(e) {
      if (!chart || !navValues) return;
      if (e.cancelable) e.preventDefault();
      dragging = true;
      dragStartX = getClientX(e) - nav.getBoundingClientRect().left;
      dragStartRange = {
        min: chart.scales.x.min,
        max: chart.scales.x.max,
      };
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

  function render() {
    const canvas = document.getElementById(config.chartId);
    const noData = document.getElementById(config.noDataId);

    const hourly = config.getData();

    // Determine which keys to validate against
    const seriesKeys = config.series ? config.series.map((s) => s.key) : ['pressure_msl'];

    if (
      !hourly ||
      !hourly.time ||
      typeof Chart === 'undefined' ||
      seriesKeys.some((k) => !Array.isArray(hourly[k]))
    ) {
      canvas.classList.add('hidden');
      noData.classList.remove('hidden');
      return;
    }

    canvas.classList.remove('hidden');
    noData.classList.add('hidden');

    // Current hour in Brussels time as "YYYY-MM-DDTHH:MM"
    const nowISO = new Date()
      .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
      .slice(0, 16)
      .replace(' ', 'T');

    let boundaryIndex = hourly.time.findIndex((t) => t >= nowISO);
    if (boundaryIndex === -1) boundaryIndex = hourly.time.length;

    const startIndex = Math.max(0, boundaryIndex - config.historyHours);
    const endIndex = Math.min(hourly.time.length, boundaryIndex + config.forecastHours);
    const splitAt = boundaryIndex - startIndex;

    const times = hourly.time.slice(startIndex, endIndex);
    const labels = times.map((t) => t.slice(11, 16));

    const textColor = cssVar('--text-muted');
    const gridColor = cssVar('--color-shadow');
    const accentColor = cssVar(config.colors.accentToken);

    const { stepSize, snapTo, paddingBelow, paddingAbove, fallbackMin, fallbackMax, unit } =
      config.yAxis;

    const chartType = config.chartType || 'line';

    function buildDataset(label, data, color, isForecast, alwaysDash = false) {
      const dataset = {
        label,
        data,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        spanGaps: false,
        tension: 0.3,
      };
      if (isForecast || alwaysDash) dataset.borderDash = [5, 5];
      return dataset;
    }

    function buildBarDataset(label, values, splitAt, historicalColor, forecastColor) {
      const colors = values.map((_, i) => (i <= splitAt ? historicalColor : forecastColor));
      return { label, data: values, backgroundColor: colors, borderWidth: 0 };
    }

    let datasets;
    let allValid = [];

    if (config.series) {
      // Multi-series path
      datasets = [];
      for (const s of config.series) {
        const vals = hourly[s.key].slice(startIndex, endIndex);
        allValid = allValid.concat(vals.filter((v) => v != null));
        // Resolve color at render time (supports function or string)
        const histColor = typeof s.historicalColor === 'function' ? s.historicalColor() : s.historicalColor;
        const fcastColor = typeof s.forecastColor === 'function' ? s.forecastColor() : s.forecastColor;
        if (chartType === 'bar') {
          datasets.push(
            buildBarDataset(s.historicalLabel, vals, splitAt, histColor, fcastColor),
          );
        } else {
          const pastData = vals.map((v, i) => (i <= splitAt ? v : null));
          const forecastData = vals.map((v, i) => (i >= splitAt ? v : null));
          const histDs = buildDataset(s.historicalLabel, pastData, histColor, false, !!s.alwaysDash);
          const fcastDs = buildDataset(s.forecastLabel, forecastData, fcastColor, true, !!s.alwaysDash);
          if (s.order != null) { histDs.order = s.order; fcastDs.order = s.order; }
          datasets.push(histDs, fcastDs);
        }
      }
      // Navigator uses first series for length reference
      navValues = hourly[config.series[0].key].slice(startIndex, endIndex);
    } else {
      // Single-series backwards-compat path
      const values = hourly.pressure_msl.slice(startIndex, endIndex);
      navValues = values;
      allValid = values.filter((v) => v != null);
      const pastData = values.map((v, i) => (i <= splitAt ? v : null));
      const forecastData = values.map((v, i) => (i >= splitAt ? v : null));
      const histColor = typeof config.colors.historical === 'function' ? config.colors.historical() : config.colors.historical;
      const fcastColor = typeof config.colors.forecast === 'function' ? config.colors.forecast() : config.colors.forecast;
      datasets = [
        buildDataset(config.historicalLabel, pastData, histColor, false),
        buildDataset(config.forecastLabel, forecastData, fcastColor, true),
      ];
    }

    navSplitAt = splitAt;

    let yMin = allValid.length
      ? Math.floor((Math.min(...allValid) - paddingBelow) / snapTo) * snapTo
      : fallbackMin;
    let yMax = allValid.length
      ? Math.ceil((Math.max(...allValid) + paddingAbove) / snapTo) * snapTo
      : fallbackMax;
    if (chartType === 'bar' && yMin === yMax) yMax = Math.max(fallbackMax, yMin + snapTo);

    if (chart) {
      try {
        chart.destroy();
      } catch (_) {
        // ignore destroy errors
      }
      chart = null;
    }

    try {
      chart = new Chart(canvas, {
        type: chartType,
        data: {
          labels,
          datasets,
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
              limits: { x: { min: 0, max: times.length - 1, minRange: config.zoomMinRange } },
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
              pan: { enabled: true, mode: 'x' },
              onZoomComplete: () => drawNavigator(),
              onPanComplete: () => drawNavigator(),
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
              ticks: { color: textColor, stepSize },
              grid: { color: gridColor },
              title: { display: true, text: unit, color: textColor },
            },
          },
        },
      });
    } catch (err) {
      console.error('Chart creation failed for', config.chartId, err);
      if (chart) {
        try {
          chart.destroy();
        } catch (_) {
          // ignore destroy errors
        }
        chart = null;
      }
      canvas.classList.add('hidden');
      noData.classList.remove('hidden');
      return;
    }

    initialMin = Math.max(0, splitAt - config.initialViewportHours);
    initialMax = Math.min(times.length - 1, splitAt + config.initialViewportHours);
    if (typeof chart.zoomScale === 'function') {
      chart.zoomScale('x', { min: initialMin, max: initialMax }, 'none');
    } else {
      chart.options.scales.x.min = initialMin;
      chart.options.scales.x.max = initialMax;
      chart.update('none');
    }

    requestAnimationFrame(() => drawNavigator());
  }

  // Set up navigator drag once at factory construction time
  setupNavigatorDrag();
  attachSwipeGesture(document.getElementById(config.modalId));

  // Double-tap to reset chart viewport on mobile (#94)
  setupDoubleTap(document.getElementById(config.chartId), () => {
    if (chart) reset();
  });

  const overlayEl = document.getElementById(config.modalId);
  const focusTrap = makeFocusTrap(overlayEl.querySelector('.modal'));

  // Register a theme re-render callback (#96): re-renders only when the modal is open.
  _themeRerenderCallbacks.push(function () {
    if (!overlayEl.classList.contains('hidden') && chart) render();
  });

  function open() {
    originator = document.activeElement;
    overlayEl.classList.remove('hidden');
    overlayEl.querySelector('.modal-close').focus();
    focusTrap.activate();
    render();
  }

  function close() {
    focusTrap.deactivate();
    getOrCreateTooltipEl().style.opacity = '0';
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
    }
  }

  return { open, close, reset };
}

// resetPressureChart is called from index.html onclick; delegates to js/pressure-inline.js
function resetPressureChart() {
  window.PressureInline?.reset();
}

const temperatureModal = createChartModal({
  modalId: 'temp-modal',
  chartId: 'temp-chart',
  navigatorId: 'temp-navigator',
  noDataId: 'temp-no-data',
  getData: () => hourlyData,
  series: [
    {
      key: 'temperature_2m',
      historicalLabel: 'Temperature',
      forecastLabel: 'Temperature (forecast)',
      historicalColor: () => cssVar('--accent-temp'),
      forecastColor: () => cssVar('--accent-temp-soft'),
    },
    {
      key: 'apparent_temperature',
      historicalLabel: 'Feels Like',
      forecastLabel: 'Feels Like (forecast)',
      historicalColor: () => cssVar('--accent-pressure'),
      forecastColor: () => cssVar('--accent-pressure-soft'),
    },
  ],
  colors: { accentToken: '--accent-temp', accentSoftToken: '--accent-temp-soft' },
  yAxis: {
    unit: '°C',
    stepSize: 5,
    snapTo: 5,
    paddingBelow: 2,
    paddingAbove: 2,
    fallbackMin: -10,
    fallbackMax: 35,
  },
  historyHours: 168,
  forecastHours: 168,
  initialViewportHours: 24,
  zoomMinRange: 4,
});

function openTemperatureModal() {
  temperatureModal.open();
}
function closeTemperatureModal() {
  temperatureModal.close();
}
function resetTemperatureChart() {
  temperatureModal.reset();
}

const humidityModal = createChartModal({
  modalId: 'humidity-modal',
  chartId: 'humidity-chart',
  navigatorId: 'humidity-navigator',
  noDataId: 'humidity-no-data',
  getData: () => hourlyData,
  series: [
    {
      key: 'relative_humidity_2m',
      historicalLabel: 'Humidity',
      forecastLabel: 'Humidity (forecast)',
      historicalColor: () => cssVar('--accent-wind'),
      forecastColor: () => cssVar('--accent-wind-soft'),
    },
  ],
  colors: { accentToken: '--accent-wind', accentSoftToken: '--accent-wind-soft' },
  yAxis: {
    unit: '%',
    stepSize: 10,
    snapTo: 10,
    paddingBelow: 5,
    paddingAbove: 5,
    fallbackMin: 0,
    fallbackMax: 100,
  },
  historyHours: 168,
  forecastHours: 168,
  initialViewportHours: 24,
  zoomMinRange: 4,
});

function openHumidityModal() {
  humidityModal.open();
}
function closeHumidityModal() {
  humidityModal.close();
}
function resetHumidityChart() {
  humidityModal.reset();
}

// #130 — unified wind modal: delegates to js/wind-unified.js (loaded after app.js)
function openWindUnifiedModal() { window.WindUnified?.open(); }
function closeWindUnifiedModal() { window.WindUnified?.close(); }
function resetWindUnifiedChart() { window.WindUnified?.reset(); }

const precipitationModal = createChartModal({
  modalId: 'precipitation-modal',
  chartId: 'precipitation-chart',
  navigatorId: 'precipitation-navigator',
  noDataId: 'precipitation-no-data',
  getData: () => hourlyData,
  chartType: 'bar',
  series: [
    {
      key: 'precipitation',
      historicalLabel: 'Precipitation',
      forecastLabel: 'Precipitation (forecast)',
      historicalColor: () => cssVar('--accent-temp'),
      forecastColor: () => cssVar('--accent-temp-soft'),
    },
  ],
  colors: { accentToken: '--accent-temp', accentSoftToken: '--accent-temp-soft' },
  yAxis: {
    unit: 'mm',
    stepSize: 1,
    snapTo: 1,
    paddingBelow: 0,
    paddingAbove: 2,
    fallbackMin: 0,
    fallbackMax: 10,
  },
  historyHours: 168,
  forecastHours: 168,
  initialViewportHours: 24,
  zoomMinRange: 4,
});

function openPrecipitationModal() {
  precipitationModal.open();
}
function closePrecipitationModal() {
  precipitationModal.close();
}
function resetPrecipitationChart() {
  precipitationModal.reset();
}

const windDirectionModal = window.WindDirection.createModal({
  modalId: 'wind-direction-modal',
  timelineId: 'wind-direction-timeline',
  noDataId: 'wind-direction-no-data',
  navigatorId: 'wind-direction-navigator',
  getData: () => hourlyData,
  dayLabelsPlugin: makeDayLabelsPlugin,
  nowLinePlugin: makeNowLinePlugin,
  historyHours: 168,
  forecastHours: 168,
  initialViewportHours: 4,
  zoomMinRange: 4,
  colors: { accentToken: '--accent-wind', accentSoftToken: '--accent-wind-soft' },
});
attachSwipeGesture(document.getElementById('wind-direction-modal'));

// Double-tap to reset wind direction mini-chart on mobile (#94)
setupDoubleTap(document.getElementById('wind-direction-minichart'), () => {
  windDirectionModal.reset();
});

const wdOverlayEl = document.getElementById('wind-direction-modal');
const wdFocusTrap = makeFocusTrap(wdOverlayEl.querySelector('.modal'));
let wdOriginator = null;

function openWindDirectionModal() {
  wdOriginator = document.activeElement;
  windDirectionModal.open();
  wdOverlayEl.querySelector('.modal-close').focus();
  wdFocusTrap.activate();
}
function closeWindDirectionModal() {
  wdFocusTrap.deactivate();
  windDirectionModal.close();
  wdOriginator?.focus();
  wdOriginator = null;
}
function resetWindDirectionChart() {
  windDirectionModal.reset();
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (!document.getElementById('wind-direction-modal').classList.contains('hidden'))
      closeWindDirectionModal();
    else if (!document.getElementById('humidity-modal').classList.contains('hidden'))
      closeHumidityModal();
    else if (!document.getElementById('wind-unified-modal').classList.contains('hidden'))
      closeWindUnifiedModal();
    else if (!document.getElementById('precipitation-modal').classList.contains('hidden'))
      closePrecipitationModal();
    else if (!document.getElementById('temp-modal').classList.contains('hidden'))
      closeTemperatureModal();
  }
});

function showError() {
  document.getElementById('error-message').classList.remove('hidden');
}

function computePressureTrend(hourly) {
  if (!hourly?.time || !hourly?.pressure_msl) return null;
  const nowISO = new Date()
    .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
    .slice(0, 16).replace(' ', 'T');
  // Find the last index whose time <= nowISO
  let idx = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    if (hourly.time[i] <= nowISO) idx = i;
    else break;
  }
  if (idx < 3) return null;
  const delta = hourly.pressure_msl[idx] - hourly.pressure_msl[idx - 3];
  if (delta < -2.0) return { label: 'Falling Fast', state: 'falling-fast' };
  if (delta < -1.0) return { label: 'Falling', state: 'falling' };
  if (delta > 1.0)  return { label: 'Rising', state: 'rising' };
  return { label: 'Stable', state: 'stable' };
}

function synthesizeConditionSummary(current, hourly) {
  if (!current) return null;

  // Pressure direction — reuse computePressureTrend logic
  const trend = computePressureTrend(hourly);
  const pressureLabel = trend ? trend.label : null; // e.g. "Rising", "Stable", …

  // Recent precipitation
  const precip = current.precipitation;
  let precipLabel;
  if (precip == null) {
    precipLabel = null;
  } else if (precip === 0) {
    precipLabel = 'dry';
  } else if (precip < 1) {
    precipLabel = 'light showers';
  } else {
    precipLabel = 'rain';
  }

  // Wind speed bucket — reuse #92 logic
  const windSpeed = current.wind_speed_10m;
  const bucket = getWindBucket(windSpeed);
  const windDir = current.wind_direction_10m;
  const cardinal = windDir != null ? degreesToCompass(windDir) : null;

  let windLabel;
  if (bucket === 'calm') windLabel = 'calm';
  else if (bucket === 'moderate') windLabel = cardinal ? `light ${cardinal} wind` : 'light wind';
  else if (bucket === 'strong') windLabel = cardinal ? `moderate ${cardinal} wind` : 'moderate wind';
  else if (bucket === 'stormy') windLabel = cardinal ? `strong ${cardinal} wind` : 'strong wind';
  else windLabel = null;

  // Overall verdict
  let verdict;
  if (bucket === 'stormy' || trend?.state === 'falling-fast') {
    verdict = 'poor conditions';
  } else if (trend?.state === 'rising' && precip === 0 && (bucket === 'calm' || bucket === 'moderate')) {
    verdict = 'favourable conditions';
  } else {
    verdict = 'mixed conditions';
  }

  // Build sentence — omit any segment that has no data
  const parts = [pressureLabel, precipLabel, windLabel].filter(Boolean);
  if (!parts.length) return null;

  return `${parts.join(', ')} — ${verdict}.`;
}

function renderConditionSummary(current, hourly) {
  const el = document.getElementById('condition-summary');
  if (!el) return;
  const text = synthesizeConditionSummary(current, hourly);
  const historyText = synthesizePressureHistory(hourly);
  if (text || historyText) {
    el.innerHTML = '';
    if (text) {
      const line1 = document.createElement('span');
      line1.textContent = text;
      el.appendChild(line1);
    }
    if (historyText) {
      if (text) el.appendChild(document.createElement('br'));
      const line2 = document.createElement('span');
      line2.className = 'condition-history';
      line2.textContent = historyText;
      el.appendChild(line2);
    }
    el.classList.remove('hidden');
  } else {
    el.innerHTML = '';
    el.classList.add('hidden');
  }
}

function renderPressureSparkline(hourly) {
  const el = document.getElementById('pressure-sparkline');
  if (!el) return;
  if (!hourly?.pressure_msl || !hourly?.time) { el.innerHTML = ''; return; }

  const nowISO = new Date()
    .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
    .slice(0, 16)
    .replace(' ', 'T');
  let boundaryIndex = hourly.time.findIndex((t) => t >= nowISO);
  if (boundaryIndex === -1) boundaryIndex = hourly.time.length;

  const values = hourly.pressure_msl
    .slice(Math.max(0, boundaryIndex - 48), boundaryIndex)
    .filter((v) => v != null);
  if (values.length < 2) { el.innerHTML = ''; return; }

  const W = 72;
  const H = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`)
    .join(' ');
  el.innerHTML =
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">` +
    `<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
}

function renderWeather(current) {
  _currentData = current; // #131 — cache for unified wind modal re-render
  window._windUnifiedCurrentData = current; // exposed to js/wind-unified.js
  document.getElementById('temperature').textContent = current.temperature_2m ?? '–';
  document.getElementById('apparent-temperature').textContent = current.apparent_temperature ?? '–';
  document.getElementById('humidity').textContent = current.relative_humidity_2m ?? '–';
  document.getElementById('pressure-msl').textContent = current.pressure_msl ?? '–';
  const trend = computePressureTrend(hourlyData);
  const trendEl = document.getElementById('pressure-trend');
  if (trendEl) {
    if (trend) {
      trendEl.dataset.state = trend.state;
      trendEl.textContent = trend.label;
    } else {
      trendEl.dataset.state = '';
      trendEl.textContent = '–';
    }
  }
  document.getElementById('precipitation').textContent = current.precipitation ?? '–';
  const windSpeedEl = document.getElementById('wind-speed');
  windSpeedEl.textContent = current.wind_speed_10m ?? '–';
  // Apply wind bucket colour (#92)
  const windBucket = getWindBucket(current.wind_speed_10m);
  windSpeedEl.dataset.windBucket = windBucket ?? '';
  const windDir = current.wind_direction_10m;
  document.getElementById('wind-direction').textContent =
    windDir != null ? degreesToCompass(windDir) : '–';
  const arrowHost = document.getElementById('wind-direction-arrow');
  if (arrowHost) {
    arrowHost.innerHTML =
      windDir != null ? window.WindDirection.renderArrowSvg(windDir, { size: 24 }) : '';
  }
  document.getElementById('last-updated').textContent = current.time
    ? formatTimestamp(current.time)
    : '–';

  const headerUpdatedEl = document.querySelector('.header-updated');
  if (headerUpdatedEl && current.time) {
    const dataTime = new Date(current.time.replace('T', ' ') + ':00');
    const ageMs = Date.now() - dataTime.getTime();
    const isStale = ageMs > STALE_THRESHOLD_MS;
    headerUpdatedEl.dataset.stale = isStale ? 'true' : 'false';
    if (isStale) {
      const ageH = Math.floor(ageMs / 3600000);
      const ageM = Math.floor((ageMs % 3600000) / 60000);
      headerUpdatedEl.title = `Last update ${ageH}h ${ageM}m ago`;
    } else {
      headerUpdatedEl.title = '';
    }
  }

  document.getElementById('weather-grid').classList.remove('hidden');
  renderPressureSparkline(hourlyData);
  renderHourlyRibbon(hourlyData);
  renderConditionSummary(current, hourlyData);
  renderWindCompassDial(current);
  renderWindVerdict(hourlyData);
  renderWindMicroStrip(hourlyData);
}

async function loadWeather() {
  try {
    const response = await fetch('./data/weather.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.current) throw new Error('Missing current block');

    hourlyData = data.hourly || null;
    window.hourlyData = hourlyData; // consumed by js/pressure-inline.js
    renderWeather(data.current);
    initDetails();
    window.PressureInline?.render();
  } catch (err) {
    console.error('Failed to load weather data:', err);
    showError();
  }
}

document.querySelectorAll('.card--clickable').forEach((card) => {
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      card.click();
    }
  });
});

loadWeather();
