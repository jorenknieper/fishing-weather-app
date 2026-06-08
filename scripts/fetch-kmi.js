'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const FEED_URL = 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-belgium';
const DEST = path.join(__dirname, '..', 'data', 'kmi-warnings.json');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { timeout: 15000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      })
      .on('error', reject)
      .on('timeout', () => reject(new Error('timeout')));
  });
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function mapSeverityToColour(severity) {
  switch ((severity || '').toLowerCase()) {
    case 'minor':
      return 'YELLOW';
    case 'moderate':
      return 'ORANGE';
    case 'severe':
    case 'extreme':
      return 'RED';
    default:
      return 'YELLOW';
  }
}

// Check if an area matches Flanders / Belgium (Aalter = East Flanders = BE2xx)
function isRelevantArea(areaXml) {
  if (!areaXml) return false;
  const desc = (extractTag(areaXml, 'cap:areaDesc') || extractTag(areaXml, 'areaDesc') || '').toLowerCase();
  const geocodeVal = (extractTag(areaXml, 'cap:value') || extractTag(areaXml, 'value') || '').toUpperCase();

  // Belgium-wide or Flanders-specific
  if (
    desc.includes('belgium') ||
    desc.includes('flanders') ||
    desc.includes('vlaanderen') ||
    desc.includes('oost-vlaanderen') ||
    geocodeVal.startsWith('BE2') ||
    geocodeVal === 'BE'
  ) {
    return true;
  }
  return false;
}

function parseEntries(xml) {
  const warnings = [];
  const entryPattern = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = entryPattern.exec(xml)) !== null) {
    const entry = match[1];

    // Skip non-actual messages (test, exercise, etc.)
    const status = (extractTag(entry, 'cap:status') || extractTag(entry, 'status') || '').toLowerCase();
    if (status && status !== 'actual') continue;

    const id = extractTag(entry, 'id') || extractTag(entry, 'cap:identifier');
    const title = extractTag(entry, 'title');
    const severity = extractTag(entry, 'cap:severity') || extractTag(entry, 'severity');
    const description = extractTag(entry, 'cap:description') || extractTag(entry, 'description');
    const headline = extractTag(entry, 'cap:headline') || extractTag(entry, 'headline') || title;
    const effective = extractTag(entry, 'cap:effective') || extractTag(entry, 'effective');
    const expires = extractTag(entry, 'cap:expires') || extractTag(entry, 'expires');
    const areaDesc = extractTag(entry, 'cap:areaDesc') || extractTag(entry, 'areaDesc');

    if (!isRelevantArea(entry)) continue;

    warnings.push({
      id,
      severity,
      colour: mapSeverityToColour(severity),
      title: headline,
      description,
      validFrom: effective,
      validTo: expires,
      area: areaDesc,
    });
  }

  return warnings;
}

async function run() {
  const updatedAt = new Date().toISOString();
  let result;

  try {
    const xml = await fetchUrl(FEED_URL);
    const warnings = parseEntries(xml);
    result = { updatedAt, warnings };
    console.log(`KMI: found ${warnings.length} relevant warning(s)`);
  } catch (err) {
    console.error('KMI fetch failed:', err.message);
    result = { updatedAt, warnings: [], error: 'unavailable' };
  }

  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  fs.writeFileSync(DEST, JSON.stringify(result, null, 2) + '\n');
  console.log(`Written → ${DEST}`);
}

run();
