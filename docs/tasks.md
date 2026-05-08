# Tasks

## TASK-001: Build static frontend

**Status:** To Do

### Goal

Build `index.html`, `app.js`, and `style.css` so the dashboard reads `data/weather.json` and displays current fishing-relevant weather for Aalter, Belgium.

### Expected data/weather.json shape

The frontend assumes this structure (produced by TASK-002):

```json
{
  "current": {
    "time": "2026-05-07T14:00",
    "temperature_2m": 16.2,
    "apparent_temperature": 14.5,
    "relative_humidity_2m": 72,
    "surface_pressure": 1012.4,
    "pressure_msl": 1015.1,
    "precipitation": 0.0,
    "wind_speed_10m": 18.3,
    "wind_direction_10m": 225,
    "is_day": 1
  }
}
```

### Deliverables

**`index.html`**
- Static HTML shell with named DOM elements for each metric
- Links to `style.css` and `app.js`
- Shows location name ("Aalter") and a "last updated" timestamp

**`app.js`**
- `fetch('./data/weather.json')` on page load
- Parses `current` block and populates the DOM
- Converts wind direction degrees to a compass label (N, NE, E, …)
- Shows a human-readable timestamp from `current.time`
- Displays a clear error message if the fetch fails or JSON is malformed

**`style.css`**
- Mobile-first layout (single column on small screens)
- Cards or sections for each metric group
- No external fonts or icon libraries

### Acceptance criteria

- [ ] `python3 -m http.server 8080` and visiting `http://localhost:8080` shows all metrics from `data/weather.json`
- [ ] The page shows a clear error state when `data/weather.json` is absent or malformed — no broken layout or console exceptions
- [ ] The dashboard is readable on a 375px wide mobile screen

### Out of scope

- `scripts/update-weather.sh` (TASK-002)
- GitHub Actions workflow (TASK-003)
- Pressure trend, moon phase, fishing activity score, multiple spots

---

## TASK-002: Write update-weather.sh script

**Status:** To Do  
**Depends on:** TASK-001 (defines the expected JSON shape)

### Goal

Write `scripts/update-weather.sh` so it fetches current weather for Aalter from the Open-Meteo API and writes the raw response to `data/weather.json`.

### Open-Meteo parameters

Location: Aalter, Belgium (lat: 51.0748, lon: 3.4486)

| Parameter | Description |
|---|---|
| `temperature_2m` | Air temperature at 2m (°C) |
| `apparent_temperature` | Feels-like temperature (°C) |
| `relative_humidity_2m` | Relative humidity (%) |
| `surface_pressure` | Surface pressure (hPa) |
| `pressure_msl` | Sea-level pressure (hPa) |
| `precipitation` | Precipitation (mm) |
| `wind_speed_10m` | Wind speed at 10m (km/h) |
| `wind_direction_10m` | Wind direction at 10m (°) |
| `is_day` | Whether it is daytime (1/0) |

Target URL:
```
https://api.open-meteo.com/v1/forecast?latitude=51.0748&longitude=3.4486&current=temperature_2m,apparent_temperature,relative_humidity_2m,surface_pressure,pressure_msl,precipitation,wind_speed_10m,wind_direction_10m,is_day&timezone=Europe%2FBrussels
```

### Deliverables

**`scripts/update-weather.sh`**
- Fetches the URL above using `curl`
- Writes the raw JSON response to `data/weather.json`
- Exits with a non-zero code if the curl call fails

### Acceptance criteria

- [ ] Running `bash scripts/update-weather.sh` produces a valid `data/weather.json` with a `current` block
- [ ] Script exits non-zero on network failure (no silent overwrite of existing data with empty or error body)

### Out of scope

- GitHub Actions scheduling (TASK-003)
- Any data transformation beyond writing the raw API response

---

## TASK-003: Add GitHub Actions workflow

**Status:** To Do  
**Depends on:** TASK-002

### Goal

Add `.github/workflows/update-weather.yml` so `scripts/update-weather.sh` runs on a schedule, commits the updated `data/weather.json`, and keeps the GitHub Pages site current.

### Deliverables

**`.github/workflows/update-weather.yml`**
- Triggers: `schedule` (every hour) and `workflow_dispatch`
- Steps: checkout → run `update-weather.sh` → commit and push `data/weather.json` if changed

### Acceptance criteria

- [ ] Workflow appears in the GitHub Actions tab and can be triggered manually via `workflow_dispatch`
- [ ] After a manual run, `data/weather.json` in the repository reflects fresh Open-Meteo data
- [ ] Workflow does not commit or fail when `data/weather.json` has not changed

### Out of scope

- Secrets or API keys (Open-Meteo is public)
- Notifications or alerting on failure

---

## TASK-004: Show "Last updated" timestamp on the dashboard

**Status:** To Do  
**Depends on:** TASK-001, TASK-002

### Goal

Display the timestamp from `data/weather.json` (`current.time`) as a human-readable "Last updated" line on the dashboard so users know how fresh the data is.

### Scope

- Read `current.time` from the already-fetched JSON
- Format it as a readable local date/time string (e.g. "7 May 2026, 22:45")
- Render it in the existing footer or below the grid — no new card needed

### Deliverables

**`app.js`**
- Format `current.time` using `Date` + `toLocaleString` (locale `en-BE`, Brussels timezone)
- Populate the existing `#last-updated` element

