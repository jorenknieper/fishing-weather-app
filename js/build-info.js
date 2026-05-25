'use strict';

/* global formatTimestamp */

(async function () {
  const REPO = 'jorenknieper/fishing-weather-app';

  let info;
  try {
    const res = await fetch('./data/build-info.json');
    if (!res.ok) return;
    info = await res.json();
  } catch {
    return;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  if (info.commitShaShort && info.commitShaFull) {
    const el = document.getElementById('build-sha');
    if (el) {
      el.textContent = 'source';
      el.title = info.commitShaShort;
      el.href = `https://github.com/${REPO}/commit/${info.commitShaFull}`;
    }
  }

  if (info.builtAt) {
    setText('build-time', formatTimestamp(info.builtAt));
  }
})();
