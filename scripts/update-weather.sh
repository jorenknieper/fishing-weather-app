#!/usr/bin/env bash
set -euo pipefail

URL="https://api.open-meteo.com/v1/forecast\
?latitude=51.0748\
&longitude=3.4486\
&current=temperature_2m,apparent_temperature,relative_humidity_2m,surface_pressure,pressure_msl,precipitation,wind_speed_10m,wind_direction_10m,is_day\
&hourly=pressure_msl\
&past_days=7\
&forecast_days=7\
&timezone=Europe%2FBrussels"

DEST="$(dirname "$0")/../data/weather.json"

mkdir -p "$(dirname "$DEST")"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if ! curl --silent --show-error --fail --max-time 10 "$URL" --output "$TMP"; then
  echo "ERROR: curl failed to fetch weather data" >&2
  exit 1
fi

if ! grep -q '"current"' "$TMP"; then
  echo "ERROR: response does not contain a current block" >&2
  exit 1
fi

mv "$TMP" "$DEST"
echo "Updated $DEST"
