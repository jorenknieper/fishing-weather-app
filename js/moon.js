(function () {
  const LAT = 51.0748;
  const LON = 3.4486;

  // Phase thresholds with epsilon bands
  function _phaseName(phase) {
    if (phase < 0.025 || phase >= 0.975) return 'New Moon';
    if (phase < 0.225) return 'Waxing Crescent';
    if (phase < 0.275) return 'First Quarter';
    if (phase < 0.475) return 'Waxing Gibbous';
    if (phase < 0.525) return 'Full Moon';
    if (phase < 0.725) return 'Waning Gibbous';
    if (phase < 0.775) return 'Last Quarter';
    return 'Waning Crescent';
  }

  function getMoonPhase(date) {
    const ill = SunCalc.getMoonIllumination(date);
    return {
      fraction: ill.fraction,
      phase: ill.phase,
      phaseName: _phaseName(ill.phase),
      illumination: Math.round(ill.fraction * 100),
    };
  }

  function getMoonTimes(date, lat, lon) {
    const times = SunCalc.getMoonTimes(date, lat ?? LAT, lon ?? LON);
    return { rise: times.rise, set: times.set };
  }

  function getSolunarPeriods(date, lat, lon) {
    const times = SunCalc.getMoonTimes(date, lat ?? LAT, lon ?? LON);
    const major = [];
    const minor = [];
    const H = 60 * 60 * 1000;

    // Compute transit as midpoint between rise and set on the same day
    // Anti-transit is 12.4h later (lunar half-period)
    if (times.rise && times.set) {
      const riseMs = times.rise.getTime();
      const setMs = times.set.getTime();
      const transitMs = (riseMs + setMs) / 2;
      const antiTransitMs = transitMs + 12.4 * H;

      major.push({ start: new Date(transitMs - H), end: new Date(transitMs + H) });
      major.push({ start: new Date(antiTransitMs - H), end: new Date(antiTransitMs + H) });
      minor.push({ start: new Date(riseMs - 0.5 * H), end: new Date(riseMs + 0.5 * H) });
      minor.push({ start: new Date(setMs - 0.5 * H), end: new Date(setMs + 0.5 * H) });
    } else if (times.rise) {
      // Moon doesn't set — only rise-based minor
      const riseMs = times.rise.getTime();
      minor.push({ start: new Date(riseMs - 0.5 * H), end: new Date(riseMs + 0.5 * H) });
    } else if (times.set) {
      const setMs = times.set.getTime();
      minor.push({ start: new Date(setMs - 0.5 * H), end: new Date(setMs + 0.5 * H) });
    }

    return { major, minor };
  }

  // phaseName → file slug map
  const _PHASE_SLUGS = {
    'New Moon': 'moon-new',
    'Waxing Crescent': 'moon-waxing-crescent',
    'First Quarter': 'moon-first-quarter',
    'Waxing Gibbous': 'moon-waxing-gibbous',
    'Full Moon': 'moon-full',
    'Waning Gibbous': 'moon-waning-gibbous',
    'Last Quarter': 'moon-last-quarter',
    'Waning Crescent': 'moon-waning-crescent',
  };

  function moonPhaseIcon(phaseName, sizePx) {
    const size = sizePx ?? 24;
    const slug = _PHASE_SLUGS[phaseName] ?? 'moon-new';
    return `<img src="img/${slug}.svg" width="${size}" height="${size}" alt="${phaseName}" class="moon-icon">`;
  }

  window.Moon = { getMoonPhase, getMoonTimes, getSolunarPeriods, moonPhaseIcon };
})();
