import type { LngLat } from "./types";

const R = 6371; // earth radius, km

/** Great-circle distance in km. */
export function haversineKm(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Bounding box [west, south, east, north] around a set of points with padding. */
export function bboxOf(points: LngLat[], padDeg = 0.01): [number, number, number, number] {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const [lng, lat] of points) {
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return [w - padDeg, s - padDeg, e + padDeg, n + padDeg];
}

export function centerOf(points: LngLat[]): LngLat {
  const [w, s, e, n] = bboxOf(points, 0);
  return [(w + e) / 2, (s + n) / 2];
}

/**
 * Decode a Google-encoded polyline to LngLat[].
 * OSRM uses precision 5; MOTIS/Valhalla-style geometries use 6 or 7.
 */
export function decodePolyline(str: string, precision = 5): LngLat[] {
  const factor = 10 ** precision;
  let index = 0,
    lat = 0,
    lng = 0;
  const coords: LngLat[] = [];
  while (index < str.length) {
    for (const which of [0, 1] as const) {
      let shift = 0,
        result = 0,
        byte = 0x20;
      while (byte >= 0x20) {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      }
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    coords.push([lng / factor, lat / factor]);
  }
  return coords;
}

/** Straight line between two points, densified slightly so it draws smoothly. */
export function straightLine(a: LngLat, b: LngLat, segments = 8): LngLat[] {
  const pts: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return pts;
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function formatMinRange(low: number, high: number): string {
  const l = Math.round(low);
  const h = Math.round(high);
  return l === h ? `${l} min` : `${l}–${h} min`;
}

export function formatPrice(low: number, high: number): string {
  const l = Math.round(low);
  const h = Math.round(high);
  if (l === 0 && h === 0) return "Free";
  return l === h ? `₹${l}` : `₹${l}–${h}`;
}
