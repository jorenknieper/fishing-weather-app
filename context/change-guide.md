# Change Guide

## File responsibilities

| File | What it controls |
|---|---|
| `index.html` | DOM structure, modal markup, canvas IDs, CDN script tags |
| `app.js` | All runtime logic: data loading, chart creation, navigator, theme, drag |
| `style.css` | Layout, dark/light CSS variables, modal, navigator sizing |
| `data/weather.json` | Live weather payload — never edit by hand |
| `scripts/update-weather.sh` | API URL, fields requested, output path |
| `.github/workflows/update-weather.yml` | Schedule, commit identity, push behavior |

---

## x-axis label synchronization — critical rule

`times[]` and `labels[]` are sliced from `hourly.time` using **identical** `startIndex`/`endIndex` bounds. Each series' values array is sliced with the same bounds. The x-axis tick callback, the grid color function, and the `dayLabels` plugin all index into `times[]` using the raw numeric tick value.

**If you change the slicing logic, you must change it consistently for `times`, `labels`, and every series values array.**

A mismatch causes:
- Wrong hour labels on ticks
- Midnight grid lines appearing at wrong positions
- Day labels rendering on the wrong date segment

---

## Navigator synchronization

Each modal instance owns a private `drawNavigator()`. It reads `navValues.length` (set from `series[0].key` during render) to calculate the total index range, and reads `chart.scales.x.min/max` for the current viewport window.

`drawNavigator()` is called:
- After `chart.update('none')` in the drag handler (`onMove`)
- Via `onZoomComplete` and `onPanComplete` plugin callbacks
- At chart init via `requestAnimationFrame(drawNavigator)`
- In the instance's `reset()` method

**If you add another path that changes `scale.min`/`scale.max`, you must call `drawNavigator()` after it.** Forgetting this leaves the navigator window in a stale position while the chart has moved.

Note: `navValues` is sourced from `series[0].key` only — it is used solely for the length of the full data range, not for drawing. All series are expected to have the same time-index count.

---

## Chart redraw behavior

`chart.update('none')` skips animation. Use this for interactive updates (drag, programmatic pan). Use the default `chart.update()` only when the data changes. Calling a full update during drag will cause visible flicker on lower-end devices.

---

## Adding new weather fields

1. Add the field name to the `&current=` parameter in `scripts/update-weather.sh`
2. Add a card in `index.html` with an appropriate `id`
3. Add a line in `renderWeather()` in `app.js`

No other files need to change for current-condition fields.

---

## Multi-series modal pattern

**Adding a series to an existing chart** (e.g. adding `wind_speed_10m` to `temperatureModal`):
1. Confirm the field is present in `hourly` (add it to `scripts/update-weather.sh` if needed)
2. Add an entry to the `series[]` array in the modal config: `{ key, historicalLabel, forecastLabel, historicalColor, forecastColor }`
3. The factory loop handles dataset creation, and Y-axis range automatically expands to include all series values
4. No other changes needed — `navValues` stays on `series[0]`

**Creating a new modal instance**:
1. Add modal markup and a navigator canvas to `index.html` with unique IDs
2. Call `createChartModal({ modalId, chartId, navigatorId, noDataId, getData, series, colors, yAxis, historyHours, forecastHours, initialViewportHours, zoomMinRange })`
3. `getData` should return `hourlyData` (the shared module-scope variable)
4. Add thin wrapper functions (`openXModal`, `closeXModal`, `resetXChart`) for use in `onclick` handlers
5. Add an Escape key branch in the `keydown` listener

**Shared data source**: Both existing modals use `getData: () => hourlyData`. `hourlyData` is the `data.hourly` object from `weather.json`, set once in `loadWeather()`. The variable was previously named `hourlyPressureData`.

---

## Changing the chart viewport or range

- `historyHours` config key controls how far back from `boundaryIndex` to slice (default 168 = 7 days)
- `forecastHours` config key controls how far forward (default 168)
- `initialViewportHours` sets ±N hours around `splitAt` for the focused initial view (default 24)

Adjust these per-instance in the config object. Do not change slicing logic inside `render()` directly unless changing the behavior for all instances.

---

## Theme / dark mode

Chart colors are derived from `isDark` at render time inside each instance's `render()`. The navigator also reads `isDark` in `drawNavigator()`. Both use `document.documentElement.getAttribute('data-theme') === 'dark'`.

If the user toggles theme while a modal is open, chart colors will not update until the modal is closed and reopened (chart is re-created on each `open()` call). This is a known limitation and is acceptable given the infrequency of theme switching.

---

## Mobile UX considerations

- `max-width: 640px` on `main` keeps the grid comfortable on phones
- `@media (max-width: 375px)` reduces `.value` font size for small screens
- The navigator drag handler supports both mouse and touch (`touchstart`/`touchmove` with `passive: false` to allow `preventDefault`)
- The modal takes `100%` width up to `600px max-width` and is constrained to `90vh` to avoid overflowing on short screens

---

## Safe testing workflow

1. Edit `app.js` or `index.html` locally
2. Open `index.html` directly in a browser — the `fetch('./data/weather.json')` call works from the filesystem
3. Check browser console for errors
4. Verify chart opens, navigator highlights correct range, drag moves the viewport, Reset restores the ±24 h window
5. Toggle dark mode and reopen the chart to confirm color correctness
6. Test on a narrow viewport (375 px) to confirm grid and modal layout
