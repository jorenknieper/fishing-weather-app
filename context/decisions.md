# Architectural Decisions

## Static GitHub Pages + committed JSON

**Decision:** Store weather data as a committed JSON file rather than fetching the API from the browser.

**Context:** A static host cannot run server-side code. The alternative is a direct browser fetch, but that exposes the API URL, introduces CORS risk, and shifts load timing to the user.

**Alternatives:** Direct browser fetch; serverless function proxy; AWS Lambda.

**Consequences:** Data is always at most ~1 hour stale. No API key needed. GitHub Actions handles scheduling. The file grows negligibly (one flat JSON object, overwritten each run).

---

## No frameworks

**Decision:** Vanilla HTML/CSS/JS only.

**Context:** The app is a single page with one chart. A framework would add build tooling, a node_modules tree, and deployment complexity for no functional benefit.

**Consequences:** All logic is in `app.js`. Changes are simple and grep-friendly.

---

## Chart.js with numeric x-axis

**Decision:** x-axis uses integer indices (0..n-1) rather than Chart.js time-scale with real dates.

**Context:** The time-scale type in Chart.js requires a date adapter library. Numeric indices avoid that dependency and keep zoom/pan math simple (index arithmetic instead of millisecond arithmetic).

**Consequences:** x-axis labels and the `dayLabels` plugin must always index into `times[]` using the tick value. Any change to the dataset slicing that shifts indices will break label synchronization unless `times[]` is sliced identically.

---

## Navigator as a separate canvas

**Decision:** The scrollbar is a hand-drawn `<canvas>` element rather than a Chart.js plugin or a second Chart instance.

**Context:** chartjs-plugin-zoom does not include a navigator UI. A second Chart.js instance would need synchronized scale state. A raw canvas is simpler: draw a rectangle proportional to `scale.min/max`, re-draw on every zoom/pan/drag event.

**Consequences:** `drawNavigator()` must be called explicitly after every scale change. If it is missed (e.g., after an external scale mutation), the navigator will show a stale position.

---

## Focused default viewport (±24 h around now)

**Decision:** On chart open, zoom to ±24 h around the current hour rather than showing all 14 days.

**Context:** Users care about "yesterday to tomorrow." Showing 336 points by default produces a dense, unreadable chart on mobile.

**Consequences:** `initialMin`/`initialMax` are stored at render time. The Reset button restores this specific viewport, not Chart.js's built-in "reset zoom" (which would revert to the full range).

---

## Quality CI: blocking lint vs. warn-only style checks

**Decision:** In `quality.yml`, ESLint and the `app.js` line-count check are blocking; Prettier and Stylelint run with `continue-on-error: true` (warn-only).

**Context:** Style-only churn (trailing commas, quote style) should not fail a PR, but code quality issues (lint errors) and file-size creep (app.js exceeding 1000 lines) indicate structural problems worth gating on.

**Alternatives:** `|| true` in the shell step would also avoid failure, but `continue-on-error: true` surfaces a visible warning glyph in the GitHub UI so the signal is not silently lost.

**Dual trigger (PR + push to main):** Both inbound contributions via pull request and direct pushes to main are gated. Without the `push` trigger, a committer with write access bypassing PR review would skip quality checks entirely.

**Consequences:** PRs will be blocked by lint or line-count violations but will pass with only Prettier or Stylelint warnings. The 1000-line ceiling creates a hard incentive to extract logic before `app.js` grows unwieldy.

---

## Why Open-Meteo

**Decision:** Use Open-Meteo as the weather API.

**Context:** No API key required, free for non-commercial use, good coverage for Belgium, returns both current conditions and multi-day hourly forecasts in one request.

**Consequences:** If Open-Meteo changes its schema, `update-weather.sh` and `renderWeather()` may need updates. The validation check in the shell script (`grep -q '"current"'`) provides a minimal safety net.
