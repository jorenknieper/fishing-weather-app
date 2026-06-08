'use strict';

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');

function readJSON(filename, fallback) {
  const filepath = path.join(DATA, filename);
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return fallback;
  }
}

function kmiStatus(kmiWarnings) {
  if (!kmiWarnings || !kmiWarnings.warnings || kmiWarnings.warnings.length === 0) return 'GREEN';
  const colours = kmiWarnings.warnings.map((w) => w.colour);
  if (colours.includes('RED')) return 'RED';
  if (colours.includes('ORANGE')) return 'ORANGE';
  if (colours.includes('YELLOW')) return 'YELLOW';
  return 'GREEN';
}

function buildAlerts(forecast, kmiWarnings, weather) {
  const alerts = [];
  const today = forecast && forecast[0];
  if (!today) return alerts;

  // Excellent conditions alert
  if (today.fishingScore >= 80) {
    alerts.push({
      type: 'excellent',
      severity: 'GREEN',
      title: 'Excellent fishing conditions',
      description: `Score ${today.fishingScore} – best window ${today.bestWindowStart || '?'}–${today.bestWindowEnd || '?'}`,
      validFrom: today.date + 'T00:00:00',
      validTo: today.date + 'T23:59:59',
    });
  }

  // High wind gust alert (from hourly data)
  const hourly = weather && weather.hourly;
  if (hourly) {
    const todayStr = today.date;
    const todayGusts = hourly.time
      .map((t, i) => (t.startsWith(todayStr) ? hourly.wind_gusts_10m[i] : null))
      .filter((v) => v !== null);
    const maxGust = todayGusts.length > 0 ? Math.max(...todayGusts) : 0;
    if (maxGust > 40) {
      alerts.push({
        type: 'high-wind',
        severity: 'ORANGE',
        title: 'High wind gusts',
        description: `Gusts up to ${Math.round(maxGust)} km/h expected today`,
        validFrom: today.date + 'T00:00:00',
        validTo: today.date + 'T23:59:59',
      });
    }

    // Pressure drop alert
    const todayPressures = hourly.time
      .map((t, i) => (t.startsWith(todayStr) ? hourly.pressure_msl[i] : null))
      .filter((v) => v !== null);
    if (todayPressures.length >= 6) {
      const drop = todayPressures[0] - todayPressures[5];
      if (drop > 5) {
        alerts.push({
          type: 'pressure-drop',
          severity: 'YELLOW',
          title: 'Pressure dropping',
          description: `Pressure falling ${drop.toFixed(1)} hPa over 6 hours — fish activity likely to decrease`,
          validFrom: today.date + 'T00:00:00',
          validTo: today.date + 'T23:59:59',
        });
      }
    }
  }

  // KMI alerts pass-through
  if (kmiWarnings && kmiWarnings.warnings) {
    kmiWarnings.warnings.forEach((w) => {
      alerts.push({
        type: 'kmi',
        severity: w.colour,
        title: w.title,
        description: w.description,
        validFrom: w.validFrom,
        validTo: w.validTo,
      });
    });
  }

  return alerts;
}

function run() {
  const forecast = readJSON('forecast.json', null);
  const kmiWarnings = readJSON('kmi-warnings.json', { warnings: [] });
  const weather = readJSON('weather.json', null);

  const today = forecast && forecast[0];
  const generatedAt = new Date().toISOString();

  const report = {
    generatedAt,
    todayScore: today ? today.fishingScore : null,
    todayLabel: today ? today.scoreLabel : null,
    bestWindowStart: today ? today.bestWindowStart : null,
    bestWindowEnd: today ? today.bestWindowEnd : null,
    kmiStatus: kmiStatus(kmiWarnings),
    kmiSummary:
      kmiWarnings.warnings.length === 0
        ? 'No active warnings'
        : `${kmiWarnings.warnings.length} active warning(s)`,
    alerts: buildAlerts(forecast, kmiWarnings, weather),
  };

  const dest = path.join(DATA, 'report.json');
  fs.writeFileSync(dest, JSON.stringify(report, null, 2) + '\n');
  console.log(`Report generated → ${dest}`);
}

run();
