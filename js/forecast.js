(function () {
  // #190 — slug → phaseName for moonPhaseIcon()
  const SLUG_TO_PHASE = {
    'new-moon': 'New Moon',
    'waxing-crescent': 'Waxing Crescent',
    'first-quarter': 'First Quarter',
    'waxing-gibbous': 'Waxing Gibbous',
    'full-moon': 'Full Moon',
    'waning-gibbous': 'Waning Gibbous',
    'last-quarter': 'Last Quarter',
    'waning-crescent': 'Waning Crescent',
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function _degToAbbr(deg) {
    if (deg == null) return '–';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
  }

  // #190 — Transform forecast.json array into dayData objects for renderDailyForecastRow
  function computeDailyForecasts(forecastData) {
    if (!Array.isArray(forecastData)) return [];
    return forecastData.map(function (d) {
      return {
        date: d.date,
        dayName: d.dayName,
        fishingScore: d.fishingScore,
        scoreLabel: d.scoreLabel,
        moonPhase: SLUG_TO_PHASE[d.moonPhase] || 'New Moon',
        windDir: d.windDir,
        windSpeed: d.windSpeedKmh,
        precipMm: d.precipMm,
        bestWindow:
          d.bestWindowStart && d.bestWindowEnd
            ? { start: d.bestWindowStart, end: d.bestWindowEnd }
            : null,
      };
    });
  }

  // #187 — Render a single daily forecast row
  function renderDailyForecastRow(dayData) {
    const score = dayData.fishingScore;
    const variant =
      score >= 80 ? 'excellent' : score >= 65 ? 'good' : score >= 45 ? 'fair' : 'poor';

    const moonIcon = window.Moon ? window.Moon.moonPhaseIcon(dayData.moonPhase, 18) : '';

    const bestWin = dayData.bestWindow
      ? '<span class="fc-row__window fc-row__window--' +
        variant +
        '">' +
        dayData.bestWindow.start +
        '–' +
        dayData.bestWindow.end +
        '</span>'
      : '<span class="fc-row__window fc-row__window--none">–</span>';

    const parts = (dayData.date || '').split('-');
    const ddmmm =
      String(Number(parts[2])).padStart(2, '0') + ' ' + (MONTHS[Number(parts[1]) - 1] || '');

    const precip =
      dayData.precipMm != null ? Number(dayData.precipMm).toFixed(1) : '0.0';

    return (
      '<div class="fc-row" role="button" tabindex="0">' +
      '<div class="fc-row__day">' +
      '<span class="fc-row__dayname">' +
      dayData.dayName +
      '</span>' +
      '<span class="fc-row__date">' +
      ddmmm +
      '</span>' +
      '</div>' +
      '<span class="score-badge score-badge--' +
      variant +
      '">' +
      score +
      ' ' +
      dayData.scoreLabel +
      '</span>' +
      '<div class="fc-row__moon">' +
      moonIcon +
      '</div>' +
      '<div class="fc-row__wind">' +
      '<span class="fc-row__wind-dir">' +
      (dayData.windDir || '–') +
      '</span>' +
      '<span class="fc-row__wind-spd">' +
      (dayData.windSpeed != null ? dayData.windSpeed : '–') +
      ' km/h</span>' +
      '</div>' +
      '<div class="fc-row__precip">' +
      precip +
      ' mm</div>' +
      bestWin +
      '</div>'
    );
  }

  // #192 — Render next 48h hourly list with day separators and NOW marker
  function renderHourlyForecast(hourlyData) {
    if (!hourlyData || !hourlyData.time || !hourlyData.time.length) {
      return '<p class="fc-empty">No hourly data available.</p>';
    }
    const FS = window.FishingScore;
    const nowISO = new Date()
      .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
      .slice(0, 16)
      .replace(' ', 'T');

    let nowIdx = 0;
    for (let i = 0; i < hourlyData.time.length; i++) {
      if (hourlyData.time[i] <= nowISO) nowIdx = i;
      else break;
    }

    const end = Math.min(nowIdx + 49, hourlyData.time.length);
    const rows = [];
    let lastDay = null;

    for (let j = nowIdx; j < end; j++) {
      const t = hourlyData.time[j];
      const dayKey = t.slice(0, 10);

      if (dayKey !== lastDay) {
        lastDay = dayKey;
        const dp = dayKey.split('-');
        const dtLabel = new Date(Number(dp[0]), Number(dp[1]) - 1, Number(dp[2]));
        const dayLabel =
          WEEKDAYS[dtLabel.getDay()].toUpperCase() +
          ' ' +
          String(dtLabel.getDate()) +
          ' ' +
          MONTHS[dtLabel.getMonth()].toUpperCase();
        rows.push('<div class="fc-hour__day-sep">' + dayLabel + '</div>');
      }

      const isNow = j === nowIdx;
      const hhmm = t.slice(11, 16);
      const dateObj = new Date(t);

      const temp =
        hourlyData.temperature_2m != null ? hourlyData.temperature_2m[j] : null;
      const tempStr = temp != null ? Math.round(temp) + '°' : '–';
      const windSpd =
        hourlyData.wind_speed_10m != null ? Math.round(hourlyData.wind_speed_10m[j]) : null;
      const windDeg =
        hourlyData.wind_direction_10m != null ? hourlyData.wind_direction_10m[j] : null;
      const windSpdStr =
        windSpd != null ? _degToAbbr(windDeg) + ' ' + windSpd : '–';
      const precipVal = hourlyData.precipitation ? (hourlyData.precipitation[j] ?? 0) : 0;
      const precipStr = Number(precipVal).toFixed(1) + ' mm';

      let score = 50;
      let variant = 'fair';
      if (FS) {
        const pressure =
          hourlyData.pressure_msl != null ? hourlyData.pressure_msl[j] : null;
        const pressureTrend =
          hourlyData.pressure_msl != null && j >= 3
            ? hourlyData.pressure_msl[j] - hourlyData.pressure_msl[j - 3]
            : 0;
        const gusts =
          hourlyData.wind_gusts_10m != null ? hourlyData.wind_gusts_10m[j] : null;

        let moonData = {};
        let inMajor = false;
        let inMinor = false;
        if (window.Moon) {
          moonData = window.Moon.getMoonPhase(dateObj);
          const sol = window.Moon.getSolunarPeriods(dateObj);
          inMajor = sol.major.some(function (p) {
            return dateObj >= p.start && dateObj <= p.end;
          });
          inMinor = sol.minor.some(function (p) {
            return dateObj >= p.start && dateObj <= p.end;
          });
        }

        const pScore = FS.scorePressure(pressure, pressureTrend);
        const wScore = FS.scoreWind(windSpd, gusts, windDeg);
        const rScore = FS.scorePrecipitation(precipVal, null);
        const mScore = FS.scoreMoon(moonData.illumination, moonData.phaseName, inMajor, inMinor);
        score = FS.computeFishingScore({
          pressureScore: pScore,
          windScore: wScore,
          moonScore: mScore,
          precipScore: rScore,
        });
        variant = score >= 80 ? 'excellent' : score >= 65 ? 'good' : score >= 45 ? 'fair' : 'poor';
      }

      rows.push(
        '<div class="fc-hour-row' +
          (isNow ? ' fc-hour-row--now' : '') +
          '">' +
          '<span class="fc-hour__time">' +
          (isNow ? 'NOW' : hhmm) +
          '</span>' +
          '<span class="fc-hour__temp">' +
          tempStr +
          '</span>' +
          '<span class="fc-hour__wind">' +
          windSpdStr +
          ' <span class="fc-hour__wind-unit">km/h</span></span>' +
          '<span class="fc-hour__precip">' +
          precipStr +
          '</span>' +
          '<span class="score-badge score-badge--' +
          variant +
          '">' +
          score +
          '</span>' +
          '</div>',
      );
    }

    return '<div class="fc-hourly-list">' + rows.join('') + '</div>';
  }

  function _setupTabs(panel14, panelHr) {
    document.querySelectorAll('#forecast-tab-bar .fc-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#forecast-tab-bar .fc-tab-btn').forEach(function (b) {
          b.classList.remove('is-active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'true');

        if (btn.dataset.tab === '14days') {
          panel14.removeAttribute('hidden');
          panelHr.setAttribute('hidden', '');
          panel14.scrollTop = 0;
        } else {
          panel14.setAttribute('hidden', '');
          panelHr.removeAttribute('hidden');
          panelHr.scrollTop = 0;
          _ensureHourlyLoaded(panelHr);
        }
      });
    });
  }

  // #184 — Initialize forecast page (called once on first visit)
  function initForecastPage() {
    const pageEl = document.getElementById('page-forecast');
    if (!pageEl || pageEl.dataset.loaded === '1') return;
    pageEl.dataset.loaded = '1';

    const panel14 = document.getElementById('forecast-14days-panel');
    const panelHr = document.getElementById('forecast-hourly-panel');

    _setupTabs(panel14, panelHr);

    fetch('./data/forecast.json')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (raw) {
        const days = computeDailyForecasts(raw);
        panel14.innerHTML = days.length
          ? days.map(renderDailyForecastRow).join('')
          : '<p class="fc-empty">No forecast data available.</p>';
      })
      .catch(function () {
        panel14.innerHTML = '<p class="fc-empty">No forecast data available.</p>';
      });
  }

  function _ensureHourlyLoaded(panelEl) {
    if (panelEl.dataset.loaded === '1') return;
    panelEl.dataset.loaded = '1';

    const hourly = window.hourlyData;
    if (hourly && hourly.time && hourly.time.length) {
      panelEl.innerHTML = renderHourlyForecast(hourly);
      return;
    }

    fetch('./data/weather.json')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        panelEl.innerHTML = renderHourlyForecast(data.hourly || {});
      })
      .catch(function () {
        panelEl.innerHTML = '<p class="fc-empty">No hourly data available.</p>';
      });
  }

  function _onRouteChange() {
    if (location.hash === '#forecast') initForecastPage();
  }
  window.addEventListener('hashchange', _onRouteChange);
  _onRouteChange();

  window.Forecast = {
    computeDailyForecasts,
    renderDailyForecastRow,
    renderHourlyForecast,
    initForecastPage,
  };
})();