**`index.html`**
- Confirm `#last-updated` element exists in the footer (add if missing)

### Acceptance criteria

- [ ] Dashboard shows a formatted timestamp that matches the `current.time` value in `data/weather.json`
- [ ] Timestamp is human-readable and uses the Europe/Brussels timezone
- [ ] No visible change when `current.time` is missing — element shows "–"

### Risks

- `current.time` from Open-Meteo is a local ISO string without timezone offset; pass `timezone: 'Europe/Brussels'` explicitly to `toLocaleString` to avoid browser-timezone drift

### Out of scope

- Relative time ("5 minutes ago")
- Auto-refresh of data in the browser

---

## TASK-005: Add dark mode toggle

**Status:** To Do  
**Depends on:** TASK-001

### Goal

Add a toggle button that switches the dashboard between light and dark mode. Persist the user's preference in `localStorage` so it survives page reloads.

### Scope

- Toggle button in the header
- CSS custom properties for theming (no duplication of rules)
- Preference persisted in `localStorage` under a single key
- No frameworks, no external libraries

### Deliverables

**`index.html`**
- Add a `<button id="theme-toggle">` in the header

**`style.css`**
- Define colour tokens as CSS custom properties on `:root` (light defaults)
- Add a `[data-theme="dark"]` selector on `<html>` that overrides the tokens
- Ensure all existing colour references use the tokens

**`app.js`**
- On load: read `localStorage.getItem('theme')`, apply `data-theme` attribute to `<html>` and set button label
- On button click: toggle `data-theme`, update `localStorage`, update button label

### Acceptance criteria

- [ ] Toggle button is visible and tappable on a 375px screen
- [ ] Clicking the button switches between light and dark mode without a page reload
- [ ] Preference survives a page reload (verified by refreshing after toggling)
- [ ] Dark mode has sufficient contrast on all cards and text elements

### Risks

- System preference (`prefers-color-scheme`) is not required for this task but should not conflict with the manual toggle

### Out of scope

- Automatic system-preference detection
- Transition animations

---

## TASK-006: Add pressure chart (24h history + 24h forecast)

**Status:** To Do  
**Depends on:** TASK-001, TASK-002

### Goal

Clicking the pressure card opens a detailed pressure graph showing the past 24 hours of actual pressure and the next 24 hours of forecast pressure, using Open-Meteo hourly data.

### Scope

- Pressure card in the dashboard becomes clickable
- A modal or expanded panel shows the chart
- Chart covers past 24h + next 24h of `pressure_msl`
- Zoom/pan supported if achievable without a heavy dependency

### Data requirements

`scripts/update-weather.sh` must be extended to also fetch hourly `pressure_msl` for a 48-hour window (past 24h + next 24h). Add the `hourly=pressure_msl` parameter and set `forecast_days=2&past_days=1` on the Open-Meteo URL. The resulting JSON gains an `hourly` block:

```json
{
  "hourly": {
    "time": ["2026-05-06T23:00", "2026-05-07T00:00", "..."],
    "pressure_msl": [1013.2, 1013.8, "..."]
  }
}
```

### Deliverables

**`scripts/update-weather.sh`**
- Add `hourly=pressure_msl&past_days=1&forecast_days=2` to the Open-Meteo URL

**`index.html`**
- Make the pressure card(s) clickable (button or anchor role)
- Add a modal/overlay element for the chart (hidden by default)
- Add a close button on the modal

**`app.js`**
- Parse `hourly.time` and `hourly.pressure_msl` arrays
- Identify the current hour as the boundary between past and forecast
- Render the chart using the Canvas API (`<canvas>`) — no charting library required for a basic line chart
- If a lightweight library (e.g. Chart.js via CDN) is chosen, justify the decision in the PR

**`style.css`**
- Modal overlay styles (full-screen on mobile, centred on desktop)
- Canvas fills the modal width

### Acceptance criteria

- [ ] Clicking the pressure card opens the chart modal
- [ ] Chart shows a continuous line for past 24h and forecast 24h, visually distinguished (e.g. solid vs dashed)
- [ ] Current hour is marked on the chart
- [ ] Modal closes via the close button and via pressing Escape
- [ ] Chart is readable on a 375px screen
- [ ] Page still works if `hourly` block is missing from JSON (modal opens but shows "No data")

### Risks

- Canvas-based charting from scratch can grow complex; if it exceeds ~80 lines of chart code, switch to Chart.js (CDN, no npm)
- `past_days=1` on Open-Meteo returns up to 24h of past data but coverage depends on model run timing; handle gaps gracefully

### Out of scope

- Other metrics in the chart
- Saving or sharing the chart
- Zoom/pan beyond what the Canvas API supports without a library

---

## TASK-007: Improve pressure chart Y-axis scaling

**Status:** To Do  
**Depends on:** TASK-006

### Goal

The current pressure chart auto-scales to the exact data range, making 1–2 hPa fluctuations fill the full chart height. Improve Y-axis readability by adding controlled scaling and a simple two-mode scale toggle.

### Scope

`app.js`, `index.html`, `style.css` only. Pressure chart only. No other metrics, no new dependencies, no redesign.

### Deliverables

**`app.js`**

