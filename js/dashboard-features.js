// #102 — details tier toggle with localStorage persistence
function toggleDetails() {
  const panel = document.getElementById('details-panel');
  const btn = document.getElementById('details-toggle');
  if (!panel || !btn) return;
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  const next = !expanded;
  btn.setAttribute('aria-expanded', String(next));
  btn.querySelector('.details-toggle__label').textContent = next ? 'Show less' : 'Show more';
  btn.querySelector('.details-toggle__icon').textContent = next ? '▾' : '▸';
  if (next) {
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
  localStorage.setItem('detailsExpanded', String(next));
}

function initDetails() {
  const saved = localStorage.getItem('detailsExpanded');
  if (saved === 'true') {
    const panel = document.getElementById('details-panel');
    const btn = document.getElementById('details-toggle');
    if (!panel || !btn) return;
    btn.setAttribute('aria-expanded', 'true');
    btn.querySelector('.details-toggle__label').textContent = 'Show less';
    btn.querySelector('.details-toggle__icon').textContent = '▾';
    panel.classList.remove('hidden');
  }
}

// #104 — pressure history narrative (last 24–48h)
function synthesizePressureHistory(hourly) {
  if (!hourly?.time || !hourly?.pressure_msl) return null;

  const nowISO = new Date()
    .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
    .slice(0, 16)
    .replace(' ', 'T');

  let nowIdx = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    if (hourly.time[i] <= nowISO) nowIdx = i;
    else break;
  }
  if (nowIdx < 0) return null;

  const now = hourly.pressure_msl[nowIdx];
  if (now == null) return null;

  const idx24 = Math.max(0, nowIdx - 24);
  const idx48 = Math.max(0, nowIdx - 48);
  const p24 = hourly.pressure_msl[idx24];
  const p48 = hourly.pressure_msl[idx48];

  if (p24 == null || p48 == null) return null;

  const delta24 = now - p24;
  const delta48 = now - p48;
  const THRESHOLD = 2.0;

  if (Math.abs(delta48) < THRESHOLD) return 'Stable for two days.';
  if (Math.abs(delta24) < THRESHOLD) return 'Stable since yesterday.';
  if (delta24 >= THRESHOLD && delta48 >= THRESHOLD) return 'Improving since two days ago.';
  if (delta24 >= THRESHOLD) return 'Improving since yesterday.';
  if (delta48 <= -THRESHOLD && delta24 <= -THRESHOLD) return 'Pressure has been falling for two days.';
  return 'Pressure dropped overnight.';
}

// #103 — 16-sector wind rose SVG driven by last 24h of hourly direction data
function renderWindRose(hourly) {
  const el = document.getElementById('wind-rose');
  if (!el) return;
  if (!hourly?.wind_direction_10m || !hourly?.time) { el.innerHTML = ''; return; }

  const nowISO = new Date()
    .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
    .slice(0, 16)
    .replace(' ', 'T');
  let boundaryIndex = hourly.time.findIndex((t) => t >= nowISO);
  if (boundaryIndex === -1) boundaryIndex = hourly.time.length;

  const slice = hourly.wind_direction_10m.slice(Math.max(0, boundaryIndex - 24), boundaryIndex);
  if (slice.length === 0) { el.innerHTML = ''; return; }

  const SECTORS = 16;
  const counts = new Array(SECTORS).fill(0);
  for (const deg of slice) {
    if (deg == null) continue;
    const sector = Math.round(deg / (360 / SECTORS)) % SECTORS;
    counts[sector]++;
  }

  const maxCount = Math.max(...counts, 1);
  const SIZE = 70;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const maxR = SIZE / 2 - 4;
  const minR = 3;
  const angleStep = (2 * Math.PI) / SECTORS;
  const halfAngle = angleStep / 2;

  let paths = '';
  for (let i = 0; i < SECTORS; i++) {
    if (counts[i] === 0) continue;
    const r = minR + ((counts[i] / maxCount) * (maxR - minR));
    const startAngle = i * angleStep - halfAngle - Math.PI / 2;
    const endAngle = startAngle + angleStep;
    const x1 = cx + Math.cos(startAngle) * r;
    const y1 = cy + Math.sin(startAngle) * r;
    const x2 = cx + Math.cos(endAngle) * r;
    const y2 = cy + Math.sin(endAngle) * r;
    const opacity = 0.5 + 0.5 * (counts[i] / maxCount);
    paths +=
      `<path d="M${cx.toFixed(1)},${cy.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 0,1 ${x2.toFixed(1)},${y2.toFixed(1)} Z"` +
      ` fill="currentColor" opacity="${opacity.toFixed(2)}"/>`;
  }

  el.innerHTML =
    `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true" class="wind-rose-svg">` +
    `<circle cx="${cx}" cy="${cy}" r="${maxR}" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.2"/>` +
    paths +
    `</svg>`;
}

// #101 — next 12 forecast hours: hour, temp, precip dot, pressure direction icon
function renderHourlyRibbon(hourly) {
  const el = document.getElementById('hourly-ribbon');
  if (!el) return;
  if (!hourly?.time || !hourly?.temperature_2m || !hourly?.precipitation || !hourly?.pressure_msl) {
    return;
  }

  const nowISO = new Date()
    .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
    .slice(0, 16)
    .replace(' ', 'T');
  let boundaryIndex = hourly.time.findIndex((t) => t >= nowISO);
  if (boundaryIndex === -1) boundaryIndex = hourly.time.length;

  const HOURS = 12;
  const endIndex = Math.min(hourly.time.length, boundaryIndex + HOURS);
  if (boundaryIndex >= hourly.time.length) return;

  function getPressureIcon(idx) {
    if (idx < 3) return '';
    const delta = hourly.pressure_msl[idx] - hourly.pressure_msl[idx - 3];
    if (delta > 1.0) return '↑';
    if (delta < -1.0) return '↓';
    return '→';
  }

  function getPrecipDot(precip) {
    if (precip == null || precip === 0) return '<span class="ribbon-precip ribbon-precip--none" aria-label="No rain"></span>';
    if (precip < 0.5) return '<span class="ribbon-precip ribbon-precip--light" aria-label="Light rain"></span>';
    if (precip < 2) return '<span class="ribbon-precip ribbon-precip--moderate" aria-label="Moderate rain"></span>';
    return '<span class="ribbon-precip ribbon-precip--heavy" aria-label="Heavy rain"></span>';
  }

  let html = '';
  for (let i = boundaryIndex; i < endIndex; i++) {
    const hour = hourly.time[i].slice(11, 13) + ':00';
    const temp = hourly.temperature_2m[i] != null ? Math.round(hourly.temperature_2m[i]) : '–';
    const precip = hourly.precipitation[i];
    const pressureIcon = getPressureIcon(i);

    html +=
      `<div class="ribbon-col">` +
      `<span class="ribbon-hour">${hour}</span>` +
      `<span class="ribbon-temp">${temp}°</span>` +
      getPrecipDot(precip) +
      `<span class="ribbon-pressure-dir" aria-hidden="true">${pressureIcon}</span>` +
      `</div>`;
  }

  el.innerHTML = html;
  el.classList.remove('hidden');
}
