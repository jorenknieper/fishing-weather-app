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

function openPressureModal() {
  document.getElementById('pressure-modal').classList.remove('hidden');
  renderPressureChart(hourlyPressureData);
}

function closePressureModal() {
  document.getElementById('pressure-modal').classList.add('hidden');
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

  const startIndex = Math.max(0, boundaryIndex - 24);
  const endIndex = Math.min(hourly.time.length, boundaryIndex + 24);
  const splitAt = boundaryIndex - startIndex;

  const times = hourly.time.slice(startIndex, endIndex);
  const pressures = hourly.pressure_msl.slice(startIndex, endIndex);
  const labels = times.map(t => t.slice(11, 16));

  // splitAt is the shared boundary point — appears in both datasets to stay connected
  const pastData = pressures.map((v, i) => (i <= splitAt ? v : null));
  const forecastData = pressures.map((v, i) => (i >= splitAt ? v : null));

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#a0aec0' : '#718096';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

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
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: textColor, boxWidth: 20 } },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: {
          ticks: { color: textColor, maxTicksLimit: 8, maxRotation: 0 },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: textColor },
          grid: { color: gridColor },
          title: { display: true, text: 'hPa', color: textColor },
        },
      },
    },
  });
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