- Add a module-level `pressureScaleMode` variable (default `'auto'`)
- Add `getYAxisRange(pressures)` — returns `{ min, max }` based on the active mode:
  - **Auto**: pad data min/max by ±5 hPa, then round both values to the nearest 5 hPa
  - **Context**: fixed range `{ min: 990, max: 1040 }`
- Add `setPressureScale(mode)` — updates `pressureScaleMode`, syncs button active states, re-renders the chart
- Update `renderPressureChart` to:
  - Call `getYAxisRange` and pass `min`/`max` to the Chart.js Y-axis config
  - Set `stepSize: 5` on Y-axis ticks
- Update `openPressureModal` to sync scale button active states on open

**`index.html`**

- Add a scale toggle inside `.modal-body`, above the canvas:
  ```html
  <div class="scale-toggle">
    <button class="scale-btn" data-scale="auto" onclick="setPressureScale('auto')">Auto</button>
    <button class="scale-btn" data-scale="context" onclick="setPressureScale('context')">Context</button>
  </div>
  ```

**`style.css`**

- Add styles for `.scale-toggle`, `.scale-btn`, and `.scale-btn--active`
- Active button should use `--color-card-value` as background
- Inactive button should use `--color-muted` border and text
- Must render correctly in dark mode

### Acceptance criteria

- [ ] A 1–2 hPa fluctuation no longer fills the full chart height in Auto mode
- [ ] Y-axis ticks appear at 5 hPa intervals
- [ ] Auto mode: Y-axis min/max are padded by ±5 hPa and rounded to the nearest 5 hPa
- [ ] Context mode: Y-axis is fixed at 990–1040 hPa regardless of data
- [ ] Toggling between Auto and Context re-renders the chart without closing the modal
- [ ] The active scale button is visually distinct from the inactive one
- [ ] Historical (solid) vs forecast (dashed) line styling is unchanged
- [ ] Modal open/close, Escape key, and backdrop click still work
- [ ] Dark mode renders correctly for chart colours and scale buttons
- [ ] Layout is readable on a 375px screen — buttons must not overflow

### Risks

- `Math.min(...valid)` will throw if `valid` is empty — guard with a fallback range before spreading
- On 375px screens, the modal header already contains a title and close button; place the scale toggle in `.modal-body` (above the canvas) rather than the header to avoid overflow

### Out of scope

- Charts for other weather metrics
- 7-day history or extended forecast
- Zoom or pan controls
- Persisting scale preference in `localStorage`
- Additional charting libraries

---

## TASK-008: Replace scale toggle with zoom and pan on the pressure chart

**Status:** To Do  
**Depends on:** TASK-007

### Goal

Replace the Auto/Context scale toggle with native zoom and pan on the pressure chart. The chart should open with a sensible initial scale and allow the user to explore the data interactively by zooming and panning.

### Scope

`app.js`, `index.html`, `style.css` only. Pressure chart only. No other metrics. No npm build setup.

### Deliverables

**`app.js`**

- Remove `pressureScaleMode`, `getYAxisRange`, and `setPressureScale` — these are no longer needed
- Remove the `.scale-btn` active-state sync from `openPressureModal`
- Set a fixed initial Y-axis range: pad data min/max by ±5 hPa and round to the nearest 5 hPa (reuse the Auto logic from TASK-007, but hardcode it — no toggle needed)
- Set `stepSize: 5` on Y-axis ticks
- Enable zoom and pan via the Chart.js zoom plugin:
  - `zoom.wheel.enabled: true`
  - `zoom.pinch.enabled: true` (touch / mobile)
  - `zoom.mode: 'x'` (X-axis zoom only keeps the pressure range readable)
  - `pan.enabled: true`, `pan.mode: 'x'`
- Destroy and re-create the chart instance when the modal opens (already done via `pressureChartInstance.destroy()`)

**`index.html`**

