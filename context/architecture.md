# Architecture

## System overview

```
GitHub Actions (cron: hourly)
  └── scripts/update-weather.sh
        └── curl Open-Meteo API
              └── data/weather.json (committed to main)
                    └── GitHub Pages serves static files
                          └── app.js fetch('./data/weather.json')
                                ├── renderWeather()  → DOM cards
                                └── hourlyPressureData → chart on demand
```

## Open-Meteo integration

- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Location: lat 51.0748, lon 3.4486 (Aalter, Belgium)
- `current` fields: temperature_2m, apparent_temperature, relative_humidity_2m, surface_pressure, pressure_msl, precipitation, wind_speed_10m, wind_direction_10m, is_day
- `hourly` fields: pressure_msl, temperature_2m, apparent_temperature, relative_humidity_2m, surface_pressure, precipitation, wind_speed_10m, wind_direction_10m
- Range: `past_days=7`, `forecast_days=7` (up to ~336 hourly data points)
- Timezone: Europe/Brussels

## GitHub Actions flow

- Workflow: `.github/workflows/update-weather.yml`
- Schedule: every hour at minute 0
- Also triggerable manually via `workflow_dispatch`
- Steps: checkout → run shell script → `git add data/weather.json` → commit + push only if changed
- The shell script validates the response contains a `"current"` block before overwriting

## Frontend rendering flow

1. `loadWeather()` fetches `data/weather.json` on page load
2. `renderWeather(data.current)` populates the 8 DOM cards
3. `hourlyPressureData = data.hourly` is held in module scope
4. Clicking the Pressure (MSL) card calls `openPressureModal()` which calls `renderPressureChart()`
5. Chart is destroyed and recreated each time the modal opens

## Pressure chart architecture

- Library: Chart.js 4 (CDN) + chartjs-plugin-zoom 2 (CDN)
- Type: `line` with two datasets sharing the same `labels[]` array
- `times[]` is the authoritative x-axis source — labels are `HH:MM` slices from ISO strings; the full ISO strings live in `times[]` for day-label logic
- x-axis uses numeric indices (0..n-1) not time values; `callback` and grid color functions both index into `times[]` via the tick value
- `splitAt` = index of the first future hour; it is the shared boundary point present in **both** Historical and Forecast datasets so the line stays visually connected
- Initial viewport: ±24 h around `splitAt` (set via `zoomScale` or direct option mutation)
- `initialMin`/`initialMax` are stored so Reset can restore this viewport

## Day-label plugin (`dayLabels`)

- Custom inline Chart.js plugin, runs in `afterDraw`
- Reads `scale.min` / `scale.max` to find visible midnight boundaries
- Clips drawing to the top padding area (above the chart area)
- Splits the visible range into segments between midnights and centers a "D Mon YYYY" label in each segment

## Navigator architecture

- A separate `<canvas id="pressure-navigator">` drawn by `drawNavigator()` — not a Chart.js chart
- Draws a highlighted window rectangle reflecting `pressureChartInstance.scales.x.min/max` relative to total data length
- Redrawn after every zoom/pan event and after every drag move
- `setupNavigatorDrag()` is called once at startup; attaches mousedown/touchstart to the canvas and mousemove/touchmove/mouseup to `window`
- Drag maps pixel delta to index delta: `deltaIndex = (deltaX / nav.offsetWidth) * n`
- During drag: directly mutates `pressureChartInstance.options.scales.x.min/max` then calls `chart.update('none')` (no animation) + `drawNavigator()`

## Wind-direction modal architecture

- The wind-direction modal renders a horizontally scrollable SVG arrow timeline — it does **not** use Chart.js
- `renderWindArrowSvg(degrees, { size })` is a shared helper that generates a single inline SVG arrow; it is called by both the modal builder and `renderWeather()` to show a live preview arrow on the dashboard card
- Arrow rotation is `degrees + 180`: `wind_direction_10m` is the direction wind comes FROM; the arrow points where the wind is going
- Hourly data is aggregated into 3-hour buckets (14 days × 8 buckets/day = 112 cells) displayed in a `<div id="wind-direction-timeline">` with `overflow-x: auto`
- Bucket direction uses circular mean (`atan2(Σsin, Σcos)`) rather than arithmetic mean to handle the 0/360 wraparound correctly
- Historical buckets render at full opacity; forecast buckets at `opacity: 0.55`
- No navigator or zoom control — the strip is a simple scroll container
- Disposal: `close()` sets `innerHTML = ''` on the host div (replaces the old `chart.destroy()` pattern used by the other Chart.js modals)
- Arrow `fill` uses `currentColor` (resolved to `--color-card-value`), giving automatic dark-mode and live theme-toggle support without any JS re-render
