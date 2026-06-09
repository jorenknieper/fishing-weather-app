'use strict';

const SunCalc = require('suncalc');
const fs = require('fs');
const path = require('path');

const LAT = 51.0748;
const LON = 3.4486;
const DAYS = 30;

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

function toISO(date) {
  if (!date) return null;
  return date.toISOString();
}

function generateDay(dateStr) {
  // Use noon UTC to avoid DST edge cases for illumination
  const noon = new Date(dateStr + 'T12:00:00Z');
  const ill = SunCalc.getMoonIllumination(noon);
  const times = SunCalc.getMoonTimes(new Date(dateStr + 'T00:00:00Z'), LAT, LON);

  const H = 60 * 60 * 1000;
  let majorStart = null,
    majorEnd = null;
  let minorStart = null,
    minorEnd = null;

  if (times.rise && times.set) {
    const riseMs = times.rise.getTime();
    const setMs = times.set.getTime();
    const transitMs = (riseMs + setMs) / 2;
    majorStart = toISO(new Date(transitMs - H));
    majorEnd = toISO(new Date(transitMs + H));
    minorStart = toISO(new Date(riseMs - 0.5 * H));
    minorEnd = toISO(new Date(riseMs + 0.5 * H));
  }

  return {
    date: dateStr,
    phase: getPhaseName(ill.phase),
    illumination: Math.round(ill.fraction * 100),
    moonrise: toISO(times.rise),
    moonset: toISO(times.set),
    majorStart,
    majorEnd,
    minorStart,
    minorEnd,
  };
}

function run() {
  const days = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < DAYS; i++) {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    days.push(generateDay(dateStr));
  }

  const dest = path.join(__dirname, '..', 'data', 'moon.json');
  fs.writeFileSync(dest, JSON.stringify(days, null, 2) + '\n');
  console.log(`Generated ${days.length} days → ${dest}`);
}

run();
