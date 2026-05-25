(function () {
  // Private helper — duplicated here so the module is self-contained.
  function degreesToCompass(degrees) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  }

  // wind_direction_10m is degrees the wind comes FROM; the arrow visually points
  // where the wind is blowing TO. The SVG base path points south at rotation 0,
  // so rotating by degrees directly gives the correct heading.
  // Stroke uses currentColor so dark mode and live theme toggles work automatically.
  function renderArrowSvg(degrees, { size = 28 } = {}) {
    const rotation = ((degrees % 360) + 360) % 360;
    return (
      `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ` +
      `style="transform: rotate(${rotation}deg);" focusable="false" aria-hidden="true">` +
      '<path d="M12 3 L12 21 M12 21 L6 15 M12 21 L18 15" ' +
      'fill="none" stroke="currentColor" stroke-width="2.5" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  function createModal(config) {
    // Circular mean: arithmetic mean of degrees wraps wrong across 0/360,
    // so average the unit vectors and take atan2.
    function circularMean(degList) {
      let sumSin = 0;
      let sumCos = 0;
      let count = 0;
      for (const d of degList) {
        if (d == null || isNaN(d)) continue;
        const rad = (d * Math.PI) / 180;
        sumSin += Math.sin(rad);
        sumCos += Math.cos(rad);
        count++;
      }
      if (count === 0) return null;
      const mean = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
      return (mean + 360) % 360;
    }

    // Closure-scoped state shared between render, setActiveBucket, and scrub handlers
    let buckets = [];
    let cellNodes = [];
    let miniChart = null;
    let eventsAttached = false;
    let initialMin = 0;
    let initialMax = 0;
    let dragging = false;
    let dragStartX = null;
    let dragStartRange = null;
    let navValues = null;
    let hourlyDir = [];
    let hourlySpeed = [];
    let hourlyGusts = [];
    let hourlyTimes = [];
    let hourlySplitAt = 0;
    let lastNowISO = '';

    function setActiveBucket(idx) {
      if (!buckets.length) return;
      idx = Math.max(0, Math.min(buckets.length - 1, idx));

      const b = buckets[idx];
      const statsEl = document.getElementById('wind-direction-stats');
      if (statsEl) {
        const deg = b.mean != null ? Math.round(b.mean) % 360 : null;
        const compass = deg != null ? degreesToCompass(deg) : '–';
        const degStr = deg != null ? `${compass} (${deg}°)` : '–';
        const speedVal = b.windSpeed != null ? `${Math.round(b.windSpeed)} km/h` : '–';
        const gustVal = b.windGusts != null ? `${Math.round(b.windGusts)} km/h` : '–';
        statsEl.innerHTML =
          '<div><div class="wd-stats__label">Time</div><div class="wd-stats__value">' +
          b.timeLabel +
          '</div></div>' +
          '<div><div class="wd-stats__label">Wind from</div><div class="wd-stats__value">' +
          degStr +
          '</div></div>' +
          '<div><div class="wd-stats__label">Wind</div><div class="wd-stats__value">' +
          speedVal +
          '</div></div>' +
          '<div><div class="wd-stats__label">Gusts</div><div class="wd-stats__value">' +
          gustVal +
          '</div></div>';
      }

      // Toggle active class on cell nodes
      for (let i = 0; i < cellNodes.length; i++) {
        cellNodes[i].classList.toggle('wd-cell--active', i === idx);
      }

      // Update guide line on mini-chart
      if (miniChart) {
        miniChart.$activeChartIdx = b.chartXStart;
        miniChart.update('none');
      }
    }

    function drawNavigator() {
      const nav = document.getElementById(config.navigatorId);
      if (!nav || !navValues || !miniChart) return;
      const w = nav.offsetWidth;
      const h = nav.offsetHeight;
      if (!w || !h) return;
      nav.width = w;
      nav.height = h;
      const ctx = nav.getContext('2d');
      const n = navValues.length;
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const accentColor = isDark ? config.colors.accentDark : config.colors.accentLight;
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, w, h);
      const scale = miniChart.scales.x;
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
        if (!miniChart || !navValues) return;
        if (e.cancelable) e.preventDefault();
        dragging = true;
        dragStartX = getClientX(e) - nav.getBoundingClientRect().left;
        dragStartRange = {
          min: miniChart.scales.x.min,
          max: miniChart.scales.x.max,
        };
        nav.style.cursor = 'grabbing';
      }

      function onMove(e) {
        if (!dragging || !miniChart || !navValues) return;
        if (e.cancelable) e.preventDefault();
        const currentX = getClientX(e) - nav.getBoundingClientRect().left;
        const deltaX = currentX - dragStartX;
        const n = navValues.length;
        const visibleRange = dragStartRange.max - dragStartRange.min;
        const deltaIndex = (deltaX / nav.offsetWidth) * n;
        const newMin = Math.max(0, Math.min(dragStartRange.min + deltaIndex, n - 1 - visibleRange));
        const newMax = newMin + visibleRange;
        miniChart.options.scales.x.min = newMin;
        miniChart.options.scales.x.max = newMax;
        miniChart.update('none');
        drawNavigator();
        renderArrowStrip();
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

    function rebuildBuckets(xMin, xMax) {
      const result = [];
      const visible = Math.round(xMax) - Math.round(xMin);
      const size = visible <= 48 ? 1 : visible <= 168 ? 3 : 6;
      const iMin = Math.round(xMin);
      const iMax = Math.round(xMax);
      const firstHour = Math.floor(iMin / size) * size;
      const lastHour = Math.min(hourlyTimes.length, Math.ceil(iMax / size) * size);
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      for (let i = firstHour; i < lastHour; i += size) {
        const j = Math.min(hourlyTimes.length, i + size);
        const mean = circularMean(hourlyDir.slice(i, j));
        const anchorTime = hourlyTimes[i];
        if (!anchorTime) continue;
        const isForecast = i >= hourlySplitAt;
        const hh = anchorTime.slice(11, 13);
        const dayStart = anchorTime.slice(11, 16) === '00:00';
        const dateLabel = dayStart
          ? `${parseInt(anchorTime.slice(8, 10))} ${months[parseInt(anchorTime.slice(5, 7)) - 1]}`
          : '';
        const timeLabel = `${dateLabel ? dateLabel + ' ' : ''}${hh}:00`;
        const speedSlice = hourlySpeed.slice(i, j).filter((v) => v != null);
        const gustSlice = hourlyGusts.slice(i, j).filter((v) => v != null);
        const windSpeed = speedSlice.length
          ? speedSlice.reduce((a, b) => a + b, 0) / speedSlice.length
          : null;
        const windGusts = gustSlice.length
          ? gustSlice.reduce((a, b) => a + b, 0) / gustSlice.length
          : null;
        result.push({
          mean,
          hh,
          dateLabel,
          isForecast,
          anchorTime,
          timeLabel,
          windSpeed,
          windGusts,
          chartXStart: i,
        });
      }
      return result;
    }

    function renderArrowStrip() {
      if (!miniChart) return;
      const host = document.getElementById(config.timelineId);
      if (!host) return;
      buckets = rebuildBuckets(miniChart.scales.x.min, miniChart.scales.x.max);
      if (buckets.length === 0) return;
      const cells = buckets.map((b) => {
        const arrow =
          b.mean == null
            ? '<span class="wd-arrow--empty" aria-hidden="true">·</span>'
            : renderArrowSvg(b.mean, { size: 22 });
        const cellClass = b.isForecast ? 'wd-cell wd-cell--forecast' : 'wd-cell';
        return (
          `<div class="${cellClass}">` +
          `<div class="wd-cell__date">${b.dateLabel}</div>` +
          `<div class="wd-cell__arrow">${arrow}</div>` +
          `<div class="wd-cell__hour">${b.hh}</div>` +
          '</div>'
        );
      });
      host.innerHTML =
        '<div class="wd-legend">' +
        '<span class="wd-legend__item"><span class="wd-legend__swatch"></span>Historical (past 7 days)</span>' +
        '<span class="wd-legend__item wd-legend__item--forecast"><span class="wd-legend__swatch"></span>Forecast (next 7 days)</span>' +
        '</div>' +
        `<div class="wd-timeline__strip">${cells.join('')}</div>`;
      const strip = host.querySelector('.wd-timeline__strip');
      cellNodes = strip ? Array.from(strip.querySelectorAll('.wd-cell')) : [];
      setActiveBucket(initialBucketIndex(lastNowISO));
    }

    function buildMiniChart(times, splitAt, windSpeedVals, windGustVals) {
      navValues = windSpeedVals;
      if (miniChart) {
        try {
          miniChart.destroy();
        } catch (_) {
          // ignore destroy errors
        }
        miniChart = null;
      }
      const canvas = document.getElementById('wind-direction-minichart');
      if (!canvas || typeof Chart === 'undefined') return;

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDark ? '#a0aec0' : '#718096';
      const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

      const labels = times.map((t) => t.slice(11, 16));

      function makeDatasets(vals, histColor, fcastColor, histLabel, fcastLabel) {
        const past = vals.map((v, i) => (i <= splitAt ? v : null));
        const forecast = vals.map((v, i) => (i >= splitAt ? v : null));
        return [
          {
            label: histLabel,
            data: past,
            borderColor: histColor,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            spanGaps: false,
            tension: 0.3,
          },
          {
            label: fcastLabel,
            data: forecast,
            borderColor: fcastColor,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            spanGaps: false,
            tension: 0.3,
            borderDash: [5, 5],
          },
        ];
      }

      const datasets = [
        ...makeDatasets(windSpeedVals, '#6b46c1', '#b794f4', 'Wind speed', 'Wind speed (forecast)'),
        ...makeDatasets(windGustVals, '#dd6b20', '#f6ad55', 'Gusts', 'Gusts (forecast)'),
      ];

      const allValid = [...windSpeedVals, ...windGustVals].filter((v) => v != null);
      const yMin = allValid.length ? Math.floor(Math.min(...allValid) / 5) * 5 : 0;
      const yMax = allValid.length ? Math.ceil((Math.max(...allValid) + 5) / 5) * 5 : 50;

      const wdGuidePlugin = {
        id: 'wdGuide',
        afterDraw(chart) {
          const idx = chart.$activeChartIdx;
          if (idx == null || !chart.scales.x) return;
          const { ctx, chartArea, scales } = chart;
          const x = scales.x.getPixelForValue(idx);
          if (x < chartArea.left || x > chartArea.right) return;
          ctx.save();
          ctx.strokeStyle = isDark ? '#a0aec0' : '#718096';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          ctx.restore();
        },
      };

      try {
        miniChart = new Chart(canvas, {
          type: 'line',
          data: { labels, datasets },
          plugins: [config.dayLabelsPlugin(times, textColor), wdGuidePlugin],
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 20 } },
            interaction: { mode: 'index', intersect: false, axis: 'x' },
            plugins: {
              legend: {
                display: true,
                position: 'bottom',
                labels: { color: textColor, boxWidth: 20 },
              },
              tooltip: {
                enabled: true,
                displayColors: false,
                backgroundColor: isDark ? 'rgba(26,32,44,0.92)' : 'rgba(255,255,255,0.92)',
                titleColor: isDark ? '#f7fafc' : '#1a202c',
                bodyColor: isDark ? '#e2e8f0' : '#2d3748',
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                borderWidth: 1,
                padding: 8,
                callbacks: {
                  title(items) {
                    const i = items[0].dataIndex;
                    const iso = hourlyTimes[i];
                    if (!iso) return '';
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const mons = [
                      'Jan',
                      'Feb',
                      'Mar',
                      'Apr',
                      'May',
                      'Jun',
                      'Jul',
                      'Aug',
                      'Sep',
                      'Oct',
                      'Nov',
                      'Dec',
                    ];
                    const d = new Date(iso);
                    const label = `${days[d.getDay()]} ${mons[d.getMonth()]} ${d.getDate()}`;
                    return i >= hourlySplitAt ? `(forecast) ${label}` : label;
                  },
                  label() {
                    return '';
                  },
                  afterBody(items) {
                    const i = items[0].dataIndex;
                    const iso = hourlyTimes[i];
                    const time = iso ? iso.slice(11, 16) : '–';
                    const speed =
                      hourlySpeed[i] != null ? `${Math.round(hourlySpeed[i])} km/h` : '–';
                    const gusts =
                      hourlyGusts[i] != null ? `${Math.round(hourlyGusts[i])} km/h` : '–';
                    const rawDir = hourlyDir[i];
                    const normDir =
                      rawDir != null ? Math.round(((rawDir % 360) + 360) % 360) : null;
                    const dir = normDir != null ? `${normDir}° ${degreesToCompass(normDir)}` : '–';
                    return [`Time  ${time}`, `Wind  ${speed}`, `Gusts  ${gusts}`, `Dir  ${dir}`];
                  },
                },
              },
              zoom: {
                limits: { x: { min: 0, max: times.length - 1, minRange: config.zoomMinRange } },
                zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
                pan: { enabled: true, mode: 'x' },
                onZoomComplete: () => {
                  drawNavigator();
                  renderArrowStrip();
                },
                onPanComplete: () => {
                  drawNavigator();
                  renderArrowStrip();
                },
              },
            },
            scales: {
              x: {
                min: 0,
                max: times.length - 1,
                ticks: {
                  color: textColor,
                  maxRotation: 0,
                  callback(value) {
                    const t = times[value];
                    if (!t) return undefined;
                    const time = t.slice(11, 16);
                    return time === '00:00' || time === '12:00' ? time : undefined;
                  },
                },
                grid: {
                  color(context) {
                    const t = context.tick && times[context.tick.value];
                    if (t && t.slice(11, 16) === '00:00') return isDark ? '#63b3ed' : '#2b6cb0';
                    return gridColor;
                  },
                },
              },
              y: {
                min: yMin,
                max: yMax,
                ticks: { color: textColor, stepSize: 10 },
                grid: { color: gridColor },
                title: { display: true, text: 'km/h', color: textColor },
              },
            },
          },
        });
      } catch (err) {
        console.error('Wind direction mini-chart creation failed', err);
      }
      initialMin = Math.max(0, splitAt - config.initialViewportHours);
      initialMax = Math.min(times.length - 1, splitAt + config.initialViewportHours);
      if (miniChart && typeof miniChart.zoomScale === 'function') {
        miniChart.zoomScale('x', { min: initialMin, max: initialMax }, 'none');
      } else if (miniChart) {
        miniChart.options.scales.x.min = initialMin;
        miniChart.options.scales.x.max = initialMax;
        miniChart.update('none');
      }
    }

    function attachScrubHandlers(host) {
      if (eventsAttached) return;
      eventsAttached = true;

      function clientXToBucketIdx(clientX) {
        if (!buckets.length) return 0;
        const strip = host.querySelector('.wd-timeline__strip');
        if (!strip) return 0;
        const rect = strip.getBoundingClientRect();
        const relX = clientX - rect.left + strip.scrollLeft;
        const totalW = strip.scrollWidth;
        return Math.max(
          0,
          Math.min(buckets.length - 1, Math.floor((relX / totalW) * buckets.length)),
        );
      }

      host.addEventListener('mousemove', function (e) {
        if (!buckets.length) return;
        setActiveBucket(clientXToBucketIdx(e.clientX));
      });

      host.addEventListener(
        'touchstart',
        function (e) {
          if (!buckets.length) return;
          if (e.cancelable) e.preventDefault();
          setActiveBucket(clientXToBucketIdx(e.touches[0].clientX));
        },
        { passive: false },
      );

      host.addEventListener(
        'touchmove',
        function (e) {
          if (!buckets.length) return;
          if (e.cancelable) e.preventDefault();
          setActiveBucket(clientXToBucketIdx(e.touches[0].clientX));
        },
        { passive: false },
      );
    }

    function initialBucketIndex(nowISO) {
      for (let i = 0; i < buckets.length; i++) {
        if (buckets[i].anchorTime >= nowISO) return i;
      }
      return Math.max(0, buckets.length - 1);
    }

    function render() {
      const host = document.getElementById(config.timelineId);
      const noData = document.getElementById(config.noDataId);

      const hourly = config.getData();

      if (!hourly || !Array.isArray(hourly.wind_direction_10m) || !Array.isArray(hourly.time)) {
        host.innerHTML = '';
        host.classList.add('hidden');
        noData.classList.remove('hidden');
        return;
      }

      host.classList.remove('hidden');
      noData.classList.add('hidden');

      const nowISO = new Date()
        .toLocaleString('sv', { timeZone: 'Europe/Brussels' })
        .slice(0, 16)
        .replace(' ', 'T');

      let boundaryIndex = hourly.time.findIndex((t) => t >= nowISO);
      if (boundaryIndex === -1) boundaryIndex = hourly.time.length;

      const startIndex = Math.max(0, boundaryIndex - config.historyHours);
      const endIndex = Math.min(hourly.time.length, boundaryIndex + config.forecastHours);

      const windSpeedAll = Array.isArray(hourly.wind_speed_10m) ? hourly.wind_speed_10m : [];
      const windGustsAll = Array.isArray(hourly.wind_gusts_10m) ? hourly.wind_gusts_10m : [];

      // Save windowed hourly slices for adaptive bucket rebuilding on viewport change
      lastNowISO = nowISO;
      hourlyTimes = hourly.time.slice(startIndex, endIndex);
      hourlyDir = hourly.wind_direction_10m.slice(startIndex, endIndex);
      hourlySpeed = windSpeedAll.slice(startIndex, endIndex);
      hourlyGusts = windGustsAll.slice(startIndex, endIndex);
      hourlySplitAt = boundaryIndex - startIndex;

      // Build mini-chart (sets navValues and applies initial viewport)
      buildMiniChart(hourlyTimes, hourlySplitAt, hourlySpeed, hourlyGusts);

      // Attach scrub handlers once (guard is inside attachScrubHandlers)
      attachScrubHandlers(host);

      // Render navigator and arrow strip after layout is ready
      requestAnimationFrame(() => {
        drawNavigator();
        renderArrowStrip();
      });
    }

    setupNavigatorDrag();

    return {
      open() {
        document.getElementById(config.modalId).classList.remove('hidden');
        render();
      },
      close() {
        document.getElementById(config.modalId).classList.add('hidden');
        if (miniChart) {
          try {
            miniChart.destroy();
          } catch (_) {
            // ignore destroy errors
          }
          miniChart = null;
        }
        const statsEl = document.getElementById('wind-direction-stats');
        if (statsEl) statsEl.innerHTML = '';
        const host = document.getElementById(config.timelineId);
        if (host) host.innerHTML = '';
      },
      reset() {
        if (miniChart) {
          miniChart.resetZoom();
          if (typeof miniChart.zoomScale === 'function') {
            miniChart.zoomScale('x', { min: initialMin, max: initialMax }, 'none');
          } else {
            miniChart.options.scales.x.min = initialMin;
            miniChart.options.scales.x.max = initialMax;
            miniChart.update('none');
          }
          drawNavigator();
          renderArrowStrip();
        }
      },
    };
  }

  window.WindDirection = {
    renderArrowSvg: renderArrowSvg,
    createModal: createModal,
  };
})();
