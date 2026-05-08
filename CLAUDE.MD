# CLAUDE.md

Static GitHub Pages weather dashboard for anglers. Displays current conditions and a 14-day pressure chart for Aalter, Belgium. No backend, no framework, no database.

Rules:
- Use vanilla HTML/CSS/JS.
- No frameworks.
- No backend.
- No database.
- Weather data lives in data/weather.json.
- GitHub Actions updates weather data hourly.
- Keep changes small.
- Only edit files needed for the current task.
- Do not refactor unless asked.

## Project Context

Read the context folder before making significant changes:

- `context/README.md` — repository overview, main files, data flow, out-of-scope items
- `context/architecture.md` — system architecture, Open-Meteo integration, GitHub Actions flow, Chart.js pressure chart and navigator design
- `context/domain.md` — pressure terminology, forecast vs historical distinction, fishing-relevant weather fields, viewport concepts
- `context/decisions.md` — ADR-style rationale for static hosting, numeric x-axis, separate navigator canvas, focused default viewport, Open-Meteo choice
- `context/change-guide.md` — safe modification patterns, x-axis label synchronization rules, navigator synchronization rules, mobile and dark-mode caveats