'use strict';

const fs = require('fs');
const path = require('path');
const SunCalc = require('suncalc');

// Load browser IIFE via window mock
const window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'fishing-score.js'), 'utf8'));
const { scorePressure, scoreWind, scorePrecipitation, computeFishingScore, findBestWindow, scoreLabelFromValue } =
  window.FishingScore;

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getPhaseName(phase) {
  if (phase < 0.025 || phase >= 0.975) return 'new-moon';
  if (phase < 0.225) return 'waxing-crescent';
  if (phase < 0.275) return 'first-quarter';
  if (phase < 0.475) return 'waxing-gibbous';
  if (phase < 0.525) return 'full-moon';
  if (phase < 0.725) return 'waning-gibbous';
  if (phase < 0.775) return 'last-quarter';
  return 'waning-crescent';
}

function degreesToCompass(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function run() {
  const weatherPath = path.join(__dirname, '..', 'data', 'weather.json');
  if (!fs.existsSync(weatherPath)) {
    console.error('weather.json not found');
    process.exit(1);
  }

  const weather = JSON.parse(fs.readFileSync(weatherPath, 'utf8'));
  const hourly = weather.hourly;

  // Find today's date string
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Group hourly indices by date
  const dateMap = {};
  hourly.time.forEach((t, i) => {
    const d = t.slice(0, 10);
    if (!dateMap[d]) dateMap[d] = [];
    dateMap[d].push(i);
  });

  // Get 14 forecast dates starting from today
  const forecastDates = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(todayStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    forecastDates.push(d.toISOString().slice(0, 10));
  }

  const days = forecastDates.map((dateStr, idx) => {
    const indices = dateMap[dateStr] || [];

    // Compute hourly scores for this day
    const hourlyScores = indices.map((i) => {
      const trend = i >= 3 ? (hourly.pressure_msl[i] - hourly.pressure_msl[i - 3]) : 0;
      const ps = scorePressure(hourly.pressure_msl[i], trend);
      const ws = scoreWind(hourly.wind_speed_10m[i], hourly.wind_gusts_10m[i], hourly.wind_direction_10m[i]);
      const rs = scorePrecipitation(hourly.precipitation[i], null);
      const score = computeFishingScore({ pressureScore: ps, windScore: ws, moonScore: 50, precipScore: rs });
      return { time: hourly.time[i], score };
    });

    const window4h = findBestWindow(hourlyScores, 4);

    // Daily averages
    const avgPressure =
      indices.length > 0
        ? indices.reduce((s, i) => s + (hourly.pressure_msl[i] || 0), 0) / indices.length
        : null;
    const avgWind =
      indices.length > 0
        ? indices.reduce((s, i) => s + (hourly.wind_speed_10m[i] || 0), 0) / indices.length
        : null;
    const totalPrecip =
      indices.length > 0 ? indices.reduce((s, i) => s + (hourly.precipitation[i] || 0), 0) : 0;

    // Dominant wind direction (mode)
    let windDir = 'N';
    if (indices.length > 0) {
      const midIdx = indices[Math.floor(indices.length / 2)];
      windDir = degreesToCompass(hourly.wind_direction_10m[midIdx] || 0);
    }

    // Moon phase at noon of the day
    const noon = new Date(dateStr + 'T12:00:00Z');
    const ill = SunCalc.getMoonIllumination(noon);
    const moonPhase = getPhaseName(ill.phase);
    const moonIllumination = Math.round(ill.fraction * 100);

    // Overall day score
    const pressureTrend =
      indices.length >= 3
        ? (hourly.pressure_msl[indices[indices.length - 1]] - hourly.pressure_msl[indices[0]]) /
          (indices.length / 3)
        : 0;
    const dayPs = scorePressure(avgPressure, pressureTrend);
    const dayWs = scoreWind(avgWind, null, null);
    const dayRs = scorePrecipitation(totalPrecip / (indices.length || 1), null);
    const fishingScore = computeFishingScore({
      pressureScore: dayPs,
      windScore: dayWs,
      moonScore: 50,
      precipScore: dayRs,
    });
    const { label: scoreLabel } = scoreLabelFromValue(fishingScore);

    const dateObj = new Date(dateStr + 'T12:00:00Z');
    const dayName = idx === 0 ? 'TODAY' : DAY_NAMES[dateObj.getUTCDay()];

    return {
      date: dateStr,
      dayName,
      fishingScore,
      scoreLabel,
      bestWindowStart: window4h ? window4h.startTime : null,
      bestWindowEnd: window4h ? window4h.endTime : null,
      windDir,
      windSpeedKmh: avgWind !== null ? Math.round(avgWind) : null,
      precipMm: Math.round(totalPrecip * 10) / 10,
      moonPhase,
      moonIllumination,
    };
  });

  const dest = path.join(__dirname, '..', 'data', 'forecast.json');
  fs.writeFileSync(dest, JSON.stringify(days, null, 2) + '\n');
  console.log(`Generated ${days.length} forecast days → ${dest}`);
}

run();
