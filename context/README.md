# Fishing Weather App – Repository Overview

Static GitHub Pages dashboard showing fishing-relevant weather for Aalter, Belgium. No backend, no database, no frameworks.

## What it does

- Fetches current conditions from Open-Meteo hourly via GitHub Actions
- Displays temperature, feels-like, humidity, pressure (MSL + surface), precipitation, wind speed, and wind direction
- Pressure card opens a modal with a Chart.js line chart spanning 7 days past + 7 days forecast, with a navigator scrollbar and zoom/pan

## Main files

| File                                   | Role                                                     |
| -------------------------------------- | -------------------------------------------------------- |
| `index.html`                           | Single-page shell, DOM structure                         |
| `app.js`                               | All runtime logic: data loading, chart, navigator, theme |
| `style.css`                            | CSS variables for light/dark themes, responsive grid     |
| `data/weather.json`                    | Static weather payload committed by GitHub Actions       |
| `scripts/update-weather.sh`            | Curl script that calls Open-Meteo and writes the JSON    |
| `.github/workflows/update-weather.yml` | Hourly Actions trigger                                   |

## Data flow summary

Open-Meteo API -> `update-weather.sh` -> `data/weather.json` (committed) -> GitHub Pages -> `app.js` fetch -> DOM render + chart

## Intentionally out of scope

- User accounts or auth
- Backend server or database
- AWS infrastructure
- IoT weather stations
- Moon phase or fish-activity scoring
- Multiple locations (only Aalter currently)
