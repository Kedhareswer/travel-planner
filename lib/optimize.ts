import { haversineKm } from "./geo";
import type { Place } from "./types";

/**
 * Stop-order optimization ("visit these places in the best order").
 *
 * First and last stops stay fixed (you start where you are and end where
 * you're going); intermediate stops are reordered to minimize total
 * straight-line distance — a good proxy when every leg uses similar modes.
 *
 * <= 6 free stops: exact (brute force). More: nearest-neighbor + 2-opt.
 */
export function optimizeStopOrder(stops: Place[]): Place[] {
  if (stops.length <= 3) return stops;
  const first = stops[0];
  const last = stops[stops.length - 1];
  const middle = stops.slice(1, -1);

  const ordered =
    middle.length <= 6
      ? bruteForce(first, middle, last)
      : twoOpt(first, nearestNeighbor(first, middle), last);

  return [first, ...ordered, last];
}

function tourLength(first: Place, middle: Place[], last: Place): number {
  let d = 0;
  let prev = first;
  for (const p of [...middle, last]) {
    d += haversineKm(prev.lngLat, p.lngLat);
    prev = p;
  }
  return d;
}

function bruteForce(first: Place, middle: Place[], last: Place): Place[] {
  let best = middle;
  let bestLen = tourLength(first, middle, last);
  for (const perm of permutations(middle)) {
    const len = tourLength(first, perm, last);
    if (len < bestLen) {
      best = perm;
      bestLen = len;
    }
  }
  return best;
}

function* permutations<T>(arr: T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield arr;
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      yield [arr[i], ...perm];
    }
  }
}

function nearestNeighbor(first: Place, middle: Place[]): Place[] {
  const remaining = [...middle];
  const ordered: Place[] = [];
  let cur = first;
  while (remaining.length) {
    let bestIdx = 0;
    let bestD = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(cur.lngLat, p.lngLat);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    });
    cur = remaining.splice(bestIdx, 1)[0];
    ordered.push(cur);
  }
  return ordered;
}

function twoOpt(first: Place, middle: Place[], last: Place): Place[] {
  let route = [...middle];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const candidate = [
          ...route.slice(0, i),
          ...route.slice(i, j + 1).reverse(),
          ...route.slice(j + 1),
        ];
        if (tourLength(first, candidate, last) < tourLength(first, route, last)) {
          route = candidate;
          improved = true;
        }
      }
    }
  }
  return route;
}
