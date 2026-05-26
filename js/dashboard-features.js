// #120 — pure helper: summarise directional change over a window of forecast hours
function computeWindRotation(hourlyDir, fromIdx, windowHours) {
  const fallback = { verdict: 'steady', netDegrees: 0, variance: 0 };
  if (!Array.isArray(hourlyDir) || hourlyDir.length === 0) return fallback;
  if (fromIdx == null || fromIdx < 0 || fromIdx >= hourlyDir.length) return fallback;
  const endIdx = Math.min(hourlyDir.length, fromIdx + windowHours);
  if (endIdx <= fromIdx) return fallback;

  // Collect valid samples and compute shortest-arc deltas from first reading
  const first = hourlyDir[fromIdx];
  if (first == null) return fallback;

  const deltas = [];
  for (let i = fromIdx + 1; i < endIdx; i++) {
    const d = hourlyDir[i];
    if (d == null) continue;
    let diff = d - hourlyDir[i - 1];
    // Wrap to [-180, 180]
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    deltas.push(diff);
  }

  if (deltas.length === 0) return fallback;

  const netDegrees = deltas.reduce((sum, v) => sum + v, 0);
  const mean = netDegrees / deltas.length;
  const variance = deltas.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / deltas.length;

  let verdict;
  if (variance < 5) {
    verdict = 'steady';
  } else if (Math.abs(netDegrees) < 5) {
    verdict = 'shifting';
  } else if (netDegrees > 0) {
    verdict = 'veering';
  } else {
    verdict = 'backing';
  }

  return { verdict, netDegrees, variance };
}

// #121 — meteorological barb SVG primitive; shaft encodes wind-FROM direction
function renderWindBarb(dirFromDeg, speedKt, { size = 48 } = {}) {
  const cx = size / 2;
  const cy = size / 2;

  // Calm: <3 kt renders as a small open circle per WMO convention
  if (speedKt == null || speedKt < 3) {
    const r = size * 0.12;
    return (
      `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" ` +
      `focusable="false" aria-hidden="true">` +
      `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" ` +
      `fill="none" stroke="currentColor" stroke-width="1.5"/>` +
      `</svg>`
    );
  }

  // Shaft runs from centre to top of viewBox; feathers hang from the upwind (top) end.
  // Rotation maps wind-FROM direction: 0°=N shaft points up, 90°=E shaft points right, etc.
  const rotation = ((dirFromDeg % 360) + 360) % 360;

  // Geometry constants (relative to size)
  const shaftLen = size * 0.42;
  const barbW = size * 0.22;   // horizontal reach of a full feather
  const barbStep = size * 0.07; // vertical spacing between feathers
  const pennantH = size * 0.13; // pennant triangle height along shaft

  const shaftTop = cy - shaftLen; // y of upwind tip in un-rotated coords
  const shaftBot = cy;            // y of downwind tip (centre)

  // Decompose speed into pennants / full feathers / half feathers
  let remaining = Math.round(speedKt);
  const pennants = Math.floor(remaining / 50);
  remaining -= pennants * 50;
  const fulls = Math.floor(remaining / 10);
  remaining -= fulls * 10;
  const halves = Math.floor(remaining / 5);

  const paths = [];

  // Draw shaft
  paths.push(
    `<line x1="${cx.toFixed(1)}" y1="${shaftBot.toFixed(1)}" ` +
    `x2="${cx.toFixed(1)}" y2="${shaftTop.toFixed(1)}" ` +
    `stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`
  );

  // Feathers stack from upwind tip downward
  let yOff = shaftTop;

  // Pennants (filled triangles)
  for (let p = 0; p < pennants; p++) {
    const yBase = yOff + pennantH;
    paths.push(
      `<polygon points="${cx.toFixed(1)},${yOff.toFixed(1)} ` +
      `${(cx + barbW).toFixed(1)},${((yOff + yBase) / 2).toFixed(1)} ` +
      `${cx.toFixed(1)},${yBase.toFixed(1)}" ` +
      `fill="currentColor"/>`
    );
    yOff = yBase + barbStep * 0.3;
  }

  // Full feathers
  for (let f = 0; f < fulls; f++) {
    paths.push(
      `<line x1="${cx.toFixed(1)}" y1="${yOff.toFixed(1)}" ` +
      `x2="${(cx + barbW).toFixed(1)}" y2="${(yOff + barbStep * 0.8).toFixed(1)}" ` +
      `stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`
    );
    yOff += barbStep;
  }

  // Half feather
  for (let h = 0; h < halves; h++) {
    paths.push(
      `<line x1="${cx.toFixed(1)}" y1="${yOff.toFixed(1)}" ` +
      `x2="${(cx + barbW * 0.5).toFixed(1)}" y2="${(yOff + barbStep * 0.4).toFixed(1)}" ` +
      `stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`
    );
    yOff += barbStep;
  }

  return (
    `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" ` +
    `style="transform: rotate(${rotation}deg);" focusable="false" aria-hidden="true">` +
    paths.join('') +
    `</svg>`
  );
}

