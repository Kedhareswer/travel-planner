import { decodePolyline, haversineKm, straightLine } from "../geo";
import type { LngLat } from "../types";

/**
 * Road routing via the public OSRM demo server, with a heuristic fallback.
 *
 * The demo server (router.project-osrm.org) is fine for demos and light use,
 * but it is best-effort: no SLA, and only the `driving` profile is reliably
 * deployed. So every call degrades gracefully to a straight-line estimate
 * scaled by a detour index — the UI marks which one it got.
 */

export interface RoadRoute {
  distanceKm: number;
  /** raw driving duration from OSRM at free-flow-ish speeds, minutes */
  durationMin: number;
  geometry: LngLat[];
  /** true if this came from OSRM; false = heuristic estimate */
  fromOsrm: boolean;
}

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
// FOSSGIS community router — the profile is picked by the path prefix, the
// literal "driving" segment is an OSRM API quirk. Browser CORS verified
// (osm.org's own directions UI calls it cross-origin).
const FOSSGIS_BIKE = "https://routing.openstreetmap.de/routed-bike/route/v1/driving";
const TIMEOUT_MS = 4000;

// Session-scoped cache of in-flight/settled requests — overlapping replans
// of the same leg coalesce onto one fetch instead of hitting OSRM repeatedly.
const cache = new Map<string, Promise<RoadRoute>>();
// After a hard failure, stop hammering the server for a while.
let osrmDownUntil = 0;

function key(a: LngLat, b: LngLat): string {
  const r = (n: number) => n.toFixed(5);
  return `${r(a[0])},${r(a[1])}|${r(b[0])},${r(b[1])}`;
}

export function heuristicRoad(a: LngLat, b: LngLat, detourIndex: number): RoadRoute {
  const crow = haversineKm(a, b);
  const distanceKm = crow * detourIndex;
  return {
    distanceKm,
    durationMin: (distanceKm / 25) * 60, // placeholder speed; planner applies its own
    geometry: straightLine(a, b),
    fromOsrm: false,
  };
}

async function fetchOsrm(a: LngLat, b: LngLat, base = OSRM_BASE): Promise<RoadRoute> {
  const url = `${base}/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&alternatives=false&steps=false`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = (await res.json()) as {
    code: string;
    routes?: { distance: number; duration: number; geometry: string }[];
  };
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route) throw new Error(`OSRM code ${data.code}`);
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    geometry: decodePolyline(route.geometry),
    fromOsrm: true,
  };
}

export function roadRoute(
  a: LngLat,
  b: LngLat,
  detourIndex: number,
): Promise<RoadRoute> {
  const k = key(a, b);
  const hit = cache.get(k);
  if (hit) return hit;

  if (Date.now() < osrmDownUntil) {
    return Promise.resolve(heuristicRoad(a, b, detourIndex));
  }

  const p = fetchOsrm(a, b).catch(() => {
    osrmDownUntil = Date.now() + 60_000;
    cache.delete(k); // don't pin the fallback — retry OSRM after the backoff
    return heuristicRoad(a, b, detourIndex);
  });
  cache.set(k, p);
  return p;
}

/* ------------------------------ bicycle ------------------------------- */

const bikeCache = new Map<string, Promise<RoadRoute>>();
let bikeDownUntil = 0;

/** Bike-profile routing (bike paths, realistic cycling durations). */
export function bikeRoute(
  a: LngLat,
  b: LngLat,
  detourIndex: number,
): Promise<RoadRoute> {
  const k = key(a, b);
  const hit = bikeCache.get(k);
  if (hit) return hit;

  if (Date.now() < bikeDownUntil) {
    return Promise.resolve(heuristicRoad(a, b, detourIndex));
  }

  const p = fetchOsrm(a, b, FOSSGIS_BIKE).catch(() => {
    bikeDownUntil = Date.now() + 60_000;
    bikeCache.delete(k);
    return heuristicRoad(a, b, detourIndex);
  });
  bikeCache.set(k, p);
  return p;
}
