(function () {
  'use strict';

  const LS_KEY = 'alerts_cache';
  const SEVERITY_ORDER = { red: 3, orange: 2, yellow: 1, green: 0 };

  // ---- XSS helper ----
  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- SVG icons ----
  function _iconSvg(type) {
    const a =
      'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    switch (type) {
      case 'excellent':
        return `<svg ${a}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
      case 'wind':
        return `<svg ${a}><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`;
      case 'pressure':
        return `<svg ${a}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`;
      default:
        return `<svg ${a}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    }
  }

  // ---- Date formatting ----
  function _fmtDate(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '—';
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${M[d.getMonth()]}`;
  }

  // ---- Card renderer (#213) ----
  function renderAlertCard({ type, title, description, validFrom, validTo, severity }) {
    const from = _fmtDate(validFrom);
    const to = validTo ? _fmtDate(validTo) : null;
    const valid = to && to !== from ? `${from} – ${to}` : from;
    return `<article class="alert-card alert-card--${_esc(severity)}" role="listitem">
  <div class="alert-card__icon">${_iconSvg(type)}</div>
  <div class="alert-card__body">
    <span class="alert-card__title">${_esc(title)}</span>
    <span class="alert-card__desc">${_esc(description)}</span>
    <span class="alert-card__valid">${_esc(valid)}</span>
  </div>
  <span class="alert-card__badge alert-badge--${_esc(severity)}">${_esc(severity.toUpperCase())}</span>
</article>`;
  }

  // ---- computeAlerts (#214) ----
  function computeAlerts(hourlyData) {
    if (!hourlyData || !hourlyData.time) return [];

    const FS = window.FishingScore;
    const times = hourlyData.time;
    const pressures = hourlyData.pressure_msl || [];
    const gusts = hourlyData.wind_gusts_10m || [];
    const winds = hourlyData.wind_speed_10m || [];
    const windDirs = hourlyData.wind_direction_10m || [];
    const precip = hourlyData.precipitation || [];
    const n = times.length;
    const alerts = [];

    // 1. Excellent Conditions (GREEN) — daily avg fishing score ≥ 80
    if (FS) {
      const byDay = {};
      for (let i = 0; i < n; i++) {
        const day = times[i].slice(0, 10);
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(i);
      }
      for (const [day, indices] of Object.entries(byDay)) {
        const hourlyScores = indices.map((i) => {
          const p = pressures[i] ?? null;
          const pTrend = i >= 3 && pressures[i - 3] != null ? p - pressures[i - 3] : 0;
          const pressScore = FS.scorePressure(p, pTrend);
          const windScore = FS.scoreWind(winds[i] ?? null, gusts[i] ?? null, windDirs[i] ?? null);
          const precipScore = FS.scorePrecipitation(precip[i] ?? null, null);
          const score = FS.computeFishingScore({
            pressureScore: pressScore,
            windScore,
            moonScore: 60,
            precipScore,
          });
          return { score, time: times[i] };
        });
        const avgScore = Math.round(
          hourlyScores.reduce((s, h) => s + h.score, 0) / hourlyScores.length,
        );
        if (avgScore >= 80) {
          const best = FS.findBestWindow ? FS.findBestWindow(hourlyScores, 4) : null;
          const desc = best
            ? `Best window: ${best.startTime}–${best.endTime}`
            : 'Ideal fishing conditions throughout the day';
          alerts.push({
            id: `excellent-${day}`,
            type: 'excellent',
            title: 'Excellent Conditions',
            description: desc,
            validFrom: `${day}T00:00:00`,
            validTo: `${day}T23:59:59`,
            severity: 'green',
          });
        }
      }
    }

    // 2. High Wind Alert (YELLOW) — gusts > 40 km/h for ≥ 3 consecutive hours
    let runStart = -1;
    for (let i = 0; i <= n; i++) {
      const above = i < n && (gusts[i] ?? 0) > 40;
      if (above && runStart === -1) {
        runStart = i;
      } else if (!above && runStart !== -1) {
        const runLen = i - runStart;
        if (runLen >= 3) {
          const maxGust = Math.max(...gusts.slice(runStart, i).filter((g) => g != null));
          alerts.push({
            id: `wind-${times[runStart].slice(0, 13)}`,
            type: 'wind',
            title: 'High Wind Alert',
            description: `Gusts up to ${Math.round(maxGust)} km/h`,
            validFrom: times[runStart],
            validTo: times[i - 1],
            severity: 'yellow',
          });
        }
        runStart = -1;
      }
    }

    // 3. Pressure Drop (YELLOW) — pressure falls > 5 hPa over any 6-hour window
    let lastPressAlertEnd = -1;
    for (let i = 0; i + 6 < n; i++) {
      if (i <= lastPressAlertEnd) continue;
      const pStart = pressures[i];
      const pEnd = pressures[i + 6];
      if (pStart == null || pEnd == null) continue;
      const drop = pStart - pEnd;
      if (drop > 5) {
        alerts.push({
          id: `pressure-${times[i].slice(0, 13)}`,
          type: 'pressure',
          title: 'Pressure Drop',
          description: `−${drop.toFixed(1)} hPa over 6 hours`,
          validFrom: times[i],
          validTo: times[i + 6],
          severity: 'yellow',
        });
        lastPressAlertEnd = i + 6;
      }
    }

    // Sort: most severe first, then chronological
    alerts.sort((a, b) => {
      const sd = (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0);
      if (sd !== 0) return sd;
      return a.validFrom < b.validFrom ? -1 : 1;
    });

    return alerts;
  }

  // ---- localStorage cache ----
  function _saveCache(alerts) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(alerts));
    } catch {
      /* ignore */
    }
  }

  function _loadCache() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ---- Page render (#213) ----
  function _renderList(alerts) {
    const el = document.getElementById('alerts-list');
    if (!el) return;
    if (!alerts || !alerts.length) {
      el.innerHTML = `<div class="alerts__empty">
  <svg class="alerts__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
  <p class="alerts__empty-title">No active alerts</p>
  <p class="alerts__empty-hint">All conditions look calm for the next 14 days.</p>
</div>`;
      return;
    }
    el.innerHTML = alerts.map((a) => renderAlertCard(a)).join('');
  }

  // ---- Notification preference filter (#217) ----
  function _filterByPrefs(alerts) {
    if (!window.Prefs) return alerts;
    const { kmi, fishing } = window.Prefs.getPrefs().notifications;
    return alerts.filter((a) => {
      if (!fishing && a.type === 'excellent') return false;
      if (!kmi && a.type === 'kmi') return false;
      return true;
    });
  }

  // ---- Page init ----
  function initAlertsPage() {
    _renderList(_filterByPrefs(_loadCache()));
    if (window.hourlyData) {
      const fresh = computeAlerts(window.hourlyData);
      _saveCache(fresh);
      _renderList(_filterByPrefs(fresh));
    }
  }

  // ---- Routing ----
  function _onRoute() {
    if (location.hash === '#alerts') initAlertsPage();
  }

  window.addEventListener('hashchange', _onRoute);
  window.addEventListener('prefsChanged', function () {
    if (location.hash === '#alerts') initAlertsPage();
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _onRoute);
  } else {
    _onRoute();
  }

  window.Alerts = { computeAlerts, renderAlertCard, initAlertsPage, loadCache: _loadCache };
})();
