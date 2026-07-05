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
const TIMEOUT_MS = 4000;

// Session-scoped cache: same leg gets asked for repeatedly as the user tweaks.
const cache = new Map<string, RoadRoute>();
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

export async function roadRoute(
  a: LngLat,
  b: LngLat,
  detourIndex: number,
): Promise<RoadRoute> {
  const k = key(a, b);
  const hit = cache.get(k);
  if (hit) return hit;

  if (Date.now() < osrmDownUntil) return heuristicRoad(a, b, detourIndex);

  try {
    const url = `${OSRM_BASE}/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&alternatives=false&steps=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: string }[];
    };
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) throw new Error(`OSRM code ${data.code}`);
    const out: RoadRoute = {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      geometry: decodePolyline(route.geometry),
      fromOsrm: true,
    };
    cache.set(k, out);
    return out;
  } catch {
    osrmDownUntil = Date.now() + 60_000;
    return heuristicRoad(a, b, detourIndex);
  }
}
