import { decodePolyline, haversineKm } from "../geo";
import type { LngLat, ModeKind } from "../types";

function pathKm(points: LngLat[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  return km;
}

/**
 * Transitous (transitous.org) — community-run, no-key MOTIS routing over
 * aggregated GTFS feeds worldwide. Where it has coverage this gives REAL
 * scheduled door-to-door transit (bus, metro, rail, tram, ferry); where it
 * doesn't, we fall back to OSM-derived networks and heuristics.
 *
 * Fair-use service: requests are coalesced, cached and time-capped, and
 * everything degrades gracefully when it's unreachable.
 */

export interface TransitousLeg {
  kind: ModeKind | "walk";
  routeName?: string;
  headsign?: string;
  fromName: string;
  toName: string;
  durationMin: number;
  distanceKm: number;
  geometry: LngLat[];
  color?: string;
}

export interface TransitousItinerary {
  durationMin: number;
  transfers: number;
  walkKm: number;
  distanceKm: number;
  legs: TransitousLeg[];
  /** number of boarded transit vehicles (fare events) */
  boardings: number;
}

const BASE = "https://api.transitous.org/api/v6/plan";
const TIMEOUT_MS = 6000;

const cache = new Map<string, Promise<TransitousItinerary[] | null>>();
let downUntil = 0;

/** MOTIS mode strings -> our icon kinds (openapi v2.10 mode enum). */
function kindOf(mode: string): ModeKind | "walk" {
  switch (mode) {
    case "WALK":
    case "BIKE":
    case "RENTAL":
      return "walk";
    case "SUBWAY":
    case "METRO":
      return "metro";
    case "TRAM":
    case "FUNICULAR":
    case "AERIAL_LIFT":
    case "CABLE_CAR":
      return "tram";
    case "BUS":
    case "COACH":
    case "ODM":
    case "FLEX":
      return "bus";
    case "FERRY":
      return "ferry";
    case "RAIL":
    case "HIGHSPEED_RAIL":
    case "LONG_DISTANCE":
    case "NIGHT_RAIL":
    case "REGIONAL_RAIL":
    case "REGIONAL_FAST_RAIL":
    case "SUBURBAN":
      return "train";
    default:
      return "bus";
  }
}

interface MotisLeg {
  mode: string;
  duration: number; // seconds
  distance?: number; // meters
  from: { name: string; lat: number; lon: number };
  to: { name: string; lat: number; lon: number };
  routeShortName?: string;
  headsign?: string;
  routeColor?: string;
  legGeometry?: { points: string; precision?: number };
}

interface MotisItinerary {
  duration: number; // seconds
  transfers: number;
  legs: MotisLeg[];
}

function mapItinerary(it: MotisItinerary): TransitousItinerary {
  let walkKm = 0;
  let distanceKm = 0;
  let boardings = 0;
  const legs: TransitousLeg[] = it.legs.map((leg) => {
    const kind = kindOf(leg.mode);
    // v2+ geometries are precision-6 encoded polylines
    const geometry: LngLat[] = leg.legGeometry?.points
      ? decodePolyline(leg.legGeometry.points, leg.legGeometry.precision ?? 6)
      : [
          [leg.from.lon, leg.from.lat],
          [leg.to.lon, leg.to.lat],
        ];
    // transit legs carry no `distance` — measure the drawn geometry
    const km = leg.distance != null ? leg.distance / 1000 : pathKm(geometry);
    distanceKm += km;
    if (kind === "walk") walkKm += km;
    else boardings++;
    return {
      kind,
      routeName: leg.routeShortName,
      headsign: leg.headsign,
      fromName: leg.from.name,
      toName: leg.to.name,
      durationMin: leg.duration / 60,
      distanceKm: km,
      geometry,
      color: leg.routeColor ? `#${leg.routeColor.replace(/^#/, "")}` : undefined,
    };
  });

  return {
    durationMin: it.duration / 60,
    transfers: it.transfers,
    walkKm,
    distanceKm,
    legs,
    boardings,
  };
}

/**
 * Plan transit itineraries. Returns null when the service is unreachable
 * or has no coverage — callers move down the fallback chain.
 */
export function planTransit(
  from: LngLat,
  to: LngLat,
): Promise<TransitousItinerary[] | null> {
  const k = `${from[0].toFixed(4)},${from[1].toFixed(4)}|${to[0].toFixed(4)},${to[1].toFixed(4)}`;
  const hit = cache.get(k);
  if (hit) return hit;
  if (Date.now() < downUntil) return Promise.resolve(null);

  const p = (async (): Promise<TransitousItinerary[] | null> => {
    try {
      const params = new URLSearchParams({
        fromPlace: `${from[1]},${from[0]}`,
        toPlace: `${to[1]},${to[0]}`,
        numItineraries: "3",
      });
      const res = await fetch(`${BASE}?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`transitous ${res.status}`);
      const data = (await res.json()) as { itineraries?: MotisItinerary[] };
      if (!data.itineraries?.length) return null;
      // Keep itineraries that actually use transit (not walk-only)
      const withTransit = data.itineraries
        .map(mapItinerary)
        .filter((it) => it.boardings > 0);
      return withTransit.length ? withTransit : null;
    } catch {
      downUntil = Date.now() + 120_000;
      cache.delete(k);
      return null;
    }
  })();
  cache.set(k, p);
  return p;
}