- Remove the `.scale-toggle` div and its two buttons
- Add the Chart.js zoom plugin CDN script **after** the Chart.js CDN script and **before** `app.js`:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2/dist/chartjs-plugin-zoom.min.js"></script>
  ```
  The zoom plugin depends on Hammer.js for touch; the CDN bundle includes it.

**`style.css`**

- Remove `.scale-toggle`, `.scale-btn`, and `.scale-btn--active` rules

### Acceptance criteria

- [ ] No Auto/Context toggle is visible in the modal
- [ ] Pressure chart opens with Y-axis ticks at 5 hPa intervals
- [ ] Initial Y-axis range is padded ±5 hPa around the data, rounded to nearest 5
- [ ] Scrolling/pinching on the chart zooms the X-axis
- [ ] Dragging pans through the chart after zooming in
- [ ] Historical (solid) vs forecast (dashed) line styling is unchanged
- [ ] Modal close button, Escape key, and outside-click still close the modal
- [ ] Dark mode renders correctly
- [ ] No console errors on load or modal open
- [ ] Chart is usable on a 375px screen (pinch-to-zoom works on mobile)

### Risks

- The Chart.js zoom plugin (`chartjs-plugin-zoom`) must be registered before the chart is created; the CDN bundle auto-registers when loaded after `chart.js`
- `zoom.mode: 'x'` only — Y-axis zoom is intentionally disabled to keep pressure values readable at a glance
- If the CDN is unreachable, zoom/pan will silently degrade (chart renders without interactivity); this is acceptable for an MVP
- The zoom plugin CDN bundle (`chartjs-plugin-zoom@2`) ships with Hammer.js for touch support; no separate Hammer.js script tag is needed

### Implementation notes

- Reuse the Auto padding logic from TASK-007 (`Math.floor((min - 5) / 5) * 5`, `Math.ceil((max + 5) / 5) * 5`) inline in `renderPressureChart` — no need for a separate helper now that there is only one mode
- Plugin options go inside `options.plugins.zoom` in the Chart.js config object
- `chartjs-plugin-zoom@2` is compatible with Chart.js v4 (already in use)

### Out of scope

- Charts for other weather metrics
- 7-day history or extended forecast
- Y-axis zoom
- A reset-zoom button (can be added as a follow-up)
- npm or bundler setup

---

## TASK-009: Improve pressure chart navigation labels and add a reset button

**Status:** To Do  
**Depends on:** TASK-008

### Goal

When users zoom and pan the pressure chart they can lose track of which day they are viewing. Add date context to X-axis labels when the chart crosses a day boundary, make labels adapt to the current zoom level so they remain readable at any zoom depth, and add a reset button that restores the default view.

### Scope

`app.js`, `index.html`, `style.css` only. Pressure chart only. No other metrics.

### Deliverables

**`app.js`**

- Replace the flat `HH:MM` label array with labels that mark day boundaries. For midnight entries return a two-line array `['8 May', '00:00']`; for all other entries return `'HH:MM'`
- Add a `ticks.callback` on the X-axis scale that adapts the label based on how many data points are currently visible (i.e. the zoom level):
  - **Zoomed out** (many points visible): show every label as `HH:MM`; suppress intermediate ticks via `maxTicksLimit`
  - **Zoomed in** (few points visible): show all hourly labels; since the source data is hourly, `HH:MM` remains the finest available granularity — do not fabricate sub-hour ticks
  - **Day-boundary ticks** always show the date regardless of zoom level
- Add a `resetPressureChart()` function that calls `pressureChartInstance.resetZoom()` (provided by `chartjs-plugin-zoom`)
- Update `openPressureModal` to ensure the reset button is always visible when the modal opens

**`index.html`**

- Add a reset button inside `.modal-header`, between the title and the close button:
  ```html
  <button id="chart-reset" onclick="resetPressureChart()">Reset</button>
  ```

**`style.css`**

- Style `#chart-reset` consistently with the existing `.modal-close` button (muted colour, no background, small font)
- Button must be tappable on mobile

### Acceptance criteria

- [ ] X-axis shows `HH:MM` for most ticks
- [ ] X-axis shows a short date + time label (e.g. `"8 May"` / `"00:00"`) when crossing midnight, at all zoom levels
- [ ] When zoomed out, only a subset of hourly labels is shown (no overlap)
- [ ] When zoomed in, all visible hourly ticks are labelled
- [ ] Labels remain readable and do not overlap on a 375px screen at any zoom level
- [ ] A Reset button is visible in the modal header
- [ ] Clicking Reset returns the chart to the initial zoom and pan position
- [ ] Zoom and pan still work after reset
- [ ] Historical (solid) vs forecast (dashed) line styling is unchanged
- [ ] Modal close button, Escape key, and outside-click still work
- [ ] Dark mode renders correctly
- [ ] No console errors

### Risks

- Chart.js `maxTicksLimit` may suppress day-boundary labels when zoomed out; the `ticks.callback` approach does not protect against this — consider removing `maxTicksLimit` and relying on the callback to return `undefined` for ticks that should be hidden, which Chart.js will then skip
- Multi-line tick labels in Chart.js require the label to be an array: `['8 May', '00:00']` — a plain string with `\n` will not wrap
- The source data is hourly; sub-hour granularity is not available from Open-Meteo. "More granular labels when zoomed in" means showing all hourly ticks rather than a sampled subset — not adding minute-level ticks
- `ticks.callback` receives the tick index, not the raw time string; use the index to look up the corresponding entry in the `times` array to get the ISO string for formatting
- `pressureChartInstance.resetZoom()` is provided by `chartjs-plugin-zoom`; guard with a null check in case the plugin failed to load

### Implementation notes

- Store the `times` array in a variable accessible to the `ticks.callback` (it is already local to `renderPressureChart`; the callback can close over it)
- `ticks.callback` signature: `function(value, index)` — use `index` to read `times[index]`, extract the time portion, and decide what to return:
  - If `times[index]` ends in `T00:00` → return `['8 May', '00:00']`
  - Otherwise, check how many ticks are currently visible via `this.chart.scales.x`; if the visible range covers more than ~12 points, return `undefined` for even-indexed ticks to thin them out; otherwise return `'HH:MM'`
- Remove `maxTicksLimit` from the X-axis config — rely solely on the callback for density control
- `resetZoom()` is called directly on the Chart.js instance: `pressureChartInstance.resetZoom()`
- Keep `maxRotation: 0` — multi-line labels do not need rotation

### Out of scope

- Other metric charts
- 7-day history or extended forecast
- Animated zoom reset
- Custom tick formatting for the Y-axis
- npm or bundler setup

---

## TASK-010: Add a visible range navigator to the pressure chart

**Status:** To Do  
**Depends on:** TASK-009

### Goal

The chart supports zoom and pan but there is no visual indicator of where the user is in the full timeline. Add a small navigator strip below the chart so users can see and drag their position without losing context.

### Scope

`app.js`, `index.html`, `style.css` only. Pressure chart only.

