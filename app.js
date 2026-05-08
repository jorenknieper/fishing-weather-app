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

let hourlyPressureData = null;
let pressureChartInstance = null;
let navPressures = null;
let navSplitAt = 0;
let navDragging = false;
let navDragStartX = null;
let navDragStartRange = null;
let initialMin = 0;
let initialMax = 0;

function drawNavigator() {
  const nav = document.getElementById('pressure-navigator');
  if (!nav || !navPressures || !pressureChartInstance) return;
  const w = nav.offsetWidth;
  const h = nav.offsetHeight;
  if (!w || !h) return;
  nav.width = w;
  nav.height = h;

  const ctx = nav.getContext('2d');
  const n = navPressures.length;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  // Background track
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, w, h);

  // Viewport window
  const scale = pressureChartInstance.scales.x;
  const denominator = Math.max(n - 1, 1);
  const rx = Math.max(0, (scale.min / denominator) * w);
  const rx2 = Math.min(w, (scale.max / denominator) * w);
  const rw = Math.max(2, rx2 - rx);

  ctx.fillStyle = isDark ? 'rgba(99,179,237,0.4)' : 'rgba(43,108,176,0.25)';
  ctx.fillRect(rx, 0, rw, h);
  ctx.strokeStyle = isDark ? '#63b3ed' : '#2b6cb0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rx + 0.75, 0.75, Math.max(0, rw - 1.5), Math.max(0, h - 1.5));
}

function setupNavigatorDrag() {
  const nav = document.getElementById('pressure-navigator');
  if (!nav) return;

  function getClientX(e) {
    return e.touches ? e.touches[0].clientX : e.clientX;
  }

  function onStart(e) {
    if (!pressureChartInstance || !navPressures) return;
    if (e.cancelable) e.preventDefault();
    navDragging = true;
    navDragStartX = getClientX(e) - nav.getBoundingClientRect().left;
    navDragStartRange = {
      min: pressureChartInstance.scales.x.min,
      max: pressureChartInstance.scales.x.max,
    };
    nav.style.cursor = 'grabbing';
  }

  function onMove(e) {
    if (!navDragging || !pressureChartInstance || !navPressures) return;
    if (e.cancelable) e.preventDefault();
    const currentX = getClientX(e) - nav.getBoundingClientRect().left;
    const deltaX = currentX - navDragStartX;
    const n = navPressures.length;
    const visibleRange = navDragStartRange.max - navDragStartRange.min;
    const deltaIndex = (deltaX / nav.offsetWidth) * n;
    const newMin = Math.max(0, Math.min(navDragStartRange.min + deltaIndex, n - 1 - visibleRange));
    const newMax = newMin + visibleRange;
    pressureChartInstance.options.scales.x.min = newMin;
    pressureChartInstance.options.scales.x.max = newMax;
    pressureChartInstance.update('none');
    drawNavigator();
  }

  function onEnd() {
    navDragging = false;
    nav.style.cursor = 'grab';
  }

  nav.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  nav.addEventListener('touchstart', onStart, { passive: false });
  nav.addEventListener('touchmove', onMove, { passive: false });
  nav.addEventListener('touchend', onEnd);
}

function openPressureModal() {
  document.getElementById('pressure-modal').classList.remove('hidden');
  renderPressureChart(hourlyPressureData);
}

function closePressureModal() {
  document.getElementById('pressure-modal').classList.add('hidden');
}

function resetPressureChart() {
  if (pressureChartInstance) {
    pressureChartInstance.resetZoom();
    if (typeof pressureChartInstance.zoomScale === 'function') {
      pressureChartInstance.zoomScale('x', { min: initialMin, max: initialMax }, 'none');
    } else {
      pressureChartInstance.options.scales.x.min = initialMin;
      pressureChartInstance.options.scales.x.max = initialMax;
      pressureChartInstance.update('none');
    }
    drawNavigator();
  }
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !document.getElementById('pressure-modal').classList.contains('hidden')) {
    closePressureModal();
  }
});

function renderPressureChart(hourly) {
  const canvas = document.getElementById('pressure-chart');
  const noData = document.getElementById('pressure-no-data');

  if (!hourly || !hourly.time || !hourly.pressure_msl || typeof Chart === 'undefined') {
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

  const startIndex = Math.max(0, boundaryIndex - 168);
  const endIndex = Math.min(hourly.time.length, boundaryIndex + 168);
  const splitAt = boundaryIndex - startIndex;

  const times = hourly.time.slice(startIndex, endIndex);
  const pressures = hourly.pressure_msl.slice(startIndex, endIndex);
  const labels = times.map(t => t.slice(11, 16));

  navPressures = pressures;
  navSplitAt = splitAt;

  // splitAt is the shared boundary point — appears in both datasets to stay connected
  const pastData = pressures.map((v, i) => (i <= splitAt ? v : null));
  const forecastData = pressures.map((v, i) => (i >= splitAt ? v : null));

  const valid = pressures.filter(v => v != null);
  const yMin = valid.length ? Math.floor((Math.min(...valid) - 5) / 5) * 5 : 990;
  const yMax = valid.length ? Math.ceil((Math.max(...valid) + 5) / 5) * 5 : 1040;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#a0aec0' : '#718096';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const accentColor = isDark ? '#63b3ed' : '#2b6cb0';

  if (pressureChartInstance) pressureChartInstance.destroy();

  pressureChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Historical',
          data: pastData,
          borderColor: '#2b6cb0',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          spanGaps: false,
          tension: 0.3,
        },
        {
          label: 'Forecast',
          data: forecastData,
          borderColor: '#63b3ed',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          spanGaps: false,
          tension: 0.3,
        },
      ],
    },
    plugins: [{
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
    }],
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: textColor, boxWidth: 20 } },
        tooltip: { mode: 'index', intersect: false },
        zoom: {
          limits: { x: { min: 0, max: times.length - 1, minRange: 4 } },
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
          ticks: { color: textColor, stepSize: 5 },
          grid: { color: gridColor },
          title: { display: true, text: 'hPa', color: textColor },
        },
      },
    },
  });

  initialMin = Math.max(0, splitAt - 24);
  initialMax = Math.min(times.length - 1, splitAt + 24);
  if (typeof pressureChartInstance.zoomScale === 'function') {
    pressureChartInstance.zoomScale('x', { min: initialMin, max: initialMax }, 'none');
  } else {
    pressureChartInstance.options.scales.x.min = initialMin;
    pressureChartInstance.options.scales.x.max = initialMax;
    pressureChartInstance.update('none');
  }

  requestAnimationFrame(drawNavigator);
}

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

    hourlyPressureData = data.hourly || null;
    renderWeather(data.current);
  } catch (err) {
    console.error('Failed to load weather data:', err);
    showError();
  }
}

loadWeather();
setupNavigatorDrag();
