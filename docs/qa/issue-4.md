# QA report — issue #4

Final verification pass for the temperature chart added in #3. Confirms the feature is correct across desktop, mobile, and dark mode, and that the pressure chart is regression-free.

- Issue: https://github.com/jorenknieper/fishing-weather-app/issues/4
- Branch under test: `main` at the commit this PR branches from
- Tester: _fill in name_
- Date executed: _YYYY-MM-DD_

## How to run

Serve the static site from the repo root and open it in each target browser:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/ in Chrome, Firefox, and Safari
```

Before running:

1. Confirm `data/weather.json` exists and its `generated_at` timestamp is recent. The "default ±24h around now" assertion depends on data freshness — if the data is stale, that assertion can fail for data reasons rather than code reasons.
2. Open DevTools and confirm the page loads without console errors.

For dark mode, toggle the OS-level appearance setting (macOS: System Settings → Appearance → Dark; iOS: Settings → Display & Brightness → Dark; Android: Settings → Display → Dark theme) and reload. The page uses `prefers-color-scheme` and has no in-page toggle.

## Status legend

- `PASS` — observed behaviour matches the checklist item
- `FAIL` — observed behaviour does not match; file a follow-up issue and link it in Notes
- `MANUAL` — requires a real device or environment that has not yet been exercised; sign off when done
- `BLOCKED` — cannot be evaluated (e.g. data fixture stale, browser unavailable); explain in Notes

---

## Temperature chart — golden path (desktop)

| # | Item | Chrome | Firefox | Safari | Notes |
|---|------|--------|---------|--------|-------|
| 1 | Card click opens modal | ☐ | ☐ | ☐ | |
| 2 | Both temperature lines (air + apparent) render | ☐ | ☐ | ☐ | |
| 3 | Default viewport is ±24h around now | ☐ | ☐ | ☐ | Verify against `data/weather.json` `generated_at` |
| 4 | Historical and forecast portions visually distinct | ☐ | ☐ | ☐ | |
| 5 | Day/date labels readable at default zoom | ☐ | ☐ | ☐ | |
| 6 | Zoom in/out works smoothly | ☐ | ☐ | ☐ | Wheel + buttons |
| 7 | Panning left/right reveals full 14-day range | ☐ | ☐ | ☐ | |
| 8 | Reset button returns to ±24h default | ☐ | ☐ | ☐ | |
| 9 | Navigator canvas updates while panning/zooming | ☐ | ☐ | ☐ | |

## Temperature chart — dark mode

OS dark mode active. Run on at least one desktop browser; note which.

| # | Item | Status | Browser | Notes |
|---|------|--------|---------|-------|
| 10 | Both line colors readable on dark background | ☐ | | |
| 11 | Modal backdrop themed correctly | ☐ | | |
| 12 | Axis labels themed correctly | ☐ | | |
| 13 | Gridlines themed correctly | ☐ | | |

## Temperature chart — mobile

Real devices required. Automated emulation is not accepted as sign-off for these rows.

| # | Item | iOS Safari | Android Chrome | Notes |
|---|------|------------|----------------|-------|
| 14 | Card tap opens modal | ☐ | ☐ | |
| 15 | Pinch-to-zoom on chart canvas | ☐ | ☐ | |
| 16 | One-finger pan | ☐ | ☐ | |
| 17 | Navigator drag works with touch | ☐ | ☐ | |

## Pressure chart — regression check

Run after the temperature pass. Compare against pre-#3 behaviour.

| # | Item | Status | Browser | Notes |
|---|------|--------|---------|-------|
| 18 | Pressure chart still opens and closes correctly | ☐ | | |
| 19 | Pressure zoom, pan, reset, navigator all intact | ☐ | | |
| 20 | Pressure chart dark mode unaffected | ☐ | | |

---

## Follow-ups

For each `FAIL` row above, file a separate issue using the `gh-issue-create` skill (or `gh issue create` directly) and link it here. Do not patch in this PR — per issue #4's Notes, defects are tracked as separate follow-up issues.

| Row | Follow-up issue |
|-----|-----------------|
| _e.g. #7_ | _short description_ |

## Sign-off

- [ ] Every checklist row has an explicit `PASS` / `FAIL` / `MANUAL` / `BLOCKED` outcome
- [ ] All `FAIL` rows have a linked follow-up issue
- [ ] All `MANUAL` rows have been exercised on a real device and are now `PASS` or `FAIL`
- [ ] Pressure chart regression section is `PASS` or has linked regressions

Once every box above is checked, this PR can merge and issue #4 can be closed.