### Deliverables

**`app.js`**

- After creating `pressureChartInstance`, draw a miniature navigator on `#pressure-navigator`:
  - Draw the full pressure line (all visible points) scaled to the canvas height
  - Draw a highlight rect showing the currently visible X window
- Redraw the navigator highlight whenever the main chart zoom or pan changes — wire up via the zoom plugin's `onZoomComplete` and `onPanComplete` options (both accept a function receiving the chart instance)
- Handle `mousedown` / `mousemove` / `mouseup` and `touchstart` / `touchmove` / `touchend` on the navigator canvas to allow dragging the highlight rect, then call `pressureChartInstance.zoomScale('x', { min, max })` to sync the main chart
- In `resetPressureChart()`, after `pressureChartInstance.resetZoom()`, also trigger a navigator redraw

**`index.html`**

- Add `<canvas id="pressure-navigator"></canvas>` inside `.modal-body`, directly below `#pressure-chart`

**`style.css`**

- Set a fixed height on `#pressure-navigator` (e.g. `40px`), full width, subtle top border to separate it from the main chart
- Set `cursor: grab` on `#pressure-navigator` and `cursor: grabbing` while dragging (toggle via a class)

### Acceptance criteria

- [ ] Navigator strip is visible below the pressure chart
- [ ] Navigator shows a scaled version of the full pressure line
- [ ] Navigator highlight rect reflects the currently visible window
- [ ] Dragging the highlight rect pans the main chart
- [ ] Zooming the main chart updates the navigator highlight
- [ ] Reset restores both the main chart and the navigator highlight
- [ ] Works on 375px mobile (touch drag supported)
- [ ] Dark mode renders correctly
- [ ] No console errors

### Risks

- Navigator canvas size must be set explicitly in JS (`canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight`) before drawing — the canvas may have zero dimensions if read before the modal is fully visible; draw after `classList.remove('hidden')` in `openPressureModal`
- `zoomScale` signature may differ across `chartjs-plugin-zoom` patch versions — verify against the installed version before using; fallback is `chart.zoom({x: factor})` which is less precise
- Touch listeners need `{ passive: false }` to call `preventDefault()` and prevent scroll conflicts on mobile

### Out of scope

- Other metric charts
- 7-day data (TASK-012, TASK-013)
- npm or bundler setup

---

## TASK-011: Improve pressure chart date/time readability and visual polish

**Status:** To Do  
**Depends on:** TASK-009

### Goal

The current implementation places date labels inline on the X-axis, where they crowd or overlap time labels and look cluttered. Separate the concerns: time labels stay on the X-axis, and day labels move above the chart area as a clean strip — one date per visible day, clearly positioned over its section. Vertical day-boundary lines reinforce the transition. The result should feel like a polished dashboard modal: calm, readable, well-spaced.

### Scope

`app.js` only. Pressure chart only.

### Desired UX

- The X-axis shows only `HH:MM` time labels — no dates inline.
- Each visible calendar day is labelled above the chart area (e.g. `"7 May 2026"`, `"8 May 2026"`), centred over its portion of the visible time range.
- A vertical day-boundary line runs the full height of the chart area at each midnight crossing.
- As the user pans and zooms, day labels and boundary lines update in realtime.
- Labels never overlap. The layout is readable on a 375px screen.

### Deliverables

**`app.js`**

**1. X-axis ticks — time only**

Update `ticks.callback` to return `HH:MM` for all entries including midnight — no date text in the ticks. Keep the three-level density thinning based on visible point count:
- **Wide** (> 24 visible): every 4th index; skip others with `undefined`
- **Mid** (8–24 visible): every 2nd index; skip others with `undefined`
- **Narrow** (< 8 visible): every label

**2. Day-boundary gridlines**

Keep the `grid.color` callback on `scales.x` so midnight ticks render with `accentColor` (`--color-card-value` resolved at render time) and all other ticks use `gridColor`. This provides a subtle visual separator in the chart body.

**3. Day labels above the chart — inline Chart.js plugin**

Register a one-off inline plugin on the chart config (inside the `plugins` array of the Chart.js constructor call, not globally via `Chart.register`) that draws day labels after each render:

```javascript
{
  id: 'dayLabels',
  afterDraw(chart) {
    // For each midnight index visible in the current zoom window,
    // draw the date string (e.g. "7 May 2026") above chart.chartArea.top,
    // centred horizontally over the day's visible portion.
    // Clip to the chart area width so labels never overflow into the Y-axis or padding.
  }
}
```

Implementation notes for the plugin:
- Use `chart.scales.x` to map a data index to a pixel X position: `chart.scales.x.getPixelForValue(index)`
- Find all midnight indices within `[scale.min, scale.max]` from the `times` closure
- For each midnight index `i`, the day label for "the day that starts at `times[i]`" should be centred between `getPixelForValue(i)` and `getPixelForValue(nextMidnightIndex)` (or `chartArea.right` for the last visible day)
- Draw the label at `y = chart.chartArea.top - 6` (6px above the chart area top edge)
- Font: `'11px system-ui, sans-serif'`, fill with `textColor`, `textAlign: 'center'`
- If the first visible tick is not at midnight (i.e. the user is panned into the middle of a day), also draw the label for that partial day, centred over the visible portion of it
- Clip drawing to `[chartArea.left, chartArea.right]` using `ctx.save()` / `ctx.restore()` with `ctx.rect` clipping

