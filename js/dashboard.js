// #181 — pressure 24h delta
function renderPressureDelta(hourly) {
  const el = document.getElementById('pressure-delta');
  if (!el || !hourly?.pressure_msl || !hourly?.time) return;
  const nowISO = new Date()
    .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
    .slice(0, 16)
    .replace(' ', 'T');
  let idx = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    if (hourly.time[i] <= nowISO) idx = i;
    else break;
  }
  if (idx < 24) {
    el.textContent = '';
    return;
  }
  const delta = hourly.pressure_msl[idx] - hourly.pressure_msl[idx - 24];
  const sign = delta >= 0 ? '+' : '';
  el.textContent = `${sign}${delta.toFixed(1)} hPa (24h)`;
}

// #181 — generic sparklines for temperature and humidity (last 12h of hourly data)
function renderSparkline(elId, values) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!values || values.length < 2) {
    el.innerHTML = '';
    return;
  }
  const W = 72;
  const H = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * W).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`,
    )
    .join(' ');
  el.innerHTML =
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">` +
    `<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
}

function renderMetricSparklines(hourly) {
  if (!hourly?.time) return;
  const nowISO = new Date()
    .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
    .slice(0, 16)
    .replace(' ', 'T');
  let boundaryIndex = hourly.time.findIndex((t) => t >= nowISO);
  if (boundaryIndex === -1) boundaryIndex = hourly.time.length;

  const tempVals = (hourly.temperature_2m || [])
    .slice(Math.max(0, boundaryIndex - 12), boundaryIndex)
    .filter((v) => v != null);
  renderSparkline('temperature-sparkline', tempVals);

  const humVals = (hourly.relative_humidity_2m || [])
    .slice(Math.max(0, boundaryIndex - 12), boundaryIndex)
    .filter((v) => v != null);
  renderSparkline('humidity-sparkline', humVals);
}

// #175 — Moon card
function renderMoonCard() {
  const el = document.getElementById('moon-card');
  if (!el || !window.Moon) return;
  const m = window.Moon.getMoonPhase(new Date());
  el.innerHTML =
    `<span class="label">Moon</span>` +
    window.Moon.moonPhaseIcon(m.phaseName, 40) +
    `<span class="moon-card__name">${m.phaseName}</span>` +
    `<span class="moon-card__illum">${m.illumination}% Illuminated</span>` +
    `<a class="card__link" href="#moon">View calendar →</a>`;
}

// #180 — KMI warnings card (reads report.json; falls back to computed check)
async function renderKmiCard() {
  const el = document.getElementById('kmi-card');
  if (!el) return;
  let status = 'GREEN';
  let summary = 'No active warnings';
  let ts = '–';
  try {
    const r = await (await fetch('./data/report.json')).json();
    status = (r.kmiStatus || 'GREEN').toUpperCase();
    summary = r.kmiSummary || 'No active warnings';
    ts = r.generatedAt ? formatTimestamp(r.generatedAt) : '–';
  } catch {
    // fallback: use computed alerts cache (#214), otherwise check current conditions
    if (window.Alerts) {
      const cached = window.Alerts.loadCache();
      const ORDER = { red: 3, orange: 2, yellow: 1, green: 0 };
      const worst = cached
        .filter((a) => a.severity !== 'green')
        .sort((a, b) => (ORDER[b.severity] || 0) - (ORDER[a.severity] || 0))[0];
      if (worst) {
        status = worst.severity.toUpperCase();
        summary = worst.title;
      }
    } else if (window.hourlyData && _currentData) {
      const gusts = _currentData.wind_gusts_10m ?? 0;
      const rain = _currentData.precipitation ?? 0;
      if (gusts > 55 || rain > 10) {
        status = 'ORANGE';
        summary = `Gusts ${Math.round(gusts)} km/h`;
      } else if (gusts > 35 || rain > 5) {
        status = 'YELLOW';
        summary = `Gusts ${Math.round(gusts)} km/h`;
      }
    }
  }
  el.innerHTML =
    `<span class="label">KMI Warnings</span>` +
    `<span class="kmi-badge kmi-badge--${status.toLowerCase()}">${status}</span>` +
    `<span class="kmi-card__status">${summary}</span>` +
    `<span class="kmi-card__ts">Updated ${ts}</span>`;
}

// #179 — Fishing score widget (reads today's score from report.json, computes radar scores client-side)
async function renderScoreWidget(current, hourly) {
  const el = document.getElementById('score-widget');
  if (!el) return;
  const FS = window.FishingScore;
  if (!FS) return;

  let score = 50;
  let label = 'FAIR';
  let windowStr = '';
  try {
    const r = await (await fetch('./data/report.json')).json();
    score = r.todayScore ?? 50;
    label = r.todayLabel ?? 'FAIR';
    if (r.bestWindowStart && r.bestWindowEnd) {
      windowStr = `${r.bestWindowStart}–${r.bestWindowEnd}`;
    }
  } catch {
    const trend = computePressureTrend(hourly);
    const trendDelta = (function () {
      if (!hourly?.pressure_msl || !hourly?.time) return 0;
      const nowISO = new Date()
        .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
        .slice(0, 16)
        .replace(' ', 'T');
      let idx = -1;
      for (let i = 0; i < hourly.time.length; i++) {
        if (hourly.time[i] <= nowISO) idx = i;
        else break;
      }
      return idx >= 3 ? hourly.pressure_msl[idx] - hourly.pressure_msl[idx - 3] : 0;
    })();
    const moon = window.Moon ? window.Moon.getMoonPhase(new Date()) : {};
    const pScore = FS.scorePressure(current.pressure_msl, trendDelta);
    const wScore = FS.scoreWind(
      current.wind_speed_10m,
      current.wind_gusts_10m,
      current.wind_direction_10m,
    );
    const rScore = FS.scorePrecipitation(current.precipitation, null);
    const mScore = FS.scoreMoon(moon.illumination, moon.phaseName, false, false);
    score = FS.computeFishingScore({
      pressureScore: pScore,
      windScore: wScore,
      moonScore: mScore,
      precipScore: rScore,
    });
    label = FS.scoreLabelFromValue(score).label;
  }

  const { label: _l, colour } = FS.scoreLabelFromValue(score);
  const variantClass = `score-widget__label--${colour === 'green' ? 'excellent' : colour === 'yellow' ? 'good' : colour === 'orange' ? 'fair' : 'poor'}`;

  el.innerHTML =
    `<span class="label">Fishing Score</span>` +
    `<div class="score-widget__body">` +
    `<div class="score-widget__info">` +
    `<span class="score-widget__num">${score}</span>` +
    `<span class="score-widget__label ${variantClass}">${label}</span>` +
    (windowStr
      ? `<span class="score-widget__window">&#128336; Best window ${windowStr}</span>`
      : '') +
    `</div>` +
    `<div class="score-widget__radar">` +
    `<canvas id="score-radar"></canvas>` +
    `</div>` +
    `</div>`;

  // Compute 5 component scores for the radar shape
  const nowISO = new Date()
    .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
    .slice(0, 16)
    .replace(' ', 'T');
  let pressureDelta3h = 0;
  if (hourly?.pressure_msl && hourly?.time) {
    let idx = -1;
    for (let i = 0; i < hourly.time.length; i++) {
      if (hourly.time[i] <= nowISO) idx = i;
      else break;
    }
    if (idx >= 3) pressureDelta3h = hourly.pressure_msl[idx] - hourly.pressure_msl[idx - 3];
  }
  const moonData = window.Moon ? window.Moon.getMoonPhase(new Date()) : {};
  const solData = window.Moon
    ? window.Moon.getSolunarPeriods(new Date())
    : { major: [], minor: [] };
  const now = new Date();
  const inMajor = solData.major.some((p) => now >= p.start && now <= p.end);
  const inMinor = solData.minor.some((p) => now >= p.start && now <= p.end);

  const radarScores = {
    pressure: FS.scorePressure(current.pressure_msl, pressureDelta3h),
    moon: FS.scoreMoon(moonData.illumination, moonData.phaseName, inMajor, inMinor),
    wind: FS.scoreWind(current.wind_speed_10m, current.wind_gusts_10m, current.wind_direction_10m),
    precipitation: FS.scorePrecipitation(current.precipitation, null),
    temperature: FS.scoreTemperature(current.temperature_2m),
  };

  // Small delay to ensure canvas is in the DOM
  requestAnimationFrame(() => FS.renderScoreRadar('score-radar', radarScores));

  // Store for theme re-render
  window._lastRadarScores = radarScores;
}