// #123/#124 — compass bezel with optional barb + speed/gust overlay
function renderWindCompassDial(current) {
  const el = document.getElementById('wind-compass-dial');
  if (!el) return;

  const SIZE = 120;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = SIZE / 2 - 6;      // bezel radius
  const tickOuter = R;
  const tickInnerMajor = R - 10; // major tick (cardinal) length
  const tickInnerMinor = R - 6;  // minor tick (intercardinal) length
  const labelR = R - 16;         // radius for N/E/S/W label centres

  // Cardinals: angle in degrees from 12-o'clock, clockwise
  const cardinals = [
    { label: 'N', angle: 0 },
    { label: 'E', angle: 90 },
    { label: 'S', angle: 180 },
    { label: 'W', angle: 270 },
  ];
  const intercardinalAngles = [45, 135, 225, 315];

  function toXY(angleDeg, r) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  let svg = `<svg class="wind-compass-svg" viewBox="0 0 ${SIZE} ${SIZE}" ` +
    `focusable="false" aria-hidden="true">`;

  // Bezel circle
  svg += `<circle cx="${cx}" cy="${cy}" r="${R}" ` +
    `fill="none" stroke="var(--border-subtle)" stroke-width="1.5"/>`;

  // Cardinal major ticks + labels
  for (const { label, angle } of cardinals) {
    const outer = toXY(angle, tickOuter);
    const inner = toXY(angle, tickInnerMajor);
    svg += `<line x1="${outer.x.toFixed(1)}" y1="${outer.y.toFixed(1)}" ` +
      `x2="${inner.x.toFixed(1)}" y2="${inner.y.toFixed(1)}" ` +
      `stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round"/>`;
    const lp = toXY(angle, labelR);
    svg += `<text x="${lp.x.toFixed(1)}" y="${lp.y.toFixed(1)}" ` +
      `text-anchor="middle" dominant-baseline="central" ` +
      `font-size="10" font-weight="600" fill="var(--text-muted)">${label}</text>`;
  }

  // Intercardinal minor ticks
  for (const angle of intercardinalAngles) {
    const outer = toXY(angle, tickOuter);
    const inner = toXY(angle, tickInnerMinor);
    svg += `<line x1="${outer.x.toFixed(1)}" y1="${outer.y.toFixed(1)}" ` +
      `x2="${inner.x.toFixed(1)}" y2="${inner.y.toFixed(1)}" ` +
      `stroke="var(--border-subtle)" stroke-width="1" stroke-linecap="round"/>`;
  }

  // Centre reserve: subtle circle for speed number area
  svg += `<circle cx="${cx}" cy="${cy}" r="${SIZE * 0.22}" ` +
    `fill="var(--bg-base)" stroke="var(--border-subtle)" stroke-width="0.75" opacity="0.6"/>`;

  // #124 — barb arrow + speed/gust text overlaid in the dial centre
  if (current) {
    const speedKmh = current.wind_speed_10m;
    const gustKmh = current.wind_gusts_10m;
    const dirDeg = current.wind_direction_10m;
    const speedKt = speedKmh != null ? speedKmh * 0.539957 : null;

    // Barb: rendered as a rotated group centred on the SVG
    if (dirDeg != null && speedKt != null) {
      const barbSize = SIZE * 0.55; // barb fits within the inner bezel area
      const rotation = ((dirDeg % 360) + 360) % 360;
      const offset = (SIZE - barbSize) / 2;
      // Build barb path elements at origin, then translate+rotate into centre
      svg += `<g transform="translate(${offset.toFixed(1)},${offset.toFixed(1)}) rotate(${rotation},${(barbSize/2).toFixed(1)},${(barbSize/2).toFixed(1)})" ` +
        `color="var(--accent-wind)">`;
      svg += _windBarbPaths(speedKt, barbSize);
      svg += `</g>`;
    }

    // Speed label (large) — positioned slightly above centre
    const speedLabel = speedKmh != null ? Math.round(speedKmh) : '–';
    svg += `<text x="${cx.toFixed(1)}" y="${(cy - 3).toFixed(1)}" ` +
      `text-anchor="middle" dominant-baseline="auto" ` +
      `font-size="11" font-weight="700" fill="var(--accent-wind)">${speedLabel}</text>`;

    // Gust label — positioned below centre
    const gustLabel = gustKmh != null ? Math.round(gustKmh) : '–';
    const gustFactor = (speedKmh != null && gustKmh != null && speedKmh > 0)
      ? gustKmh / speedKmh : 0;
    const gustColor = gustFactor > 1.5 ? 'var(--wind-stormy)' : 'var(--text-muted)';
    svg += `<text x="${cx.toFixed(1)}" y="${(cy + 8).toFixed(1)}" ` +
      `text-anchor="middle" dominant-baseline="auto" ` +
      `font-size="8" fill="${gustColor}">G ${gustLabel}</text>`;
  } else {
    // No data — centre reserve still shown, no overlay
  }

  svg += `</svg>`;
  el.innerHTML = svg;
}

