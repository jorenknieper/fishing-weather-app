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

    renderWeather(data.current);
  } catch (err) {
    console.error('Failed to load weather data:', err);
    showError();
  }
}

loadWeather();
