function degreesToCompass(degrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
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
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  updateThemeButton();
}

function updateThemeButton() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = isDark ? 'Light mode' : 'Dark mode';
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeButton();
}

initTheme();

let hourlyData = null;

function makeDayLabelsPlugin(times, textColor) {
  return {
    id: 'dayLabels',
    afterDraw(chart) {
      const scale = chart.scales.x;
      if (!scale) return;
      const { top, left, right } = chart.chartArea;
      const ctx = chart.ctx;
      const n = times.length;
      const visMin = scale.min;
      const visMax = scale.max;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      const midnights = [];
      for (let i = Math.max(0, Math.floor(visMin)); i <= Math.min(n - 1, Math.ceil(visMax)); i++) {
        if (times[i] && times[i].slice(11, 16) === '00:00') midnights.push(i);
      }

      const segments = [];
      let segStart = visMin;
      for (const m of midnights) {
        if (m > visMin) { segments.push([segStart, m]); segStart = m; }
      }
      segments.push([segStart, visMax]);

      ctx.save();
      ctx.beginPath();
      ctx.rect(left, 0, right - left, top);
      ctx.clip();
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const [start, end] of segments) {
        const midIdx = Math.max(0, Math.min(n - 1, Math.round((start + end) / 2)));
        const t = times[midIdx];
        if (!t) continue;
        const [year, month, day] = t.slice(0, 10).split('-');
        const label = `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
        const xStart = Math.max(left, scale.getPixelForValue(start));
        const xEnd = Math.min(right, scale.getPixelForValue(end));
        const xCenter = (xStart + xEnd) / 2;
        ctx.fillText(label, xCenter, top - 10);
      }

      ctx.restore();
    },
  };
}

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
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    // Accent color re-read on every call so dark-mode toggle takes effect immediately
    const accentColor = isDark ? config.colors.accentDark : config.colors.accentLight;

    // Background track
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, w, h);

    // Viewport window
    const scale = chart.scales.x;
    const denominator = Math.max(n - 1, 1);
    const rx = Math.max(0, (scale.min / denominator) * w);
    const rx2 = Math.min(w, (scale.max / denominator) * w);
    const rw = Math.max(2, rx2 - rx);

    ctx.fillStyle = isDark ? 'rgba(99,179,237,0.4)' : 'rgba(43,108,176,0.25)';
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
    const seriesKeys = config.series
      ? config.series.map(s => s.key)
      : ['pressure_msl'];

    if (!hourly || !hourly.time || typeof Chart === 'undefined' ||
        seriesKeys.some(k => !Array.isArray(hourly[k]))) {
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

    let boundaryIndex = hourly.time.findIndex(t => t >= nowISO);
    if (boundaryIndex === -1) boundaryIndex = hourly.time.length;

    const startIndex = Math.max(0, boundaryIndex - config.historyHours);
    const endIndex = Math.min(hourly.time.length, boundaryIndex + config.forecastHours);
    const splitAt = boundaryIndex - startIndex;

    const times = hourly.time.slice(startIndex, endIndex);
    const labels = times.map(t => t.slice(11, 16));

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#a0aec0' : '#718096';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const accentColor = isDark ? config.colors.accentDark : config.colors.accentLight;

    const { stepSize, snapTo, paddingBelow, paddingAbove, fallbackMin, fallbackMax, unit } = config.yAxis;

    const chartType = config.chartType || 'line';

    function buildDataset(label, data, color, isForecast) {
      if (chartType === 'bar') {
        return {
          label,
          data,
          backgroundColor: color,
          borderWidth: 0,
        };
      }
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
      if (isForecast) dataset.borderDash = [5, 5];
      return dataset;
    }

    let datasets;
    let allValid = [];

    if (config.series) {
      // Multi-series path
      datasets = [];
      for (const s of config.series) {
        const vals = hourly[s.key].slice(startIndex, endIndex);
        const pastData = vals.map((v, i) => (i <= splitAt ? v : null));
        const forecastData = vals.map((v, i) => (i >= splitAt ? v : null));
        allValid = allValid.concat(vals.filter(v => v != null));
        datasets.push(buildDataset(s.historicalLabel, pastData, s.historicalColor, false));
        datasets.push(buildDataset(s.forecastLabel, forecastData, s.forecastColor, true));
      }
      // Navigator uses first series for length reference
      navValues = hourly[config.series[0].key].slice(startIndex, endIndex);
    } else {
      // Single-series backwards-compat path
      const values = hourly.pressure_msl.slice(startIndex, endIndex);
      navValues = values;
      allValid = values.filter(v => v != null);
      const pastData = values.map((v, i) => (i <= splitAt ? v : null));
      const forecastData = values.map((v, i) => (i >= splitAt ? v : null));
      datasets = [
        buildDataset(config.historicalLabel, pastData, config.colors.historical, false),
        buildDataset(config.forecastLabel, forecastData, config.colors.forecast, true),
      ];
    }

    navSplitAt = splitAt;

    const yMin = allValid.length ? Math.floor((Math.min(...allValid) - paddingBelow) / snapTo) * snapTo : fallbackMin;
    const yMax = allValid.length ? Math.ceil((Math.max(...allValid) + paddingAbove) / snapTo) * snapTo : fallbackMax;

    if (chart) chart.destroy();

    chart = new Chart(canvas, {
      type: chartType,
      data: {
        labels,
        datasets,
      },
      plugins: [makeDayLabelsPlugin(times, textColor)],
      options: {
        responsive: true,
        maintainAspectRatio: true,
        layout: { padding: { top: 20 } },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: textColor, boxWidth: 20 } },
          tooltip: { mode: 'index', intersect: false },
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
              callback: function(value) {
                const t = times[value];
                if (!t) return undefined;
                const time = t.slice(11, 16);
                const visible = Math.round(this.max - this.min);
                if (visible > 168) return time === '00:00' ? time : undefined;
                if (visible > 96) return (time === '00:00' || time === '12:00') ? time : undefined;
                if (visible > 24) return value % 4 === 0 ? time : undefined;
                if (visible >= 8) return value % 2 === 0 ? time : undefined;
                return time;
              },
            },
            grid: {
              color: function(context) {
                const t = times[context.tick.value];
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

  function open() {
    document.getElementById(config.modalId).classList.remove('hidden');
    render();
  }

  function close() {
    document.getElementById(config.modalId).classList.add('hidden');
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

const pressureModal = createChartModal({
  modalId: 'pressure-modal',
  chartId: 'pressure-chart',
  navigatorId: 'pressure-navigator',
  noDataId: 'pressure-no-data',
  getData: () => hourlyData,
  series: [
    { key: 'pressure_msl', historicalLabel: 'Historical', forecastLabel: 'Forecast', historicalColor: '#2b6cb0', forecastColor: '#63b3ed' },
  ],
  colors: {
    accentLight: '#2b6cb0',
    accentDark: '#63b3ed',
  },
  yAxis: { unit: 'hPa', stepSize: 5, snapTo: 5, paddingBelow: 5, paddingAbove: 5, fallbackMin: 990, fallbackMax: 1040 },
  historyHours: 168,
  forecastHours: 168,
  initialViewportHours: 24,
  zoomMinRange: 4,
});

// Thin wrappers so index.html inline onclick handlers continue to work
function openPressureModal() { pressureModal.open(); }
function closePressureModal() { pressureModal.close(); }
function resetPressureChart() { pressureModal.reset(); }

const temperatureModal = createChartModal({
  modalId: 'temp-modal',
  chartId: 'temp-chart',
  navigatorId: 'temp-navigator',
  noDataId: 'temp-no-data',
  getData: () => hourlyData,
  series: [
    { key: 'temperature_2m', historicalLabel: 'Temperature', forecastLabel: 'Temperature (forecast)', historicalColor: '#c53030', forecastColor: '#fc8181' },
    { key: 'apparent_temperature', historicalLabel: 'Feels Like', forecastLabel: 'Feels Like (forecast)', historicalColor: '#dd6b20', forecastColor: '#f6ad55' },
  ],
  colors: { accentLight: '#c53030', accentDark: '#fc8181' },
  yAxis: { unit: '°C', stepSize: 5, snapTo: 5, paddingBelow: 2, paddingAbove: 2, fallbackMin: -10, fallbackMax: 35 },
  historyHours: 168,
  forecastHours: 168,
  initialViewportHours: 24,
  zoomMinRange: 4,
});

function openTemperatureModal() { temperatureModal.open(); }
function closeTemperatureModal() { temperatureModal.close(); }
function resetTemperatureChart() { temperatureModal.reset(); }

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (!document.getElementById('temp-modal').classList.contains('hidden')) closeTemperatureModal();
    else if (!document.getElementById('pressure-modal').classList.contains('hidden')) closePressureModal();
  }
});

function showError() {
  document.getElementById('error-message').classList.remove('hidden');
}

function renderWeather(current) {
  document.getElementById('temperature').textContent = current.temperature_2m ?? '–';
  document.getElementById('apparent-temperature').textContent = current.apparent_temperature ?? '–';
  document.getElementById('humidity').textContent = current.relative_humidity_2m ?? '–';
  document.getElementById('pressure-msl').textContent = current.pressure_msl ?? '–';
  document.getElementById('pressure-surface').textContent = current.surface_pressure ?? '–';
  document.getElementById('precipitation').textContent = current.precipitation ?? '–';
  document.getElementById('wind-speed').textContent = current.wind_speed_10m ?? '–';
  document.getElementById('wind-direction').textContent =
    current.wind_direction_10m != null
      ? degreesToCompass(current.wind_direction_10m)
      : '–';
  document.getElementById('last-updated').textContent =
    current.time ? formatTimestamp(current.time) : '–';

  document.getElementById('weather-grid').classList.remove('hidden');
}

async function loadWeather() {
  try {
    const response = await fetch('./data/weather.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.current) throw new Error('Missing current block');

    hourlyData = data.hourly || null;
    renderWeather(data.current);
  } catch (err) {
    console.error('Failed to load weather data:', err);
    showError();
  }
}

loadWeather();
