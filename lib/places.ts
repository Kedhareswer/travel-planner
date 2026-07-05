import { CURATED_PACKS } from "@/data/regions";
import type { LngLat, Place } from "./types";

/**
 * Global place search: Photon (OSM geocoder, worldwide, no key, CORS) for
 * everything, with curated pack places mixed in for instant results where
 * we have them. Results carry ISO country codes, which drive region
 * resolution. If the geocoder is unreachable, curated places keep the
 * app usable.
 */

const PHOTON = "https://photon.komoot.io/api/";
let photonDownUntil = 0;

/** Instant results from curated pack datasets (e.g. Hyderabad landmarks). */
export function searchLocal(query: string, limit = 5): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { p: Place; score: number }[] = [];
  for (const pack of CURATED_PACKS) {
    for (const p of pack.places ?? []) {
      const name = p.name.toLowerCase();
      const area = (p.area ?? "").toLowerCase();
      let score = -1;
      if (name.startsWith(q)) score = 3;
      else if (name.includes(q)) score = 2;
      else if (area.includes(q)) score = 1;
      if (score >= 0) {
        scored.push({
          p: { ...p, countryCode: pack.countryCode, source: "local" as const },
          score,
        });
      }
    }
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.p);
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id: number;
    osm_type?: string; // N | W | R — needed to make ids unique across types
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
}

export async function searchPhoton(
  query: string,
  bias?: LngLat,
  limit = 6,
): Promise<Place[]> {
  if (Date.now() < photonDownUntil) return [];
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (bias) {
    params.set("lat", String(bias[1]));
    params.set("lon", String(bias[0]));
  }
  try {
    const res = await fetch(`${PHOTON}?${params}`, {
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) throw new Error(`photon ${res.status}`);
    const data = (await res.json()) as { features: PhotonFeature[] };
    return data.features
      .filter((f) => f.properties.name)
      .map((f) => ({
        id: `osm-${f.properties.osm_type ?? "X"}${f.properties.osm_id}`,
        name: f.properties.name!,
        area:
          [
            f.properties.district ?? f.properties.street,
            f.properties.city ?? f.properties.state,
            f.properties.country,
          ]
            .filter(Boolean)
            .join(", ") || undefined,
        lngLat: f.geometry.coordinates,
        countryCode: f.properties.countrycode?.toLowerCase(),
        source: "photon" as const,
      }));
  } catch {
    photonDownUntil = Date.now() + 60_000;
    return [];
  }
}

/** Merged search: curated hits first (instant), the world via geocoder. */
export async function searchPlaces(query: string, bias?: LngLat): Promise<Place[]> {
  const local = searchLocal(query);
  if (query.trim().length < 3) return local;
  const remote = await searchPhoton(query, bias);
  const seen = new Set(local.map((p) => p.name.toLowerCase()));
  return [...local, ...remote.filter((p) => !seen.has(p.name.toLowerCase()))].slice(0, 8);
}

/**
 * Name + country for a coordinate (used for "my location") via Photon
 * reverse geocoding — occasional interactive lookups are within its
 * fair-use policy. Falls back to a bare "My location" place.
 */
export async function reversePlace(lngLat: LngLat): Promise<Place> {
  const fallback: Place = {
    id: `me-${lngLat[0].toFixed(5)},${lngLat[1].toFixed(5)}`,
    name: "My location",
    lngLat,
    source: "photon",
  };
  try {
    const res = await fetch(
      `https://photon.komoot.io/reverse?lat=${lngLat[1]}&lon=${lngLat[0]}&limit=1`,
      { signal: AbortSignal.timeout(3500) },
    );
    if (!res.ok) return fallback;
    const data = (await res.json()) as { features: PhotonFeature[] };
    const f = data.features?.[0];
    if (!f) return fallback;
    return {
      ...fallback,
      name: "My location",
      area:
        [f.properties.name ?? f.properties.street, f.properties.city ?? f.properties.state]
          .filter(Boolean)
          .join(", ") || undefined,
      countryCode: f.properties.countrycode?.toLowerCase(),
    };
  } catch {
    return fallback;
  }
}
