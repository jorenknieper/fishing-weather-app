# Change Guide

## File responsibilities

| File                                   | What it controls                                                        |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `index.html`                           | DOM structure, modal markup, canvas IDs, CDN script tags                |
| `app.js`                               | All runtime logic: data loading, chart creation, navigator, theme, drag |
| `style.css`                            | Layout, dark/light CSS variables, modal, navigator sizing               |
| `data/weather.json`                    | Live weather payload — never edit by hand                               |
| `scripts/update-weather.sh`            | API URL, fields requested, output path                                  |
| `.github/workflows/update-weather.yml` | Schedule, commit identity, push behavior                                |

---

## x-axis label synchronization — critical rule

`times[]` and `labels[]` are sliced from `hourly.time` and `hourly.pressure_msl` using **identical** `startIndex`/`endIndex` bounds. The x-axis tick callback, the grid color function, and the `dayLabels` plugin all index into `times[]` using the raw numeric tick value.

**If you change the slicing logic, you must change it consistently for all three arrays (`times`, `pressures`, `labels`).**

A mismatch causes:

- Wrong hour labels on ticks
- Midnight grid lines appearing at wrong positions
- Day labels rendering on the wrong date segment

---

## Navigator synchronization

`drawNavigator()` must be called after every scale change. It is currently called:

- After `chart.update('none')` in the drag handler (`onMove`)
- Via `onZoomComplete` and `onPanComplete` plugin callbacks
- At chart init via `requestAnimationFrame(drawNavigator)`
- In `resetPressureChart()`

**If you add another path that changes `scale.min`/`scale.max`, you must call `drawNavigator()` after it.** Forgetting this leaves the navigator window in a stale position while the chart has moved.

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

## Changing the chart viewport or range

- `startIndex = Math.max(0, boundaryIndex - 168)` — 7 days back (168 h)
- `endIndex = Math.min(hourly.time.length, boundaryIndex + 168)` — 7 days forward
- `initialMin = splitAt - 24`, `initialMax = splitAt + 24` — focused viewport

All four values are set in `renderPressureChart()`. Adjust consistently to avoid index/label drift.

---

## Theme / dark mode

Chart colors are derived from `isDark` at render time inside `renderPressureChart()`. The navigator also reads `isDark` in `drawNavigator()`. Both use `document.documentElement.getAttribute('data-theme') === 'dark'`.

If the user toggles theme while the modal is open, the chart colors will not update until the modal is closed and reopened (chart is re-created on each `openPressureModal()` call). This is a known limitation and is acceptable given the infrequency of theme switching.

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
