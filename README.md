# Marg — intra-city trip planner

Plan multi-stop trips **within** a city (Ameerpet → Secunderabad, point to point)
and compare every practical way to make each leg — **Metro, city bus, street
auto, Uber (Go / Auto / Moto) and Rapido (Bike / Auto / Cab)** — by estimated
**price and time**, then hand off to the right app to book.

Built with [Next.js](https://nextjs.org), [shadcn/ui](https://ui.shadcn.com) and
[mapcn](https://www.mapcn.dev) map components (MapLibre GL).

## What it does

- **Multi-stop trips** — add any number of stops; legs are planned pairwise.
  "Best order" reorders intermediate stops to minimize total travel
  (exact for ≤6 free stops, nearest-neighbor + 2-opt beyond).
- **Per-leg mode comparison** — every leg gets a card per viable mode with a
  **time band**, **price band** (₹ low–high, surge-prone fares marked `*`),
  transfers and walking distance. Badges mark **Best / Fastest / Cheapest**;
  "Best" minimizes `price + time × your value of time` (adjustable in
  Preferences).
- **Real metro routing** — Dijkstra over the full Hyderabad Metro network
  (57 stations, 3 corridors, official HMRL GTFS coordinates), with interchange
  penalties, the May-2025 fare slabs (₹11–69), and first/last-mile legs
  (walk if ≤800 m, else a short auto hop) composed into the door-to-door
  estimate.
- **Map view** — mapcn `<Map>` with numbered stop markers, per-mode colored
  route lines (metro segments in their line colors, walks dashed) and metro
  stations as orientation dots. Light/dark theme aware.
- **Booking hand-off** — Uber deep link with pre-filled pickup/drop
  (`m.uber.com/ul/?action=setPickup…`), Rapido app link, Google Maps transit
  directions for metro/bus.
- **Graceful degradation** — road routing uses the public OSRM demo server
  and place search uses Photon (both keyless); when either is unreachable the
  planner falls back to curated local places and haversine × detour-index
  estimates, and marks estimates accordingly.

## Why estimates, not live prices

No Indian ride-hailing platform exposes a public price API anymore: Uber's
estimates endpoints are deprecated/approval-gated (and its API ToS explicitly
prohibit price-comparison use), Rapido has no public API, Ola's affiliate
program is dormant. Scraping or driving user accounts violates ToS. So — like
every legitimate fare-comparison product — Marg estimates from **published
fare cards** (base + per-km + per-min, minimum fares) with an uncertainty band,
and defers the real quote to the operator's app via deep link. Surge in India
is legally bounded to 2× base fare (MV Aggregator Guidelines 2025); bands and
the `*` marker reflect that.

## Data honesty

- Metro fares: HMRL chart effective 24 May 2025. Station coordinates: official
  HMRL GTFS (June 2022 open-data release).
- Bus fares: TSRTC city slabs (blended Ordinary/Metro Express); women residents
  of Telangana ride free on Ordinary/Express (Mahalakshmi scheme) — surfaced as
  a note on bus options.
- Street-auto meter: the official ₹20 + ₹11/km rate is from 2014 and widely
  ignored on the street; the shown band (1.2–2.2×) reflects negotiated reality.
- Speeds: TomTom Traffic Index 2025 for Hyderabad (car ~16–18 km/h in traffic).
- **Fares rot.** Every number lives in one config file per city and is dated.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build
```

No API keys required. Map tiles come from Carto's keyless basemaps (mapcn
defaults); geocoding and road routing use public Photon/OSRM demo servers,
which are fine for demos but not for production traffic — swap in your own
OSRM/Valhalla/ORS instance in `lib/routing/osrm.ts` for real deployments.

## Architecture

```
data/hyderabad.ts        city config: metro network, fare cards, speeds, places
lib/types.ts             domain model (Place, RouteOption, LegPlan, CityConfig…)
lib/planner.ts           the engine: per-leg options, price/time bands, Pareto
lib/transit/metro.ts     Dijkstra over (station, line) graph, fare slabs
lib/routing/osrm.ts      OSRM demo client + haversine fallback, session cache
lib/fares.ts             fare-card arithmetic
lib/optimize.ts          stop reordering (brute force / NN + 2-opt)
lib/places.ts            curated-places + Photon search
lib/deeplinks.ts         Uber / Rapido / Google Maps hand-off links
hooks/use-trip-planner.ts  planning state (stops, prefs, plans, selection)
components/ui/map.tsx    mapcn map components (vendored, MIT)
components/planner/*     search, stop list, option cards, prefs, map, summary
```

**Adding a city** = one new `CityConfig` in `data/`: center/bbox, fare cards,
speed model, curated places, and (optionally) a metro/rail network with fare
slabs. The planner, UI and map need no changes.

## Known limits (honest ones)

- Bus options are corridor-level estimates — they assume a direct TSRTC route
  exists and don't consult live routes or GTFS schedules yet.
- MMTS suburban rail isn't modeled (cheap but 20–60 min headways).
- No live availability, surge, or driver-cancellation signal — the planner
  tells you what a leg *should* cost, not whether a cab will actually come at
  6 pm in the rain.
- Night fares (auto 1.5× after 11 pm) are noted, not modeled as a toggle.
- OSRM demo/Photon are best-effort community services; the app works without
  them but road geometry becomes straight-line estimates.
