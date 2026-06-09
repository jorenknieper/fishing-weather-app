function getOrCreateTooltipEl() {
  let el = document.getElementById('chart-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'chart-tooltip';
    document.body.appendChild(el);
  }
  return el;
}

function makeExternalTooltipHandler(times) {
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
  return function ({ chart, tooltip }) {
    const el = getOrCreateTooltipEl();
    if (tooltip.opacity === 0) {
      el.style.opacity = '0';
      return;
    }
    const idx = tooltip.dataPoints?.[0]?.dataIndex;
    const t = times[idx];
    let title = '';
    if (t) {
      const [, month, day] = t.slice(0, 10).split('-');
      title = `${parseInt(day)} ${months[parseInt(month) - 1]} ${t.slice(11, 16)}`;
    }
    const rows = (tooltip.dataPoints || [])
      .filter((p) => p.raw != null)
      .map(
        (p) =>
          `<div class="ct-row"><span class="ct-label">${p.dataset.label}</span><span class="ct-value">${p.formattedValue}</span></div>`,
      )
      .join('');
    el.innerHTML = `<div class="ct-title">${title}</div>${rows}`;
    el.style.opacity = '1';
    const rect = chart.canvas.getBoundingClientRect();
    const isRightHalf = tooltip.caretX > chart.width / 2;
    el.style.left = `${rect.left + tooltip.caretX}px`;
    el.style.top = `${rect.top + tooltip.caretY - 8}px`;
    el.style.transform = isRightHalf ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)';
  };
}

function makeNowLinePlugin(nowIndex) {
  return {
    id: 'nowLine',
    afterDraw(chart) {
      const scale = chart.scales.x;
      if (!scale || nowIndex < scale.min || nowIndex > scale.max) return;
      const { top, bottom, left, right } = chart.chartArea;
      const ctx = chart.ctx;
      const x = scale.getPixelForValue(nowIndex);
      const color = cssVar('--accent-pressure');
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, 0, right - left, bottom);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Now', x, top - 2);
      ctx.restore();
    },
  };
}

function makeDayLabelsPlugin(times, textColor) {
  return {
    id: 'dayLabels',
    afterDraw(chart) {
      const scale = chart.scales.x;
      if (!scale) return;
      const { top, left, right } = chart.chartArea;
      const ctx = chart.ctx;
      const n = times.length;
      const visMin = scale.min;
      const visMax = scale.max;
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

      const midnights = [];
      for (let i = Math.max(0, Math.floor(visMin)); i <= Math.min(n - 1, Math.ceil(visMax)); i++) {
        if (times[i] && times[i].slice(11, 16) === '00:00') midnights.push(i);
      }

      const segments = [];
      let segStart = visMin;
      for (const m of midnights) {
        if (m > visMin) {
          segments.push([segStart, m]);
          segStart = m;
        }
      }
      segments.push([segStart, visMax]);

      ctx.save();
      ctx.beginPath();
      ctx.rect(left, 0, right - left, top);
      ctx.clip();
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const [start, end] of segments) {
        const midIdx = Math.max(0, Math.min(n - 1, Math.round((start + end) / 2)));
        const t = times[midIdx];
        if (!t) continue;
        const [year, month, day] = t.slice(0, 10).split('-');
        const label = `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
        const xStart = Math.max(left, scale.getPixelForValue(start));
        const xEnd = Math.min(right, scale.getPixelForValue(end));
        const xCenter = (xStart + xEnd) / 2;
        ctx.fillText(label, xCenter, top - 10);
      }

      ctx.restore();
    },
  };
}
