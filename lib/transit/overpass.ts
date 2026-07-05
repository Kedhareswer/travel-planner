import { haversineKm } from "../geo";
import type { LngLat, MetroLine, MetroNetwork, MetroStation } from "../types";

/**
 * Build an urban-rail network for ANY city from OpenStreetMap, at runtime.
 *
 * OSM maps metro/light-rail/tram lines as `route` relations with ordered
 * "stop" members — enough to run the same Dijkstra engine the curated
 * Hyderabad pack uses. Quality varies by city (OSM is crowd-mapped) and
 * fares are unknown (the region's fare band fills in), so options built
 * from this are labeled "estimated".
 *
 * Results are cached in-memory and in localStorage for a week per area.
 */

const INSTANCES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const TIMEOUT_MS = 20_000;
const CACHE_VERSION = "osm-rail-v1";
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
/** don't attempt to build networks for trips spanning more than ~80 km */
const MAX_SPAN_KM = 80;

interface OverpassElement {
  type: "relation" | "node" | "way";
  id: number;
  tags?: Record<string, string>;
  members?: { type: string; ref: number; role: string }[];
  lat?: number;
  lon?: number;
}

const memCache = new Map<string, Promise<MetroNetwork | null>>();
let downUntil = 0;

function areaKey(center: LngLat): string {
  // ~11 km tiles: one network per metro area, shared across nearby trips
  return `${CACHE_VERSION}:${Math.round(center[0] * 10) / 10},${Math.round(center[1] * 10) / 10}`;
}

function readLocalCache(key: string): MetroNetwork | null | undefined {
  if (typeof localStorage === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const { at, net } = JSON.parse(raw) as { at: number; net: MetroNetwork | null };
    if (Date.now() - at > CACHE_TTL_MS) return undefined;
    return net; // may be null = "known to have no rail here"
  } catch {
    return undefined;
  }
}

function writeLocalCache(key: string, net: MetroNetwork | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), net }));
  } catch {
    /* quota — fine, memory cache still works */
  }
}

/**
 * Fetch + build the rail network around a trip. Returns null when there is
 * no mapped urban rail, the area is too large, or Overpass is unreachable.
 */
export function osmRailNetwork(a: LngLat, b: LngLat): Promise<MetroNetwork | null> {
  if (haversineKm(a, b) > MAX_SPAN_KM) return Promise.resolve(null);
  const center: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const key = areaKey(center);

  const inMem = memCache.get(key);
  if (inMem) return inMem;

  const local = readLocalCache(key);
  if (local !== undefined) {
    const p = Promise.resolve(local);
    memCache.set(key, p);
    return p;
  }

  if (Date.now() < downUntil) return Promise.resolve(null);

  const p = (async () => {
    try {
      const net = await fetchAndBuild(a, b);
      writeLocalCache(key, net);
      return net;
    } catch {
      downUntil = Date.now() + 300_000;
      memCache.delete(key);
      return null;
    }
  })();
  memCache.set(key, p);
  return p;
}