**4. Chart top padding**

Add `layout: { padding: { top: 20 } }` to the Chart.js options object so the chart area does not overlap with the day labels drawn above it.

### Acceptance criteria

- [ ] X-axis shows `HH:MM` only — no date text on the tick labels
- [ ] At least one day label (e.g. "7 May 2026") is visible above the chart at all zoom levels
- [ ] Day labels are centred over their respective day's visible section
- [ ] A day-boundary vertical line is visible at each midnight crossing within the chart
- [ ] Day labels and boundary lines update correctly when panning or zooming
- [ ] Wide view (> 24h visible): time ticks appear every 4 hours
- [ ] Mid view (8–24h visible): time ticks appear every 2 hours
- [ ] Narrow view (< 8h visible): all hourly time ticks are shown
- [ ] No label overlap on a 375px screen at any zoom level
- [ ] Reset restores the default view with correct labels and lines
- [ ] Dark mode renders day labels and gridlines with correct colours
- [ ] No console errors on open, zoom, pan, or reset

### Risks

- `chart.scales.x.getPixelForValue(index)` may return values outside `[chartArea.left, chartArea.right]` when a day starts off-screen — clamp or skip drawing for those cases
- The `afterDraw` plugin fires on every animation frame during zoom/pan; keep the drawing logic simple (no heavy computation inside the callback) to avoid jank
- If `times` contains no midnight entries (e.g. data is entirely within a single calendar day), no day labels will render — this is acceptable; the chart is still readable from the time ticks alone
- `layout.padding.top: 20` increases the canvas height slightly; verify the modal does not overflow on short screens

### Out of scope

- Sub-hour labels
- Other metric charts
- 7-day data (TASK-012, TASK-013)
- npm or bundler setup

---

## TASK-012: Extend pressure history from 24h to 7 days

**Status:** To Do  
**Depends on:** TASK-010, TASK-011

### Goal

Extend the historical pressure dataset from 24 hours to 7 days so users can explore week-long pressure trends.

### Scope

`scripts/update-weather.sh` and `app.js` only.

### Deliverables

**`scripts/update-weather.sh`**

- Change `past_days=1` to `past_days=7`
- No other changes

**`app.js`**

- In `renderPressureChart`, change the historical start index from `boundaryIndex - 24` to `boundaryIndex - 168` (7 × 24)
- Keep the forecast window at `boundaryIndex + 24` (unchanged until TASK-013)
- Verify `Math.max(0, ...)` guard still prevents negative slice indices when fewer than 168 past points are available

### Acceptance criteria

- [ ] `bash scripts/update-weather.sh` produces `data/weather.json` with 7+ days of hourly `pressure_msl` in the `hourly` block
- [ ] Pressure chart shows up to 7 days of historical data
- [ ] Historical (solid) vs forecast (dashed) styling is unchanged
- [ ] Zoom, pan, and reset remain functional
- [ ] Navigator (TASK-010) correctly spans the full 7-day + 24h window
- [ ] No console errors

### Risks

- Combined dataset (~168 past + 24 forecast = ~192 points) is larger but should not affect Chart.js performance at this size; if it does, set `tension: 0` to remove cubic interpolation overhead
- Open-Meteo may return fewer than 168 hourly past points near model boundaries — the existing `Math.max(0, ...)` guard handles this silently

### Out of scope

- Forecast expansion (TASK-013)
- Other weather metrics
- npm or bundler setup

---

## TASK-013: Extend pressure forecast from 24h to 7 days

**Status:** To Do  
**Depends on:** TASK-010, TASK-011, TASK-012

### Goal

Extend the forecast pressure dataset from 24 hours to 7 days to give users a full week of forward-looking pressure data alongside the 7-day history.

### Scope

`scripts/update-weather.sh` and `app.js` only.

### Deliverables

**`scripts/update-weather.sh`**

- Change `forecast_days=2` to `forecast_days=7`
- No other changes

**`app.js`**

- In `renderPressureChart`, change the forecast end index from `boundaryIndex + 24` to `boundaryIndex + 168` (7 × 24)
- Verify `splitAt` still correctly marks the historical/forecast boundary within the wider slice
- Verify `yMin`/`yMax` padding still works correctly over the full ~336-point dataset

### Acceptance criteria

- [ ] `bash scripts/update-weather.sh` produces `data/weather.json` with 7 days of hourly forecast `pressure_msl`
- [ ] Pressure chart shows up to 7 days of forecast data beyond the current hour
- [ ] Historical (solid) vs forecast (dashed) styling is unchanged
- [ ] Zoom, pan, and reset remain functional over the ~336-point dataset
- [ ] Navigator (TASK-010) correctly spans the full 14-day window
- [ ] No console errors

### Risks

- ~336 total points may cause rendering lag on low-end mobile; if observed, add `plugins.decimation: { enabled: true, algorithm: 'lttb' }` to the Chart.js config (built-in, no extra dependency)
- Open-Meteo free tier supports up to 16 forecast days; 7 days is well within limits
- Larger JSON payload (~336 entries) increases the GitHub Actions commit size — acceptable for MVP

### Out of scope

- Other weather metrics
- Minute-level data
- IoT sensor data
- npm or bundler setup

---

## TASK-014: Replace navigator with a true draggable viewport scrollbar