// Internal helper: barb shaft + feather path elements for embedding inside a parent SVG group.
// The barb is drawn un-rotated (pointing up), sized to `size`. Caller applies rotation.
function _windBarbPaths(speedKt, size) {
  const cx = size / 2;
  const cy = size / 2;

  if (speedKt < 3) {
    const r = size * 0.12;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" ` +
      `fill="none" stroke="currentColor" stroke-width="1.5"/>`;
  }

  const shaftLen = size * 0.42;
  const barbW = size * 0.22;
  const barbStep = size * 0.07;
  const pennantH = size * 0.13;
  const shaftTop = cy - shaftLen;
  const shaftBot = cy;

  let remaining = Math.round(speedKt);
  const pennants = Math.floor(remaining / 50);
  remaining -= pennants * 50;
  const fulls = Math.floor(remaining / 10);
  remaining -= fulls * 10;
  const halves = Math.floor(remaining / 5);

  let paths = `<line x1="${cx.toFixed(1)}" y1="${shaftBot.toFixed(1)}" ` +
    `x2="${cx.toFixed(1)}" y2="${shaftTop.toFixed(1)}" ` +
    `stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;

  let yOff = shaftTop;
  for (let p = 0; p < pennants; p++) {
    const yBase = yOff + pennantH;
    paths += `<polygon points="${cx.toFixed(1)},${yOff.toFixed(1)} ` +
      `${(cx + barbW).toFixed(1)},${((yOff + yBase) / 2).toFixed(1)} ` +
      `${cx.toFixed(1)},${yBase.toFixed(1)}" fill="currentColor"/>`;
    yOff = yBase + barbStep * 0.3;
  }
  for (let f = 0; f < fulls; f++) {
    paths += `<line x1="${cx.toFixed(1)}" y1="${yOff.toFixed(1)}" ` +
      `x2="${(cx + barbW).toFixed(1)}" y2="${(yOff + barbStep * 0.8).toFixed(1)}" ` +
      `stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;
    yOff += barbStep;
  }
  for (let h = 0; h < halves; h++) {
    paths += `<line x1="${cx.toFixed(1)}" y1="${yOff.toFixed(1)}" ` +
      `x2="${(cx + barbW * 0.5).toFixed(1)}" y2="${(yOff + barbStep * 0.4).toFixed(1)}" ` +
      `stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;
    yOff += barbStep;
  }
  return paths;
}

// #125 — wind verdict word rendered below the dial
function renderWindVerdict(hourly) {
  const el = document.getElementById('wind-verdict');
  if (!el) return;
  if (!hourly?.wind_direction_10m || !hourly?.time) {
    el.textContent = '–';
    el.dataset.verdict = '';
    return;
  }

  const nowISO = new Date()
    .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
    .slice(0, 16)
    .replace(' ', 'T');
  let nowIdx = -1;
  for (let i = 0; i < hourly.time.length; i++) {
    if (hourly.time[i] <= nowISO) nowIdx = i;
    else break;
  }
  if (nowIdx < 0) { el.textContent = '–'; el.dataset.verdict = ''; return; }

  const hoursLeft = hourly.wind_direction_10m.length - nowIdx;
  if (hoursLeft < 6) {
    el.textContent = '–';
    el.dataset.verdict = '';
    return;
  }

  const { verdict } = computeWindRotation(hourly.wind_direction_10m, nowIdx, 24);
  el.textContent = verdict;
  el.dataset.verdict = verdict;
}

// #126 — 12h micro-barb strip below the wind dial
function renderWindMicroStrip(hourly) {
  const el = document.getElementById('wind-micro-strip');
  if (!el) return;
  if (!hourly?.time || !hourly?.wind_direction_10m || !hourly?.wind_speed_10m) {
    el.innerHTML = '';
    return;
  }

  const nowISO = new Date()
    .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
    .slice(0, 16)
    .replace(' ', 'T');
  let nowIdx = hourly.time.findIndex((t) => t >= nowISO);
  if (nowIdx === -1) nowIdx = hourly.time.length;

  const HOURS = 12;
  const BARB_SIZE = 24;
  let html = '';
  for (let i = 0; i < HOURS; i++) {
    const idx = nowIdx + i;
    if (idx >= hourly.time.length) break;
    const dir = hourly.wind_direction_10m[idx];
    const speedKmh = hourly.wind_speed_10m[idx];
    const speedKt = speedKmh != null ? speedKmh * 0.539957 : null;
    const hour = hourly.time[idx].slice(11, 16);
    const cardinal = dir != null ? degreesToCompass(dir) : '–';
    const speedDisplay = speedKmh != null ? Math.round(speedKmh) : '–';
    const titleText = `${hour} — ${cardinal} ${speedDisplay} km/h`;
    const isNow = i === 0;
    const barbSvg = dir != null && speedKt != null
      ? renderWindBarb(dir, speedKt, { size: BARB_SIZE })
      : `<svg width="${BARB_SIZE}" height="${BARB_SIZE}" aria-hidden="true"></svg>`;
    html +=
      `<span class="wind-micro-barb${isNow ? ' wind-micro-barb--now' : ''}" title="${titleText}">` +
      barbSvg +
      `<span class="wind-micro-label">${isNow ? 'now' : hour}</span>` +
      `</span>`;
  }
  el.innerHTML = html;
}

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
