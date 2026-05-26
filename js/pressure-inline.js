/**
 * pressure-inline.js — Inline pressure chart for the main page (#100).
 *
 * Loaded after app.js so it can reference cssVar, makeDayLabelsPlugin,
 * makeNowLinePlugin, makeExternalTooltipHandler, setupDoubleTap, and
 * _themeRerenderCallbacks directly as globals defined in app.js.
 *
 * Exposes window.PressureInline = { render, reset }.
 */
(function () {
  function createInlinePressureChart(config) {
    let chart = null;
    let navValues = null;
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
      const accentColor = cssVar(config.colors.accentToken);
      ctx.fillStyle = cssVar('--nav-track');
      ctx.fillRect(0, 0, w, h);
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
        dragStartRange = { min: chart.scales.x.min, max: chart.scales.x.max };
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
      const inlineSection = document.getElementById('pressure-inline');
      const hourly = config.getData();
      const seriesKeys = config.series.map((s) => s.key);
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
      if (inlineSection) inlineSection.classList.remove('hidden');

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

      const datasets = [];
      let allValid = [];
      for (const s of config.series) {
        const vals = hourly[s.key].slice(startIndex, endIndex);
        allValid = allValid.concat(vals.filter((v) => v != null));
        const histColor =
          typeof s.historicalColor === 'function' ? s.historicalColor() : s.historicalColor;
        const fcastColor =
          typeof s.forecastColor === 'function' ? s.forecastColor() : s.forecastColor;
        const pastData = vals.map((v, i) => (i <= splitAt ? v : null));
        const forecastData = vals.map((v, i) => (i >= splitAt ? v : null));
        const histDs = buildDataset(s.historicalLabel, pastData, histColor, false, !!s.alwaysDash);
        const fcastDs = buildDataset(
          s.forecastLabel,
          forecastData,
          fcastColor,
          true,
          !!s.alwaysDash,
        );
        if (s.order != null) {
          histDs.order = s.order;
          fcastDs.order = s.order;
        }
        datasets.push(histDs, fcastDs);
      }
      navValues = hourly[config.series[0].key].slice(startIndex, endIndex);

      const yMin = allValid.length
        ? Math.floor((Math.min(...allValid) - paddingBelow) / snapTo) * snapTo
        : fallbackMin;
      const yMax = allValid.length
        ? Math.ceil((Math.max(...allValid) + paddingAbove) / snapTo) * snapTo
        : fallbackMax;

      if (chart) {
        try {
          chart.destroy();
        } catch {
          /* ignore */
        }
        chart = null;
      }

      try {
        chart = new Chart(canvas, {
          type: 'line',
          data: { labels, datasets },
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
                    if (visible > 96)
                      return time === '00:00' || time === '12:00' ? time : undefined;
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
        console.error('Pressure chart creation failed:', err);
        if (chart) {
          try {
            chart.destroy();
          } catch {
            /* ignore */
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

    setupNavigatorDrag();

    // Double-tap to reset on mobile (#94)
    setupDoubleTap(document.getElementById(config.chartId), () => {
      if (chart) reset();
    });

    // Register theme re-render callback (#96)
    _themeRerenderCallbacks.push(function () {
      if (chart) render();
    });

    return { render, reset };
  }

  window.PressureInline = createInlinePressureChart({
    chartId: 'pressure-chart',
    navigatorId: 'pressure-navigator',
    noDataId: 'pressure-no-data',
    getData: () => window.hourlyData,
    series: [
      {
        key: 'pressure_msl',
        historicalLabel: 'MSL',
        forecastLabel: 'MSL (forecast)',
        historicalColor: () => cssVar('--accent-pressure'),
        forecastColor: () => cssVar('--accent-pressure-soft'),
        order: 1,
      },
      {
        key: 'surface_pressure',
        historicalLabel: 'Surface',
        forecastLabel: 'Surface (forecast)',
        historicalColor: () => cssVar('--accent-wind'),
        forecastColor: () => cssVar('--accent-wind-soft'),
        alwaysDash: true,
        order: 2,
      },
    ],
    colors: {
      accentToken: '--accent-pressure',
      accentSoftToken: '--accent-pressure-soft',
    },
    yAxis: {
      unit: 'hPa',
      stepSize: 5,
      snapTo: 5,
      paddingBelow: 5,
      paddingAbove: 5,
      fallbackMin: 990,
      fallbackMax: 1040,
    },
    historyHours: 168,
    forecastHours: 168,
    initialViewportHours: 24,
    zoomMinRange: 4,
  });
})();