**Status:** To Do  
**Depends on:** TASK-010

### Goal

The current TASK-010 navigator renders a miniature copy of the pressure line. This is not the intended UX. Replace it with a true timeline viewport controller: a plain scrollbar-like strip where a highlighted window represents the currently visible chart range, the user can drag that window to pan the chart, and the window resizes automatically when the user zooms.

The target feel is a TradingView/Grafana-style horizontal timeline scrollbar — not a second chart.

### Scope

`app.js` and `style.css` only. The `#pressure-navigator` canvas element already exists in `index.html` from TASK-010.

### Deliverables

**`app.js`**

Replace the existing `drawNavigator()` implementation with one that draws only:

1. **Background track** — a flat filled rect spanning the full navigator width; no pressure line, no miniature chart
2. **Viewport window** — a highlighted rect whose:
   - Left edge = `(scale.min / totalPoints) * navWidth`
   - Right edge = `(scale.max / totalPoints) * navWidth`
   - Updates on every zoom, pan, and reset
3. The drag logic in `setupNavigatorDrag()` already exists — keep it unchanged; it drives `zoomScale` / `update` which triggers a navigator redraw

Remove from `drawNavigator()`:
- The historical line drawing loop
- The forecast line drawing loop (dashed)
- Any `setLineDash` calls

The viewport rect must be visually prominent: a solid filled rect with a contrasting border, not a semi-transparent overlay on top of a chart.

Update `onZoomComplete` and `onPanComplete` callbacks in the Chart.js zoom plugin config to call `drawNavigator()` — these are already wired but confirm they fire correctly after the replacement.

**`style.css`**

- `#pressure-navigator`: increase height to `16px` (was `40px`) — a scrollbar does not need chart height
- Remove the `border-top` separator if it no longer fits visually; replace with `margin-top: 0.25rem`
- Set `border-radius: 4px` on the navigator canvas for a pill-shaped track feel

### Acceptance criteria

- [ ] Navigator shows a plain track with no pressure line or miniature chart
- [ ] A highlighted viewport window is clearly visible within the track
- [ ] Dragging the viewport window left/right pans the main chart in realtime
- [ ] Zooming in on the main chart narrows the viewport window proportionally
- [ ] Zooming out on the main chart widens the viewport window proportionally
- [ ] Reset button restores the viewport to full-width (all data visible)
- [ ] Touch drag works on mobile at 375px width
- [ ] Dark mode: track background and viewport window respect colour tokens
- [ ] No console errors on open, drag, zoom, or reset

### Risks

- `scale.min` and `scale.max` on a Chart.js category scale are floating-point indices into the labels array, not timestamps — use them directly as fractions of `totalPoints` (`navPressures.length`) to position the viewport rect; do not attempt to parse them as dates
- When the chart is fully zoomed out, `scale.min` ≈ 0 and `scale.max` ≈ `n - 1`; the viewport rect should span nearly the full track width — ensure `rw` is clamped to `navWidth` so it does not overflow
- `canvas.offsetWidth` may be 0 if `drawNavigator()` is called before the modal is painted; the existing `requestAnimationFrame(drawNavigator)` guard from TASK-010 already handles this — keep it

### Out of scope

- Resize handles on the viewport window edges (future task)
- Pressure line in the navigator background
- Other metric charts
- npm or bundler setup

---

## TASK-015: Set a focused default chart viewport on open and reset

**Status:** To Do
**Depends on:** TASK-013, TASK-014

### Goal

The full 14-day view is too dense to be useful as a starting point. When the modal opens (or after reset), the chart should focus on a readable window around the current time — roughly the current day ±12h or current 24h — so users immediately see meaningful, uncluttered data. They can still zoom out to explore the full 14-day range.

### Scope

`app.js` only. Pressure chart only.

### Deliverables

**`app.js`**

- After the Chart.js instance is created in `renderPressureChart`, set an initial zoom using `pressureChartInstance.zoomScale('x', { min, max }, 'none')` to focus on a ±24h window centered on `splitAt` (the current-hour index in the `times` array):
  - `initialMin = Math.max(0, splitAt - 24)`
  - `initialMax = Math.min(times.length - 1, splitAt + 24)`
- Call this immediately after chart creation, before `requestAnimationFrame(drawNavigator)`, so the navigator reflects the initial zoom from the first draw
- Update `resetPressureChart()` to restore this same focused window instead of the full range:
  - After `pressureChartInstance.resetZoom()`, apply the same `zoomScale` call with the same `initialMin`/`initialMax`
  - Since `resetZoom()` restores to the full range (0 to `times.length - 1`), immediately follow it with the `zoomScale` call to re-apply the focused view
  - Call `drawNavigator()` after
- The full 14-day range must remain reachable by zooming out (the `zoom.limits` already permits this)

### Acceptance criteria

- [ ] Modal opens showing approximately ±24h around the current time, not the full 14-day view
- [ ] Historical and forecast data are both immediately visible on open
- [ ] Reset returns to the same ±24h focused view, not the full 14-day view
- [ ] User can still zoom out to see the full 14-day range
- [ ] Navigator reflects the initial focused viewport on open and after reset
- [ ] Day labels above the chart are correct for the visible window on open
- [ ] Dark mode and mobile layout unchanged
- [ ] No console errors

### Risks

