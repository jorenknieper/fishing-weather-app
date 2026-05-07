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
