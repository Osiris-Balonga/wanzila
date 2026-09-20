# Wanzila

Wanzila is a map-first directory for pharmacies in Brazzaville. Desktop uses a navigation rail and a results panel; mobile keeps the map central and opens pharmacy details in a bottom sheet.

## Local development

```bash
npm ci
npm run dev
```

Next.js runs on port `3100` and JSON Server on loopback port `3101`. Open `http://localhost:3100`. Next proxies read-only `/data` requests to JSON Server, so a phone never needs direct access to port `3101`. Use HTTPS on a physical phone if route calculation needs geolocation.

## Pharmacy and duty data

`db.json` contains the base directory. `public/data/on-duty-pharmacies.json` contains the dated duty schedule and is merged into the directory by pharmacy ID at load time.

The current schedule contains 34 Brazzaville pharmacies published by the [Direction de la pharmacie et du médicament](https://dpmcongo.org/pharmacies-de-garde/) for 20 September 2026. A confirmed duty period means the pharmacy appears on that official daily schedule. It does not imply verified opening hours, so the interface displays duty status separately from opening-hour availability.

Google Maps is used only to verify physical place information such as coordinates, phone numbers, and establishment photos. It is not used as evidence that a pharmacy is on duty. Records without an unambiguous place match retain their official address but do not receive invented coordinates or contact details. Remote photo URLs are acceptable for the demo and fall back to the existing pharmacy illustration if an image becomes unavailable.

The fourteen duty pharmacies with verified coordinates are displayed on the map and support the integrated OSRM route flow. The other schedule entries remain searchable and visible in the list while their precise location is pending verification. Jagger's coordinates and phone were also checked against its Google Maps place record; its night-pharmacy category remains distinct from a current duty confirmation.

Run the internal data-quality report with:

```bash
npm run data:quality
```

It reports the current schedule size, active entries, coordinate/phone/photo coverage, and verification-date range.

## Emergency call

The existing navigation and map controls include a direct `tel:112` action labelled as medical emergency. The number is sourced from the [Republic of the Congo practical information page](https://developpement-durable.gouv.cg/environnement/initiative-mondiale-sur-les-tourbieres/infos-pratiques/). No separate emergency page is introduced.

## Product metrics

The client sends four allowlisted, privacy-minimised events to `/api/analytics`: `search_performed`, `route_started`, `pharmacy_call_started`, and `emergency_call_started`. Search text and user location are never included. The API writes structured `wanzila_metric` records to server logs, which can be aggregated into searches per day and search-to-route conversion. Data freshness and coverage come from `npm run data:quality`; no public KPI dashboard is added.

## Other behaviour and limits

Saved pharmacy IDs stay in `localStorage` under `wanzila:saved:v1`. User location is requested only after the integrated route action. OSRM failures produce an explicit error and never fall back to an invented straight-line route. Weather uses Open-Meteo and gracefully keeps the city label if the service is unavailable.

## Render deployment

`render.yaml` builds with `npm ci && npm run build` and starts through `npm run start:render`. The process launches JSON Server privately on `127.0.0.1:3101`, waits for it, and then exposes Next.js on Render's public port. The service follows `main`; changes are expected to reach `dev` through a pull request before promotion to `main`.
