# KMI / IRM Weather Alert Feed

## Source

Belgium's weather alerts are distributed via **Meteoalarm** (managed by EUMETNET, feeds national met offices including KMI/IRM).

- **ATOM feed URL**: `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-belgium`
- **Format**: ATOM 1.0 with embedded CAP 1.2 XML entries
- **Update frequency**: Approximately every 15 minutes when warnings are active
- **Authentication**: None required — publicly accessible
- **CORS**: No `Access-Control-Allow-Origin` header → cannot be fetched from browser JS. Must be fetched server-side (GitHub Actions runner can fetch it freely).

## CAP Alert Entry Structure

Each `<entry>` in the ATOM feed contains an embedded CAP `<alert>` block:

```xml
<entry>
  <id>urn:oid:2.49.0.1.056.0.20260529120000.1</id>
  <title>Yellow wind warning for Flanders</title>
  <updated>2026-05-29T12:00:00+02:00</updated>
  <cap:status>Actual</cap:status>
  <cap:msgType>Alert</cap:msgType>
  <cap:info>
    <cap:language>en-GB</cap:language>
    <cap:category>Met</cap:category>
    <cap:event>Wind</cap:event>
    <cap:urgency>Future</cap:urgency>
    <cap:severity>Minor</cap:severity>
    <cap:certainty>Likely</cap:certainty>
    <cap:effective>2026-05-29T12:00:00+02:00</cap:effective>
    <cap:expires>2026-05-30T06:00:00+02:00</cap:expires>
    <cap:headline>Yellow wind warning</cap:headline>
    <cap:description>Wind gusts up to 70 km/h expected.</cap:description>
    <cap:area>
      <cap:areaDesc>Flanders</cap:areaDesc>
      <cap:geocode>
        <cap:valueName>NUTS3</cap:valueName>
        <cap:value>BE2</cap:value>
      </cap:geocode>
    </cap:area>
  </cap:info>
</entry>
```

## Severity to Colour Mapping

| CAP `<cap:severity>` | Meteoalarm Colour | Dashboard Colour |
| -------------------- | ----------------- | ---------------- |
| `Minor`              | Yellow            | YELLOW           |
| `Moderate`           | Orange            | ORANGE           |
| `Severe`             | Red               | RED              |
| `Extreme`            | Red               | RED              |
| (no alert)           | Green             | GREEN            |

## Area Filtering for Aalter / Flanders

Aalter is in the province of East Flanders, which falls under the NUTS3 code `BE233` (Gent district) and the broader Flanders region `BE2`.

Filtering strategy for the fetch script:

1. Check `<cap:areaDesc>` for "Flanders", "Oost-Vlaanderen", "Vlaanderen", or "Belgium"
2. Check `<cap:geocode>` for NUTS3 values starting with `BE2` (Flemish Region)
3. Accept Belgium-wide alerts (no region filter, or `BE` prefix) as they apply to Aalter

## Empty Feed Behaviour

When no warnings are active, the feed returns a valid ATOM document with no `<entry>` elements. The script should write `{"updatedAt": "...", "warnings": []}` in this case.

## Error Handling

If the feed URL is unreachable or returns non-200:

- Write `{"updatedAt": "...", "warnings": [], "error": "unavailable"}` to `data/kmi-warnings.json`
- Do **not** fail the GitHub Actions workflow (use `|| true` or try/catch)
