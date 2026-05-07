# Architecture

## Current MVP

```text
GitHub Actions
   ↓
Open-Meteo API
   ↓
scripts/update-weather.sh
   ↓
data/weather.json
   ↓
GitHub Pages frontend

Frontend

The frontend is a static website.

It reads weather data from:

./data/weather.json
Data Update

Weather data is updated by GitHub Actions.

The workflow runs:

Every hour
Manually via workflow_dispatch
Why This Architecture

Benefits:

Free hosting
No backend
No database
Easy to debug
Easy to migrate to AWS later
Future AWS Architecture
EventBridge
   ↓
Lambda
   ↓
S3 weather JSON
   ↓
CloudFront
   ↓
Static frontend