async function fetchAndBuild(a: LngLat, b: LngLat): Promise<MetroNetwork | null> {
  // Pad the trip bbox so nearby lines/stations are included
  const pad = 0.09; // ~10 km
  const s = Math.min(a[1], b[1]) - pad;
  const n = Math.max(a[1], b[1]) + pad;
  const w = Math.min(a[0], b[0]) - pad;
  const e = Math.max(a[0], b[0]) + pad;

  const query = `[out:json][timeout:25];
rel["type"="route"]["route"~"^(subway|light_rail|monorail|tram)$"](${s},${w},${n},${e})->.r;
.r out body;
node(r.r);
out body qt;`;

  let data: { elements: OverpassElement[] } | null = null;
  for (const instance of INSTANCES) {
    try {
      const res = await fetch(instance, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      data = (await res.json()) as { elements: OverpassElement[] };
      break;
    } catch {
      continue;
    }
  }
  if (!data) throw new Error("overpass unreachable");

  return buildNetwork(data.elements);
}

/**
 * Turn Overpass relations + nodes into a MetroNetwork.
 * Exported for fixture tests.
 */
export function buildNetwork(elements: OverpassElement[]): MetroNetwork | null {
  const nodes = new Map<number, OverpassElement>();
  const relations: OverpassElement[] = [];
  for (const el of elements) {
    if (el.type === "node") nodes.set(el.id, el);
    else if (el.type === "relation") relations.push(el);
  }
  if (!relations.length) return null;

  // OSM has one relation per direction — group by line identity and keep
  // the direction with the most stops.
  const byLine = new Map<string, OverpassElement>();
  for (const rel of relations) {
    const t = rel.tags ?? {};
    const lineKey = `${t.ref ?? t.name ?? rel.id}|${t.colour ?? t.color ?? ""}`;
    const stops = stopMembers(rel).length;
    if (stops < 2) continue;
    const existing = byLine.get(lineKey);
    if (!existing || stops > stopMembers(existing).length) byLine.set(lineKey, rel);
  }
  if (!byLine.size) return null;

  // Huge combined networks (e.g. a city with 40 tram lines) blow up the
  // graph and the map — prefer heavy rail when there's plenty of it.
  if (byLine.size > 25) {
    const heavy = [...byLine.entries()].filter(([, r]) => r.tags?.route !== "tram");
    if (heavy.length >= 3) {
      byLine.clear();
      for (const [k, v] of heavy) byLine.set(k, v);
    }
  }

  // Merge platform-level stops into stations by (normalized name + proximity)
  const stations: Record<string, MetroStation> = {};
  const lines: MetroLine[] = [];
  let anySubway = false;

  for (const rel of byLine.values()) {
    const t = rel.tags ?? {};
    if (t.route === "subway" || t.route === "light_rail") anySubway = true;
    const lineId = `osm-${rel.id}`;
    const orderedStations: string[] = [];

    for (const m of stopMembers(rel)) {
      const node = nodes.get(m.ref);
      if (!node || node.lat === undefined || node.lon === undefined) continue;
      const name = node.tags?.name ?? "Station";
      const lngLat: LngLat = [node.lon, node.lat];
      const stationId = mergeStation(stations, name, lngLat, lineId);
      if (orderedStations[orderedStations.length - 1] !== stationId) {
        orderedStations.push(stationId);
      }
    }
    if (orderedStations.length < 2) continue;

    lines.push({
      id: lineId,
      name: t.ref ?? t.name ?? "Line",
      color: normalizeColor(t.colour ?? t.color) ?? "#0ea5e9",
      stations: orderedStations,
    });
  }
  if (!lines.length) return null;

  return {
    lines,
    stations,
    fareSlabsKm: null, // unknown — region fare band fills in
    commercialSpeedKmh: anySubway ? 30 : 18,
    avgWaitMin: 5,
    interchangePenaltyMin: 4,
  };
}

function stopMembers(rel: OverpassElement) {
  return (rel.members ?? []).filter(
    (m) => m.type === "node" && m.role.startsWith("stop"),
  );
}

function mergeStation(
  stations: Record<string, MetroStation>,
  name: string,
  lngLat: LngLat,
  lineId: string,
): string {
  const norm = name.toLowerCase().replace(/\s+/g, " ").trim();
  for (const st of Object.values(stations)) {
    if (
      st.name.toLowerCase().replace(/\s+/g, " ").trim() === norm &&
      haversineKm(st.lngLat, lngLat) < 0.3
    ) {
      if (!st.lines.includes(lineId)) st.lines.push(lineId);
      return st.id;
    }
  }
  const id = `st-${Object.keys(stations).length}-${norm.replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`;
  stations[id] = { id, name, lngLat, lines: [lineId] };
  return id;
}

function normalizeColor(c?: string): string | undefined {
  if (!c) return undefined;
  const v = c.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
  // named colors ("red", "blue") are valid CSS — pass through
  return v;
}
