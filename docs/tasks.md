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
