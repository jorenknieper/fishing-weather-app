# Domain Concepts

## Pressure terminology

- **hPa** (hectopascal): the unit for atmospheric pressure. Standard sea-level pressure is ~1013 hPa. Fishing conditions are typically considered good between ~1010–1025 hPa.
- **MSL pressure** (Mean Sea Level): pressure normalized to sea level. Used for weather maps and trend comparison. This is the primary fishing indicator shown on the chart.
- **Surface pressure**: raw pressure at the station's actual elevation. Varies with terrain; less useful for trend analysis.
- **Pressure trend**: the direction of change over hours. A rising trend typically improves fish activity; a sharp drop often signals poor conditions.

## Forecast vs historical

- The API returns up to 7 days of past hourly data and 7 days of future forecast in the same `hourly.pressure_msl` array
- `splitAt` is computed in `app.js` by finding the first hourly timestamp >= current Brussels time
- Historical data (index 0..splitAt) is rendered as a solid blue line
- Forecast data (index splitAt..end) is rendered as a dashed lighter-blue line
- Both datasets share the `splitAt` point to keep the line visually unbroken

## Time and timezone

- All timestamps from Open-Meteo are ISO 8601 strings in the Europe/Brussels timezone (`utc_offset_seconds` in the response confirms the offset)
- Current-hour detection uses `new Date().toLocaleString('sv', { timeZone: 'Europe/Brussels' })` to get a comparable ISO string
- Day labels on the chart derive from the `times[]` array (not from the `labels[]` HH:MM strings), which is why `times[]` must stay in sync with the chart's x-axis indices

## Weather fields relevant to fishing

| Field | Why it matters |
|---|---|
| pressure_msl | Primary bite-activity indicator |
| temperature_2m | Fish metabolism, surface layer activity |
| apparent_temperature | Angler comfort |
| relative_humidity_2m | Fog risk, comfort |
| precipitation | Runoff, water clarity, fish location |
| wind_speed_10m | Surface drift, presentation control |
| wind_direction_10m | Wind-driven food concentrations |

## Viewport terminology

- **Focused viewport**: the ±24 h window around `splitAt` set on chart initialization — shows yesterday through tomorrow
- **Full range**: all ~336 data points (14 days total); accessible by zooming out or resetting
- **Navigator window**: the highlighted rectangle on the `#pressure-navigator` canvas showing which portion of the full range is currently visible
