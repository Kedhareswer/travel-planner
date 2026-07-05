import type { CityConfig, Place } from "./types";

/**
 * Place search: instant results from the city's curated dataset, augmented
 * by the Photon geocoder (OSM data, CORS-friendly, no API key) when online.
 * If the geocoder is unreachable the curated list keeps the app usable.
 */

const PHOTON = "https://photon.komoot.io/api/";
let photonDownUntil = 0;

export function searchLocal(city: CityConfig, query: string, limit = 6): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = city.places
    .map((p) => {
      const name = p.name.toLowerCase();
      const area = (p.area ?? "").toLowerCase();
      let score = -1;
      if (name.startsWith(q)) score = 3;
      else if (name.includes(q)) score = 2;
      else if (area.includes(q)) score = 1;
      return { p, score };
    })
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ p }) => ({ ...p, source: "local" as const }));
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id: number;
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    state?: string;
  };
}

export async function searchPhoton(
  city: CityConfig,
  query: string,
  limit = 5,
): Promise<Place[]> {
  if (Date.now() < photonDownUntil) return [];
  const [w, s, e, n] = city.bbox;
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    bbox: `${w},${s},${e},${n}`,
    lat: String(city.center[1]),
    lon: String(city.center[0]),
  });
  try {
    const res = await fetch(`${PHOTON}?${params}`, {
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) throw new Error(`photon ${res.status}`);
    const data = (await res.json()) as { features: PhotonFeature[] };
    return data.features
      .filter((f) => f.properties.name)
      .map((f) => ({
        id: `osm-${f.properties.osm_id}`,
        name: f.properties.name!,
        area:
          [f.properties.district, f.properties.city ?? f.properties.state]
            .filter(Boolean)
            .join(", ") || undefined,
        lngLat: f.geometry.coordinates,
        source: "photon" as const,
      }));
  } catch {
    photonDownUntil = Date.now() + 60_000;
    return [];
  }
}

/** Merged search: curated first (instant), geocoder for the long tail. */
export async function searchPlaces(city: CityConfig, query: string): Promise<Place[]> {
  const local = searchLocal(city, query);
  if (query.trim().length < 3) return local;
  const remote = await searchPhoton(city, query);
  const seen = new Set(local.map((p) => p.name.toLowerCase()));
  return [...local, ...remote.filter((p) => !seen.has(p.name.toLowerCase()))].slice(0, 8);
}
