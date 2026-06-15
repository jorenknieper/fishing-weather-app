(function () {
  // ---- chart registry ----
  const _charts = {};

  function _destroyChart(id) {
    if (_charts[id]) {
      try {
        _charts[id].destroy();
      } catch {
        /* ignore */
      }
      delete _charts[id];
    }
  }

  function _makeChart(canvasId, type, data, options) {
    if (typeof Chart === 'undefined') return null;
    _destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    try {
      const chart = new Chart(canvas, { type: type, data: data, options: options });
      _charts[canvasId] = chart;
      return chart;
    } catch (err) {
      console.error('Analytics chart error (' + canvasId + '):', err);
      return null;
    }
  }

  // ---- helpers ----
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _fmtWeight(kg) {
    return kg != null ? kg.toFixed(1) + ' kg' : '—';
  }

  function _tMuted() {
    return cssVar('--text-muted');
  }
  function _tAccent() {
    return cssVar('--accent-wind');
  }
  function _tPressure() {
    return cssVar('--accent-pressure');
  }
  function _tTemp() {
    return cssVar('--accent-temp');
  }

  function _palette8() {
    return [
      cssVar('--accent-wind'),
      cssVar('--accent-pressure'),
      cssVar('--accent-temp'),
      '#c47d7d',
      '#8888cc',
      '#7dc47d',
      '#c4a07d',
      '#999999',
    ];
  }

  // ---- module state ----
  let _activeTab = 'overview';
  let _rangeMode = 'all';
  let _customFrom = '';
  let _customTo = '';
  let _inited = false;

  // ---- date range ----
  function _computeRange() {
    const now = new Date();
    if (_rangeMode === 'all') return { from: null, to: null };
    if (_rangeMode === 'year') return { from: new Date(now.getFullYear(), 0, 1), to: null };
    if (_rangeMode === '6m') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return { from: d, to: null };
    }
    if (_rangeMode === 'custom') {
      return {
        from: _customFrom ? new Date(_customFrom) : null,
        to: _customTo ? new Date(_customTo + 'T23:59:59') : null,
      };
    }
    return { from: null, to: null };
  }

  function _getFilteredCatches() {
    if (!window.CatchesStore) return [];
    const all = window.CatchesStore.getAllCatches();
    const range = _computeRange();
    if (!range.from && !range.to) return all;
    return all.filter(function (c) {
      if (!c.caughtAt) return true;
      const t = new Date(c.caughtAt).getTime();
      if (range.from && t < range.from.getTime()) return false;
      if (range.to && t > range.to.getTime()) return false;
      return true;
    });
  }

  // ---- URL params (#211) ----
  function _readParams() {
    try {
      const sp = new URLSearchParams(location.search);
      const tab = sp.get('tab');
      const range = sp.get('range');
      const from = sp.get('from');
      const to = sp.get('to');
      const TABS = ['overview', 'pressure', 'wind', 'moon', 'bait', 'time', 'spots'];
      const MODES = ['all', 'year', '6m', 'custom'];
      if (tab && TABS.indexOf(tab) !== -1) _activeTab = tab;
      if (range && MODES.indexOf(range) !== -1) _rangeMode = range;
      if (from) _customFrom = from;
      if (to) _customTo = to;
    } catch {
      /* ignore */
    }
  }

  function _writeParams() {
    try {
      const sp = new URLSearchParams(location.search);
      if (_activeTab !== 'overview') sp.set('tab', _activeTab);
      else sp.delete('tab');
      if (_rangeMode !== 'all') sp.set('range', _rangeMode);
      else sp.delete('range');
      if (_rangeMode === 'custom') {
        if (_customFrom) sp.set('from', _customFrom);
        else sp.delete('from');
        if (_customTo) sp.set('to', _customTo);
        else sp.delete('to');
      } else {
        sp.delete('from');
        sp.delete('to');
      }
      const qs = sp.toString();
      history.replaceState(null, '', (qs ? '?' + qs : '') + location.hash);
    } catch {
      /* ignore */
    }
  }

  // ---- UI sync ----
  function _syncRangeUI() {
    const sel = document.getElementById('an-range-select');
    const custom = document.getElementById('an-range-custom');
    const fromIn = document.getElementById('an-range-from');
    const toIn = document.getElementById('an-range-to');
    if (sel) sel.value = _rangeMode;
    if (custom) custom.hidden = _rangeMode !== 'custom';
    if (fromIn && _customFrom) fromIn.value = _customFrom;
    if (toIn && _customTo) toIn.value = _customTo;
  }

  function _syncTabUI() {
    document.querySelectorAll('.an-tab').forEach(function (btn) {
      const active = btn.dataset.tab === _activeTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.an-panel').forEach(function (panel) {
      const active = panel.id === 'an-panel-' + _activeTab;
      panel.classList.toggle('is-active', active);
      if (active) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });
  }

  // ---- AGGREGATIONS ----

  function _aggSummary(rows) {
    let totalWeight = 0,
      weightCount = 0,
      best = null;
    rows.forEach(function (c) {
      if (c.weightKg != null) {
        totalWeight += c.weightKg;
        weightCount++;
        if (!best || c.weightKg > best.weightKg) best = c;
      }
    });
    return {
      total: rows.length,
      totalWeight: totalWeight,
      avgWeight: weightCount > 0 ? totalWeight / weightCount : null,
      best: best,
    };
  }

  const WIND_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  function _aggWindDir(rows) {
    const counts = {};
    WIND_DIRS.forEach(function (d) {
      counts[d] = 0;
    });
    rows.forEach(function (c) {
      const d = (c.windDir || '').toUpperCase().trim();
      if (counts[d] !== undefined) counts[d]++;
    });
    return WIND_DIRS.map(function (d) {
      return { label: d, count: counts[d] };
    });
  }

  const PRESSURE_LABELS = [
    '<1000',
    '1000',
    '1005',
    '1010',
    '1015',
    '1020',
    '1025',
    '1030',
    '1035+',
  ];

  function _pressureBucket(hpa) {
    if (hpa == null) return -1;
    if (hpa < 1000) return 0;
    if (hpa >= 1035) return 8;
    return Math.floor((hpa - 1000) / 5) + 1;
  }

  function _aggPressure(rows) {
    const counts = new Array(PRESSURE_LABELS.length).fill(0);
    rows.forEach(function (c) {
      const i = _pressureBucket(c.pressureHPa);
      if (i >= 0) counts[i]++;
    });
    return PRESSURE_LABELS.map(function (l, i) {
      return { label: l, count: counts[i] };
    });
  }

  const MOON_4_MAP = {
    'New Moon': 'New',
    'Waxing Crescent': 'Waxing',
    'First Quarter': 'Waxing',
    'Waxing Gibbous': 'Waxing',
    'Full Moon': 'Full',
    'Waning Gibbous': 'Waning',
    'Last Quarter': 'Waning',
    'Waning Crescent': 'Waning',
  };
  const MOON_4_LABELS = ['New', 'Waxing', 'Full', 'Waning'];

  function _aggMoon4(rows) {
    const c = { New: 0, Waxing: 0, Full: 0, Waning: 0 };
    rows.forEach(function (r) {
      const g = MOON_4_MAP[r.moonPhase];
      if (g) c[g]++;
    });
    return MOON_4_LABELS.map(function (l) {
      return { label: l, count: c[l] };
    });
  }

  const MOON_8_ORDER = [
    'New Moon',
    'Waxing Crescent',
    'First Quarter',
    'Waxing Gibbous',
    'Full Moon',
    'Waning Gibbous',
    'Last Quarter',
    'Waning Crescent',
  ];
  const MOON_8_SHORT = [
    'New',
    'Wax.Cres.',
    '1st Q.',
    'Wax.Gib.',
    'Full',
    'Wan.Gib.',
    'Last Q.',
    'Wan.Cres.',
  ];

  function _aggMoon8(rows) {
    const c = {};
    MOON_8_ORDER.forEach(function (p) {
      c[p] = 0;
    });
    rows.forEach(function (r) {
      if (c[r.moonPhase] !== undefined) c[r.moonPhase]++;
    });
    return MOON_8_ORDER.map(function (p) {
      return { label: p, count: c[p] };
    });
  }

  function _aggRank(rows, field) {
    const c = {};
    rows.forEach(function (r) {
      const v = r[field];
      if (v) c[v] = (c[v] || 0) + 1;
    });
    return Object.keys(c)
      .map(function (k) {
        return { label: k, count: c[k] };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });
  }

  const TIME_BLOCK_LABELS = ['00–06', '06–12', '12–18', '18–24'];

  function _aggTimeBlocks(rows) {
    const c = [0, 0, 0, 0];
    rows.forEach(function (r) {
      if (!r.caughtAt) return;
      c[Math.min(Math.floor(new Date(r.caughtAt).getHours() / 6), 3)]++;
    });
    return TIME_BLOCK_LABELS.map(function (l, i) {
      return { label: l, count: c[i] };
    });
  }

  function _aggHourly(rows) {
    const c = new Array(24).fill(0);
    rows.forEach(function (r) {
      if (r.caughtAt) c[new Date(r.caughtAt).getHours()]++;
    });
    return c;
  }

  function _aggWindSpeed(rows) {
    const BUCKETS = ['0–5', '6–10', '11–15', '16–20', '21–30', '31+'];
    const c = [0, 0, 0, 0, 0, 0];
    rows.forEach(function (r) {
      const s = r.windSpeedKmh || 0;
      if (s <= 5) c[0]++;
      else if (s <= 10) c[1]++;
      else if (s <= 15) c[2]++;
      else if (s <= 20) c[3]++;
      else if (s <= 30) c[4]++;
      else c[5]++;
    });
    return BUCKETS.map(function (l, i) {
      return { label: l, count: c[i] };
    });
  }

  function _aggBaitAvg(rows) {
    const data = {};
    rows.forEach(function (r) {
      if (!r.bait || r.weightKg == null) return;
      if (!data[r.bait]) data[r.bait] = { sum: 0, n: 0 };
      data[r.bait].sum += r.weightKg;
      data[r.bait].n++;
    });
    return Object.keys(data)
      .map(function (k) {
        return { label: k, avg: data[k].sum / data[k].n };
      })
      .sort(function (a, b) {
        return b.avg - a.avg;
      });
  }

  const MONTH_SHORT = [
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

  function _aggMonthly(rows) {
    const c = new Array(12).fill(0);
    rows.forEach(function (r) {
      if (r.caughtAt) c[new Date(r.caughtAt).getMonth()]++;
    });
    return c;
  }

  function _aggSolunar(rows) {
    const LABELS = ['Major (Dawn)', 'Minor (Midday)', 'Major (Dusk)', 'Minor (Night)'];
    const c = [0, 0, 0, 0];
    rows.forEach(function (r) {
      if (!r.caughtAt) return;
      const h = new Date(r.caughtAt).getHours();
      if (h >= 5 && h < 10) c[0]++;
      else if (h >= 10 && h < 15) c[1]++;
      else if (h >= 15 && h < 20) c[2]++;
      else c[3]++;
    });
    return LABELS.map(function (l, i) {
      return { label: l, count: c[i] };
    });
  }

  function _aggVenues(rows) {
    const v = {};
    rows.forEach(function (r) {
      const name = r.venueName || '(unknown)';
      if (!v[name]) v[name] = { count: 0, best: null };
      v[name].count++;
      if (r.weightKg != null && (!v[name].best || r.weightKg > v[name].best.weightKg)) {
        v[name].best = r;
      }
    });
    return Object.keys(v)
      .map(function (name) {
        return { venue: name, count: v[name].count, best: v[name].best };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });
  }

  // ---- RENDER: stats (#206) ----
  function _renderStats(rows) {
    const s = _aggSummary(rows);
    function _el(id, v) {
      const e = document.getElementById(id);
      if (e) e.textContent = v;
    }
    _el('an-stat-total', s.total);
    _el('an-stat-weight', s.total > 0 ? _fmtWeight(s.totalWeight) : '—');
    _el('an-stat-avg', s.avgWeight != null ? _fmtWeight(s.avgWeight) : '—');
    _el('an-stat-best', s.best ? _fmtWeight(s.best.weightKg) : '—');
    const sub = document.getElementById('an-stat-best-sub');
    if (sub) sub.textContent = s.best ? s.best.species || '' : '';
  }

  // ---- RENDER: wind pie (#207) ----
  function _renderWindPie(rows) {
    const agg = _aggWindDir(rows);
    const total = agg.reduce(function (s, d) {
      return s + d.count;
    }, 0);
    const sorted = agg
      .filter(function (d) {
        return d.count > 0;
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });
    const top = sorted.slice(0, 5);
    const otherCount = sorted.slice(5).reduce(function (s, d) {
      return s + d.count;
    }, 0);
    if (otherCount > 0) top.push({ label: 'Other', count: otherCount });

    const palette = _palette8();
    const labels = top.map(function (d) {
      return d.label;
    });
    const data = top.map(function (d) {
      return d.count;
    });
    const colors = top.map(function (d, i) {
      const idx = WIND_DIRS.indexOf(d.label);
      return idx >= 0 ? palette[idx] : palette[i % palette.length];
    });
    const muted = _tMuted();

    _makeChart(
      'an-chart-wind-pie',
      'pie',
      {
        labels: labels,
        datasets: [{ data: data, backgroundColor: colors, borderWidth: 1 }],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: muted,
              generateLabels: function (chart) {
                const ds = chart.data.datasets[0];
                return chart.data.labels.map(function (l, i) {
                  const cnt = ds.data[i];
                  const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                  return {
                    text: l + ' ' + cnt + ' (' + pct + '%)',
                    fillStyle: ds.backgroundColor[i],
                    strokeStyle: ds.backgroundColor[i],
                    fontColor: muted,
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                return ' ' + ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
              },
            },
          },
        },
      },
    );
  }

  // ---- RENDER: pressure bar (#208, reused in Pressure tab) ----
  function _renderPressureBar(rows, canvasId) {
    const agg = _aggPressure(rows);
    const counts = agg.map(function (d) {
      return d.count;
    });
    const maxVal = Math.max.apply(null, counts);
    const accent = _tAccent();
    const colors = counts.map(function (v) {
      return v === maxVal && maxVal > 0 ? accent : accent + '50';
    });
    const muted = _tMuted();

    _makeChart(
      canvasId,
      'bar',
      {
        labels: agg.map(function (d) {
          return d.label;
        }),
        datasets: [
          {
            label: 'Catches',
            data: counts,
            backgroundColor: colors,
            borderWidth: 0,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ' ' + ctx.raw + ' catches';
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: muted, maxRotation: 45 }, grid: { display: false } },
          y: { ticks: { color: muted, stepSize: 1 }, beginAtZero: true },
        },
      },
    );
  }

  // ---- RENDER: moon donut (#209) ----
  function _renderMoonDonut(rows) {
    const agg = _aggMoon4(rows);
    const total = agg.reduce(function (s, d) {
      return s + d.count;
    }, 0);
    const COLORS = ['#4a4a8a', cssVar('--accent-wind'), cssVar('--accent-pressure'), '#c47d7d'];
    const muted = _tMuted();

    _makeChart(
      'an-chart-moon-donut',
      'doughnut',
      {
        labels: agg.map(function (d) {
          return d.label;
        }),
        datasets: [
          {
            data: agg.map(function (d) {
              return d.count;
            }),
            backgroundColor: COLORS,
            borderWidth: 1,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: muted,
              generateLabels: function (chart) {
                const ds = chart.data.datasets[0];
                return chart.data.labels.map(function (l, i) {
                  const cnt = ds.data[i];
                  const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                  return {
                    text: l + ' ' + pct + '%',
                    fillStyle: ds.backgroundColor[i],
                    strokeStyle: ds.backgroundColor[i],
                    fontColor: muted,
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                return ' ' + ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
              },
            },
          },
        },
      },
    );
  }

  // ---- RENDER: rank table (#210) ----
  function _renderRankTable(containerId, data, moreBtnKey) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const LIMIT = 5;
    let showing = LIMIT;
    const total = data.reduce(function (s, r) {
      return s + r.count;
    }, 0);

    function _build(items) {
      if (!items.length) {
        container.innerHTML = '<p class="an-rank-empty">No data</p>';
        return;
      }
      container.innerHTML = items
        .map(function (r, i) {
          const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
          return (
            '<div class="an-rank-row">' +
            '<span class="an-rank-row__n">' +
            (i + 1) +
            '</span>' +
            '<span class="an-rank-row__name" title="' +
            _esc(r.label) +
            '">' +
            _esc(r.label) +
            '</span>' +
            '<span class="an-rank-row__val">' +
            r.count +
            ' · ' +
            pct +
            '%</span>' +
            '<div class="an-rank-row__bar"><div class="an-rank-row__bar-fill" style="width:' +
            pct +
            '%"></div></div>' +
            '</div>'
          );
        })
        .join('');
    }

    _build(data.slice(0, showing));

    if (moreBtnKey) {
      const btn = document.querySelector('[data-rank-more="' + moreBtnKey + '"]');
      if (btn) {
        if (data.length > LIMIT) {
          btn.hidden = false;
          btn.textContent = 'Show more';
          btn.onclick = function () {
            showing = showing === LIMIT ? data.length : LIMIT;
            _build(data.slice(0, showing));
            btn.textContent = showing === LIMIT ? 'Show more' : 'Show less';
          };
        } else {
          btn.hidden = true;
        }
      }
    }
  }

  // ---- TAB RENDERS ----

  function _renderOverview(rows) {
    _renderStats(rows);
    _renderWindPie(rows);
    _renderPressureBar(rows, 'an-chart-pressure-bar');
    _renderMoonDonut(rows);
    _renderRankTable('an-rank-bait', _aggRank(rows, 'bait'), 'bait');
    _renderRankTable('an-rank-rig', _aggRank(rows, 'rig'), 'rig');
    _renderRankTable('an-rank-time', _aggTimeBlocks(rows), null);
  }

  function _renderPressureTab(rows) {
    const accent = _tAccent();
    const muted = _tMuted();
    const points = rows
      .filter(function (c) {
        return c.pressureHPa != null && c.weightKg != null;
      })
      .map(function (c) {
        return { x: c.pressureHPa, y: c.weightKg };
      });

    _makeChart(
      'an-chart-pressure-scatter',
      'scatter',
      {
        datasets: [
          {
            label: 'Weight vs Pressure',
            data: points,
            backgroundColor: accent + '80',
            borderColor: accent,
            borderWidth: 1,
            pointRadius: 5,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            title: { display: true, text: 'Pressure (hPa)', color: muted },
            ticks: { color: muted },
          },
          y: {
            title: { display: true, text: 'Weight (kg)', color: muted },
            ticks: { color: muted },
            beginAtZero: true,
          },
        },
      },
    );

    _renderPressureBar(rows, 'an-chart-pressure-bar2');
  }

  function _renderWindTab(rows) {
    const palette = _palette8();
    const muted = _tMuted();
    const accent = _tAccent();
    const agg = _aggWindDir(rows);

    _makeChart(
      'an-chart-wind-rose',
      'polarArea',
      {
        labels: agg.map(function (d) {
          return d.label;
        }),
        datasets: [
          {
            data: agg.map(function (d) {
              return d.count;
            }),
            backgroundColor: palette.map(function (c) {
              return c + 'a0';
            }),
            borderColor: palette,
            borderWidth: 1,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: muted } } },
        scales: { r: { ticks: { color: muted }, grid: { color: muted + '30' } } },
      },
    );

    const speedAgg = _aggWindSpeed(rows);
    _makeChart(
      'an-chart-wind-speed',
      'bar',
      {
        labels: speedAgg.map(function (d) {
          return d.label;
        }),
        datasets: [
          {
            label: 'Catches',
            data: speedAgg.map(function (d) {
              return d.count;
            }),
            backgroundColor: accent + '80',
            borderColor: accent,
            borderWidth: 1,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            title: { display: true, text: 'Wind speed (km/h)', color: muted },
            ticks: { color: muted },
          },
          y: { ticks: { color: muted, stepSize: 1 }, beginAtZero: true },
        },
      },
    );
  }

  function _renderMoonTab(rows) {
    const muted = _tMuted();
    const agg8 = _aggMoon8(rows);
    const COLORS = [
      '#4a4a8a',
      '#6a6ab0',
      '#8888cc',
      '#aaa8dd',
      cssVar('--accent-pressure'),
      '#c0a030',
      '#9a7a20',
      '#6a5410',
    ];

    _makeChart(
      'an-chart-moon8',
      'bar',
      {
        labels: MOON_8_SHORT,
        datasets: [
          {
            data: agg8.map(function (d) {
              return d.count;
            }),
            backgroundColor: COLORS,
            borderWidth: 0,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted, maxRotation: 30 } },
          y: { ticks: { color: muted, stepSize: 1 }, beginAtZero: true },
        },
      },
    );

    const solunar = _aggSolunar(rows);
    const ap = _tPressure();
    _makeChart(
      'an-chart-solunar',
      'bar',
      {
        labels: solunar.map(function (d) {
          return d.label;
        }),
        datasets: [
          {
            label: 'Catches',
            data: solunar.map(function (d) {
              return d.count;
            }),
            backgroundColor: [ap + 'cc', ap + '60', ap + 'cc', ap + '40'],
            borderWidth: 0,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted, maxRotation: 20 } },
          y: { ticks: { color: muted, stepSize: 1 }, beginAtZero: true },
        },
      },
    );
  }

  function _renderBaitTab(rows) {
    const muted = _tMuted();
    const accent = _tAccent();
    const accentT = _tTemp();
    const baitAvg = _aggBaitAvg(rows);
    const monthly = _aggMonthly(rows);

    _makeChart(
      'an-chart-bait-avg',
      'bar',
      {
        labels: baitAvg.map(function (d) {
          return d.label;
        }),
        datasets: [
          {
            label: 'Avg weight (kg)',
            data: baitAvg.map(function (d) {
              return +d.avg.toFixed(2);
            }),
            backgroundColor: accent + '80',
            borderColor: accent,
            borderWidth: 1,
          },
        ],
      },
      {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted }, beginAtZero: true },
          y: { ticks: { color: muted } },
        },
      },
    );

    _makeChart(
      'an-chart-bait-monthly',
      'bar',
      {
        labels: MONTH_SHORT,
        datasets: [
          {
            label: 'Catches',
            data: monthly,
            backgroundColor: accentT + '80',
            borderColor: accentT,
            borderWidth: 1,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted } },
          y: { ticks: { color: muted, stepSize: 1 }, beginAtZero: true },
        },
      },
    );
  }

  function _renderTimeTab(rows) {
    const muted = _tMuted();
    const accent = _tAccent();

    _makeChart(
      'an-chart-time-hourly',
      'bar',
      {
        labels: Array.from({ length: 24 }, function (_, i) {
          return String(i).padStart(2, '0') + ':00';
        }),
        datasets: [
          {
            label: 'Catches',
            data: _aggHourly(rows),
            backgroundColor: accent + '80',
            borderColor: accent,
            borderWidth: 1,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: muted, maxRotation: 45 } },
          y: { ticks: { color: muted, stepSize: 1 }, beginAtZero: true },
        },
      },
    );
  }

  function _renderSpotsTab(rows) {
    const container = document.getElementById('an-venue-table');
    if (!container) return;
    const venues = _aggVenues(rows);

    if (!venues.length) {
      container.innerHTML = '<p class="an-rank-empty">No venue data</p>';
      return;
    }

    container.innerHTML =
      '<table class="an-venue-tbl">' +
      '<thead><tr><th>Venue</th><th>Catches</th><th>Best Catch</th></tr></thead>' +
      '<tbody>' +
      venues
        .map(function (v) {
          const bestStr = v.best
            ? _esc(_fmtWeight(v.best.weightKg)) + ' – ' + _esc(v.best.species || '')
            : '—';
          return (
            '<tr><td>' +
            _esc(v.venue) +
            '</td><td>' +
            v.count +
            '</td><td>' +
            bestStr +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
  }

  // ---- dispatch to active tab ----
  function _renderActiveTab(rows) {
    switch (_activeTab) {
      case 'overview':
        _renderOverview(rows);
        break;
      case 'pressure':
        _renderPressureTab(rows);
        break;
      case 'wind':
        _renderWindTab(rows);
        break;
      case 'moon':
        _renderMoonTab(rows);
        break;
      case 'bait':
        _renderBaitTab(rows);
        break;
      case 'time':
        _renderTimeTab(rows);
        break;
      case 'spots':
        _renderSpotsTab(rows);
        break;
    }
  }

  // ---- main render (#229) ----
  function renderAll() {
    const rows = _getFilteredCatches();
    const empty = document.getElementById('an-empty');
    const panels = document.getElementById('an-panels');
    if (empty) empty.hidden = rows.length > 0;
    if (panels) panels.hidden = rows.length === 0;
    if (rows.length > 0) _renderActiveTab(rows);
  }

  // ---- tab switch ----
  function _switchTab(tab) {
    _activeTab = tab;
    _syncTabUI();
    _writeParams();
    const rows = _getFilteredCatches();
    if (rows.length > 0) _renderActiveTab(rows);
  }

  // ---- INIT ----
  function initAnalyticsPage() {
    if (!_inited) {
      _readParams();
      _inited = true;
    }

    _syncRangeUI();
    _syncTabUI();

    // Tab bar (delegated)
    const tabs = document.querySelector('.an-tabs');
    if (tabs && !tabs.dataset.wired) {
      tabs.dataset.wired = '1';
      tabs.addEventListener('click', function (e) {
        const btn = e.target.closest('.an-tab');
        if (btn && btn.dataset.tab) _switchTab(btn.dataset.tab);
      });
    }

    // Range select (#211)
    const sel = document.getElementById('an-range-select');
    if (sel && !sel.dataset.wired) {
      sel.dataset.wired = '1';
      sel.addEventListener('change', function () {
        _rangeMode = this.value;
        const custom = document.getElementById('an-range-custom');
        if (custom) custom.hidden = _rangeMode !== 'custom';
        _writeParams();
        renderAll();
      });
    }

    // Custom date inputs (#211)
    ['an-range-from', 'an-range-to'].forEach(function (id) {
      const inp = document.getElementById(id);
      if (inp && !inp.dataset.wired) {
        inp.dataset.wired = '1';
        inp.addEventListener('change', function () {
          _customFrom = (document.getElementById('an-range-from') || {}).value || '';
          _customTo = (document.getElementById('an-range-to') || {}).value || '';
          _writeParams();
          renderAll();
        });
      }
    });

    renderAll();
  }

  // ---- routing & theme ----
  function _onRoute() {
    if (location.hash === '#analytics') initAnalyticsPage();
  }

  window.addEventListener('hashchange', _onRoute);

  // Re-render charts with correct theme colors on toggle (#96 pattern)
  _themeRerenderCallbacks.push(function () {
    if (location.hash !== '#analytics') return;
    const rows = _getFilteredCatches();
    if (rows.length > 0) _renderActiveTab(rows);
  });

  // Init immediately if already on analytics
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _onRoute);
  } else {
    _onRoute();
  }

  window.Analytics = { initAnalyticsPage: initAnalyticsPage, renderAll: renderAll };
})();
