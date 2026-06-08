(function () {
  // #158 — Pressure scoring (primary carp/coarse fishing predictor)
  // High stable anticyclone pressure (1020–1030 hPa) → fish actively feeding near surface
  // Rapidly falling pressure → fish go deep, stop feeding
  function scorePressure(hPa, trendHPaPer3h) {
    if (hPa == null) return 50;
    const p = Math.max(950, Math.min(1060, hPa));
    const t = trendHPaPer3h ?? 0;

    // Storm conditions — overrides everything
    if (p < 1000) return 0;

    // Falling sharply — fish abandon surface feeding zones
    if (t < -3) return 20;

    // Rising sharply — brief window of activity during pressure recovery
    if (t > 3) return 60;

    // Moderate fall — fish become cautious
    if (t < -1) return 50;

    // Optimal anticyclone range with stable/rising trend
    if (p >= 1020 && p <= 1030) return 95;

    // Good stable pressure
    if (p >= 1015) return 75;

    // Below optimal but stable
    return 55;
  }

  // #161 — Wind scoring
  // Light SW wind concentrates food on windward bank; very strong wind makes fishing impractical
  function scoreWind(speedKmh, gustKmh, directionDeg) {
    if (speedKmh == null) return 90;
    let base;
    if (speedKmh <= 10) base = 90;
    else if (speedKmh <= 20) base = 80;
    else if (speedKmh <= 30) base = 60;
    else if (speedKmh <= 45) base = 35;
    else if (speedKmh <= 60) base = 15;
    else base = 0;

    // Gusty conditions reduce fishing comfort and fish activity
    if (gustKmh != null && speedKmh > 0 && gustKmh / speedKmh > 1.8) {
      base = Math.max(0, base - 10);
    }
    return base;
  }

  // #169 — Precipitation scoring
  // Light rain improves fishing (washes food in, reduces light); heavy rain causes runoff, floods
  function scorePrecipitation(mmPerHour, probabilityPct) {
    if (mmPerHour == null && probabilityPct == null) return 80;

    const mm = mmPerHour ?? 0;
    const prob = probabilityPct ?? 0;

    if (mm === 0 && prob === 0) return 90;

    // Use worst-case of mm and probability thresholds
    let scoreFromMm = 90;
    if (mm > 5) scoreFromMm = 20;
    else if (mm > 2) scoreFromMm = 40;
    else if (mm > 0.5) scoreFromMm = 65;
    else if (mm > 0) scoreFromMm = 80;

    let scoreFromProb = 90;
    if (prob > 75) scoreFromProb = 20;
    else if (prob > 50) scoreFromProb = 40;
    else if (prob > 20) scoreFromProb = 65;
    else if (prob > 0) scoreFromProb = 80;

    return Math.min(scoreFromMm, scoreFromProb);
  }

  // #163 — Moon/solunar scoring (Solunar Theory, John Alden Knight 1936)
  // Major periods: moon overhead/underfoot = peak feeding activity windows
  function scoreMoon(illuminationPct, phaseName, isInMajorPeriod, isInMinorPeriod) {
    if (illuminationPct == null && phaseName == null && isInMajorPeriod == null && isInMinorPeriod == null) return 50;

    const name = (phaseName ?? '').toLowerCase();
    let base;
    if (name.includes('full') || name.includes('new')) base = 80;
    else if (name.includes('gibbous')) base = 65;
    else if (name.includes('quarter')) base = 55;
    else base = 45; // crescent or unknown

    if (isInMajorPeriod) base += 20;
    else if (isInMinorPeriod) base += 10;

    return Math.min(100, base);
  }

  // #170 — Composite fishing score
  // Weights: pressure 30%, wind 25%, moon 30%, precipitation 15%
  function computeFishingScore({ pressureScore, windScore, moonScore, precipScore } = {}) {
    const p = pressureScore ?? 50;
    const w = windScore ?? 50;
    const m = moonScore ?? 50;
    const r = precipScore ?? 50;
    return Math.round(p * 0.30 + w * 0.25 + m * 0.30 + r * 0.15);
  }

  function scoreLabelFromValue(score) {
    if (score >= 80) return { label: 'EXCELLENT', colour: 'green' };
    if (score >= 65) return { label: 'GOOD', colour: 'yellow' };
    if (score >= 45) return { label: 'FAIR', colour: 'orange' };
    return { label: 'POOR', colour: 'red' };
  }

  // #173 — Best 4-hour fishing window (sliding window over hourly scores)
  function findBestWindow(hourlyScores, windowHours) {
    if (!hourlyScores || hourlyScores.length === 0) return null;
    const w = windowHours ?? 4;
    const len = hourlyScores.length;

    if (len <= w) {
      const avg = Math.round(hourlyScores.reduce((sum, s) => sum + s.score, 0) / len);
      return {
        startTime: _formatTime(hourlyScores[0].time),
        endTime: _formatTime(hourlyScores[len - 1].time),
        averageScore: avg,
      };
    }

    let bestAvg = -1;
    let bestIdx = 0;
    for (let i = 0; i <= len - w; i++) {
      let sum = 0;
      for (let j = i; j < i + w; j++) sum += hourlyScores[j].score;
      const avg = sum / w;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestIdx = i;
      }
    }

    return {
      startTime: _formatTime(hourlyScores[bestIdx].time),
      endTime: _formatTime(hourlyScores[bestIdx + w - 1].time),
      averageScore: Math.round(bestAvg),
    };
  }

  function _formatTime(isoString) {
    const d = new Date(isoString);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // #195 — Score badge HTML component
  function renderScoreBadge(score, label) {
    const variant = score >= 80 ? 'excellent' : score >= 65 ? 'good' : score >= 45 ? 'fair' : 'poor';
    return `<span class="score-badge score-badge--${variant}">${score} ${label}</span>`;
  }

  window.FishingScore = {
    scorePressure,
    scoreWind,
    scorePrecipitation,
    scoreMoon,
    computeFishingScore,
    scoreLabelFromValue,
    findBestWindow,
    renderScoreBadge,
  };
})();
