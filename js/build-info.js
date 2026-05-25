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

  function setLink(id, href, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.href = href;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  if (info.issueNumber != null && info.issueTitle) {
    setLink(
      'build-issue',
      `https://github.com/${REPO}/issues/${info.issueNumber}`,
      `#${info.issueNumber} ${info.issueTitle}`,
    );
  }

  if (info.commitShaShort && info.commitShaFull) {
    setLink(
      'build-sha',
      `https://github.com/${REPO}/commit/${info.commitShaFull}`,
      info.commitShaShort,
    );
  }

  if (info.builtAt) {
    setText('build-time', formatTimestamp(info.builtAt));
  }
})();