- `zoomScale` must be called after the chart has fully initialized — calling it synchronously after `new Chart(...)` is safe since Chart.js initializes synchronously; no `requestAnimationFrame` wrapper needed for the zoom call itself
- `splitAt` is available in the scope of `renderPressureChart` but not in `resetPressureChart` — promote `initialMin` and `initialMax` to module-level variables so `resetPressureChart` can reference them
- `pressureChartInstance.resetZoom()` followed immediately by `zoomScale` will fire two redraws; pass `'none'` as the third argument to `zoomScale` to suppress animation and avoid a visible flash

### Out of scope

- Custom zoom presets or a zoom-level selector
- Persisting the last zoom state in localStorage
- Other metric charts
- npm or bundler setup

---

## TASK-016: Fix chart label and day-header synchronization during navigator drag

**Status:** To Do
**Depends on:** TASK-014, TASK-015

### Goal

When the user drags the navigator slider, the chart's x-axis time labels and the day labels drawn above the chart area do not update in sync with the visible range. The root cause is that dragging the navigator calls `zoomScale` / `chart.update('none')` directly on the chart instance, which moves the data line but does not trigger a full redraw of the `afterDraw` plugin that draws the day labels.

Fix this so that every navigator drag redraws both the chart viewport AND the day labels.

### Scope

`app.js` only. The `setupNavigatorDrag` function only.

### Deliverables

**`app.js`**

- In `onMove` inside `setupNavigatorDrag`, after updating the chart scale (via `zoomScale` or `update('none')`), call `pressureChartInstance.update('none')` to trigger a full canvas redraw that includes the `afterDraw` plugin
- If `zoomScale` already triggers a full redraw internally (it typically does), verify that the `dayLabels` plugin's `afterDraw` fires after each `zoomScale` call; if it does not, replace the `zoomScale` path with `chart.options.scales.x.min = newMin; chart.options.scales.x.max = newMax; chart.update('none')` to guarantee the full lifecycle runs
- The `drawNavigator()` call already present in `onMove` must remain — do not remove it

### Acceptance criteria

- [ ] Dragging the navigator slider updates the x-axis time labels in real time
- [ ] Day labels above the chart update in real time during drag (no stale labels)
- [ ] Day boundary gridlines are correct after drag ends
- [ ] Zoom and pan (via mouse/touch on the chart itself) still update labels correctly
- [ ] Reset restores the correct labels for the focused default view
- [ ] No visible flicker or double-draw during drag
- [ ] No console errors during drag

### Risks

- `zoomScale` in `chartjs-plugin-zoom@2` may or may not call `afterDraw` depending on the internal update mode it uses; if calling `chart.update('none')` immediately after `zoomScale` causes a double-render, remove the extra call and instead add `chart.update('none')` only for the fallback path that sets `options.scales.x.min/max` directly
- Calling `chart.update('none')` on every `mousemove` / `touchmove` event can cause performance issues on low-end devices; throttle with `requestAnimationFrame` if jank is observed (only as a follow-up if needed — do not over-engineer)

### Out of scope

- Resize handles on the navigator
- Touch inertia / momentum scrolling
- Other metric charts
- npm or bundler setup

---

## TASK-017: Improve x-axis label density for wide/zoomed-out views

**Status:** To Do
**Depends on:** TASK-015, TASK-016

### Goal

When the user zooms out to view many days at once, hourly time labels crowd together and become unreadable. The current three-level thinning (every 4h / every 2h / every 1h based on visible point count) is not enough for a 7–14 day view where hundreds of ticks are present.

Extend the label density logic to handle very wide views gracefully: suppress most hourly ticks, show only day-boundary labels and sparse midday markers so the x-axis remains informative without being cluttered.

### Scope

`app.js` only. `ticks.callback` in `renderPressureChart` only.

### Deliverables

**`app.js`**

- Extend `ticks.callback` with two additional zoom levels above the current "wide" threshold:
  - **Very wide** (> 96 visible points, ~4+ days): return a label only at midnight (00:00) and noon (12:00); skip all others
  - **Ultra wide** (> 168 visible points, ~7+ days): return a label only at midnight (00:00); skip all others
  - Existing thresholds (> 24 → every 4h, 8–24 → every 2h, < 8 → every 1h) remain unchanged
- Midnight entries must always return `'00:00'` regardless of zoom level — the day label plugin already draws the date header above; the tick just needs to mark the boundary on the x-axis
- Use `Math.round(this.max - this.min)` for all threshold comparisons (already in place) to handle fractional zoom positions

### Acceptance criteria

- [ ] At 4+ days visible: only midnight and noon ticks are labelled; no hourly clutter
- [ ] At 7+ days visible: only midnight ticks are labelled
- [ ] Existing zoom levels (< 96 visible) behave exactly as before
- [ ] Labels never overlap at any zoom level on a 375px screen
- [ ] Day labels above the chart remain visible and correct at all zoom levels
- [ ] Dark mode renders correctly
- [ ] No console errors

### Risks

- The noon check requires reading `times[index]` and checking `t.slice(11, 16) === '12:00'`; this is the same pattern as the midnight check already in place
- At very wide zoom levels, tick labels may overlap if the chart width is narrower than expected — verify on a 375px screen; if overlap still occurs, increase the "ultra wide" threshold

### Out of scope

- Sub-hour labels
- Custom tick formatters for the Y-axis
- Other metric charts
- npm or bundler setup
