# Marg — trip planner for anywhere

Plan multi-stop trips **within any city on Earth** (Ameerpet → Secunderabad,
Camden → Greenwich, Williamsburg → SoHo…) and compare every practical way to
make each leg — **metro / train / tram / bus, taxis, ride-hailing, auto
rickshaws, moto-taxis, shared e-scooters, your own bicycle, walking** — by
estimated **price (local currency) and time**, then hand off to the right
app to book.

Built with [Next.js](https://nextjs.org), [shadcn/ui](https://ui.shadcn.com)
and [mapcn](https://www.mapcn.dev) map components (MapLibre GL).

## How "anywhere" works — layered data tiers

The planner never comes up empty; it degrades honestly, and every option is
labeled with its tier:

1. **Curated city packs** (`data/hyderabad.ts`) — hand-checked networks and
   fares. Hyderabad ships complete: all 57 HMRL metro stations from the
   official GTFS, May-2025 fare slabs, calibrated Uber/Ola/Rapido cards.
2. **Live open data** — where a pack doesn't exist:
   - **[Transitous](https://transitous.org)** (community MOTIS routing over
     aggregated GTFS worldwide) gives real scheduled door-to-door transit —
     legs, timetables, line names — across Europe, the Americas, much of
     Asia-Pacific. Marked `Live`.
   - **OpenStreetMap rail networks**: where Transitous has no feed, the
     planner fetches the city's metro/light-rail/tram route relations from
     Overpass at runtime, builds a graph (same Dijkstra engine as the
     curated pack), and estimates rides — cached locally for a week.
   - **FOSSGIS bike routing** for realistic cycling times on actual
     cycleways; OSRM for road distance/geometry.
3. **Country fare tables** (`data/regions.ts`) — ~35 country profiles:
   which providers operate there (Uber vs Grab vs Bolt vs Yandex vs DiDi vs
   Ola/Rapido…), local fare cards in local currency, taxi meter rates,
   moto/auto availability, transit fare bands, traffic speeds, and
   value-of-time presets scaled to local wages.
4. **Global default** — any country not yet profiled still plans every leg,
   with clearly-flagged rough USD estimates.

The region is resolved from where your stops actually are (curated pack
bbox → country of the stops → default), and the whole UI switches with it:
currency formatting, available modes, provider names, presets.

## What it does

- **Multi-stop trips** with per-leg mode comparison — time band, price band,
  transfers, walking; badges for **Best / Fastest / Cheapest / Free** ("Best"
  minimizes `price + time × your value of time`).
- **"Best order"** reorders intermediate stops to minimize total travel
  (exact for ≤6 free stops, nearest-neighbor + 2-opt beyond).
- **Global place search** — Photon (OSM) with instant curated results,
  biased toward your trip; results carry country codes that drive region
  resolution.
- **First/last mile modeled** — station access legs walk when close, switch
  to the cheapest local quick mode (auto/moto) when not, and respect your
  max-walk preference across the whole leg.
- **Booking hand-off** — documented deep links with pre-filled pickup/drop
  for Uber, Lyft and Yandex Go; app/site links for Grab, Bolt, Gojek, Ola,
  Rapido, inDrive, Careem, DiDi, 99 and more; Google Maps transit/walking/
  cycling directions everywhere.
- **Graceful degradation** — every external service (OSRM, FOSSGIS,
  Transitous, Overpass, Photon) is time-capped, coalesced, cached, and has
  a heuristic fallback. Kill the network and the planner still answers.

## Why estimates, not live prices

No ride platform anywhere exposes a public price API (Uber's is
deprecated/approval-gated and its ToS ban comparison use; Grab, Bolt,
Rapido, Ola, DiDi have none). Scraping violates ToS. So — like every
legitimate comparison product — Marg estimates from **researched fare
cards** with an uncertainty band, marks surge-prone fares `*`, and defers
the real quote to the operator's app. Most GTFS feeds carry no fares
either, so scheduled-transit prices use per-country fare bands.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build
```

No API keys. Attribution requirements are built into the UI (©
OpenStreetMap contributors; scheduled transit via
[Transitous](https://transitous.org/sources/)). The public community
services used here are fine for demos and FOSS apps but not for high-volume
commercial deployments — self-host OSRM/MOTIS/Photon for that (each module
takes a base-URL swap).

## Architecture

```
data/regions.ts            ~35 country profiles + global default (fares, providers, speeds)
data/hyderabad.ts          curated city pack (HMRL metro, calibrated fares, places)
lib/types.ts               domain model (open TransportMode catalog, RegionProfile…)
lib/region.ts              region resolution + local-currency formatting (Intl)
lib/planner.ts             the engine: per-leg options, price/time bands, Pareto,
                           layered transit chain (pack → Transitous → OSM → heuristic)
lib/transit/metro.ts       Dijkstra over any (station, line) graph, fare slabs
lib/transit/transitous.ts  MOTIS v6 plan client (live scheduled transit worldwide)
lib/transit/overpass.ts    OSM route-relation → MetroNetwork builder, cached
lib/routing/osrm.ts        road + bicycle routing with heuristic fallbacks
lib/fares.ts               fare-card arithmetic     lib/optimize.ts  stop reordering
lib/places.ts              Photon global search     lib/providers.ts deep links
hooks/use-trip-planner.ts  planning state (stops, region, prefs, selection)
components/ui/map.tsx      mapcn map components (vendored, MIT)
components/planner/*       search, stops, option cards, prefs, map, summary
```

**Adding a country** = one entry in `data/regions.ts`. **Adding a curated
city pack** = one file like `data/hyderabad.ts`. Nothing else changes.

## Known limits (honest ones)

- Fare tables are estimates compiled July 2026 — high-inflation markets
  (ARS, TRY, EGP, NGN, PKR) drift fast; each profile is the one place to
  recalibrate.
- OSM-derived networks inherit OSM quality: some cities have perfect route
  relations, others don't — options built from them are labeled estimates.
- Transitous coverage is strong in Europe/Americas/parts of Asia but not
  universal; the chain falls back automatically.
- No live availability, surge, or driver-cancellation signal — the planner
  says what a leg *should* cost, not whether a cab will come in the rain.
- Cross-border legs price with the first stop's country profile.