function openPressureInline() {
  const el = document.getElementById('pressure-inline');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  else if (bucket === 'strong')
    windLabel = cardinal ? `moderate ${cardinal} wind` : 'moderate wind';
  else if (bucket === 'stormy') windLabel = cardinal ? `strong ${cardinal} wind` : 'strong wind';
  else windLabel = null;

  // Overall verdict
  let verdict;
  if (bucket === 'stormy' || trend?.state === 'falling-fast') {
    verdict = 'poor conditions';
  } else if (
    trend?.state === 'rising' &&
    precip === 0 &&
    (bucket === 'calm' || bucket === 'moderate')
  ) {
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

// #178 — 7-day forecast mini-strip
function renderForecastMiniStrip(days) {
  const el = document.getElementById('forecast-mini-strip');
  if (!el || !days || !days.length) return;
  const FS = window.FishingScore;
  el.innerHTML = days
    .slice(0, 7)
    .map((d) => {
      const dateObj = new Date(d.date + 'T12:00:00');
      const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const badge = FS ? FS.renderScoreBadge(d.fishingScore, d.scoreLabel) : '';
      const icon = d.moonPhase
        ? `<img src="img/moon-${d.moonPhase}.svg" width="16" height="16" alt="" class="moon-icon" loading="lazy">`
        : '';
      const wind = d.windDir && d.windSpeedKmh != null ? `${d.windDir} ${d.windSpeedKmh}` : '–';
      const precip = d.precipMm != null ? `${d.precipMm} mm` : '–';
      return `<div class="fc-col">
      <span class="fc-day">${d.dayName}</span>
      <span class="fc-date">${dateStr}</span>
      ${badge}
      ${icon}
      <span class="fc-wind">${wind}</span>
      <span class="fc-precip">${precip}</span>
    </div>`;
    })
    .join('');
}
