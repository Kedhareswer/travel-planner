import { haversineKm } from "../geo";
import type { LngLat, MetroLine, MetroNetwork, MetroStation } from "../types";

/**
 * Metro routing over a configured network: Dijkstra on a
 * (station, line) node graph so interchanges cost real time.
 */

export interface MetroRideSegment {
  line: MetroLine;
  /** ordered stations ridden on this line, inclusive of both ends */
  stations: MetroStation[];
  distanceKm: number;
  durationMin: number;
}

export interface MetroRide {
  entry: MetroStation;
  exit: MetroStation;
  segments: MetroRideSegment[];
  stationsCount: number;
  transfers: number;
  distanceKm: number;
  /** ride time incl. interchange walk, excl. platform wait */
  durationMin: number;
  /** null when the network has no fare table (region band fills in) */
  fare: number | null;
}

interface Node {
  stationId: string;
  lineId: string;
}

const nodeKey = (n: Node) => `${n.stationId}@${n.lineId}`;

interface Edge {
  to: Node;
  timeMin: number;
  distanceKm: number;
  kind: "ride" | "transfer";
}

/** Precomputed adjacency for a network (built once, cached by reference). */
const graphCache = new WeakMap<MetroNetwork, Map<string, Edge[]>>();

function buildGraph(net: MetroNetwork): Map<string, Edge[]> {
  const cached = graphCache.get(net);
  if (cached) return cached;

  const adj = new Map<string, Edge[]>();
  const push = (from: Node, edge: Edge) => {
    const k = nodeKey(from);
    if (!adj.has(k)) adj.set(k, []);
    adj.get(k)!.push(edge);
  };

  for (const line of net.lines) {
    for (let i = 0; i < line.stations.length - 1; i++) {
      const a = net.stations[line.stations[i]];
      const b = net.stations[line.stations[i + 1]];
      const dist = haversineKm(a.lngLat, b.lngLat) * 1.15; // track curvature
      const time = (dist / net.commercialSpeedKmh) * 60;
      const na: Node = { stationId: a.id, lineId: line.id };
      const nb: Node = { stationId: b.id, lineId: line.id };
      push(na, { to: nb, timeMin: time, distanceKm: dist, kind: "ride" });
      push(nb, { to: na, timeMin: time, distanceKm: dist, kind: "ride" });
    }
  }

  // Transfer edges at interchanges
  for (const st of Object.values(net.stations)) {
    if (st.lines.length < 2) continue;
    for (const l1 of st.lines) {
      for (const l2 of st.lines) {
        if (l1 === l2) continue;
        push(
          { stationId: st.id, lineId: l1 },
          {
            to: { stationId: st.id, lineId: l2 },
            timeMin: net.interchangePenaltyMin,
            distanceKm: 0,
            kind: "transfer",
          },
        );
      }
    }
  }

  graphCache.set(net, adj);
  return adj;
}

export function nearestStations(
  net: MetroNetwork,
  point: LngLat,
  count = 2,
  maxKm = 3.5,
): { station: MetroStation; km: number }[] {
  return Object.values(net.stations)
    .map((station) => ({ station, km: haversineKm(point, station.lngLat) }))
    .filter((s) => s.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, count);
}

export function metroFare(net: MetroNetwork, riddenKm: number): number | null {
  if (!net.fareSlabsKm) return null;
  for (const [maxKm, fare] of net.fareSlabsKm) {
    if (riddenKm <= maxKm) return fare;
  }
  return net.fareSlabsKm[net.fareSlabsKm.length - 1][1];
}

/** Shortest metro ride between two stations, or null if unreachable. */
export function metroRide(
  net: MetroNetwork,
  entryId: string,
  exitId: string,
): MetroRide | null {
  if (entryId === exitId) return null;
  const adj = buildGraph(net);
  const entry = net.stations[entryId];
  const exit = net.stations[exitId];
  if (!entry || !exit) return null;

  // Dijkstra from all (entry, line) nodes
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: Node; edge: Edge } | null>();
  const queue: { node: Node; d: number }[] = [];

  for (const lineId of entry.lines) {
    const n = { stationId: entryId, lineId };
    dist.set(nodeKey(n), 0);
    prev.set(nodeKey(n), null);
    queue.push({ node: n, d: 0 });
  }

  let best: Node | null = null;
  while (queue.length) {
    queue.sort((a, b) => a.d - b.d);
    const { node, d } = queue.shift()!;
    const k = nodeKey(node);
    if (d > (dist.get(k) ?? Infinity)) continue;
    if (node.stationId === exitId) {
      best = node;
      break;
    }
    for (const edge of adj.get(k) ?? []) {
      const nk = nodeKey(edge.to);
      const nd = d + edge.timeMin;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, { node, edge });
        queue.push({ node: edge.to, d: nd });
      }
    }
  }
  if (!best) return null;

  // Reconstruct path of (node, edge) steps
  const steps: { node: Node; edge: Edge }[] = [];
  let cur: Node | null = best;
  while (cur) {
    const p = prev.get(nodeKey(cur));
    if (!p) break;
    steps.unshift({ node: p.node, edge: p.edge });
    cur = p.node;
  }

  // Fold ride edges into per-line segments
  const segments: MetroRideSegment[] = [];
  let transfers = 0;
  let totalKm = 0;
  let totalMin = 0;

  for (const { node, edge } of steps) {
    totalMin += edge.timeMin;
    if (edge.kind === "transfer") {
      transfers++;
      continue;
    }
    totalKm += edge.distanceKm;
    const lineId = node.lineId;
    const line = net.lines.find((l) => l.id === lineId)!;
    const last = segments[segments.length - 1];
    const fromSt = net.stations[node.stationId];
    const toSt = net.stations[edge.to.stationId];
    if (last && last.line.id === lineId) {
      last.stations.push(toSt);
      last.distanceKm += edge.distanceKm;
      last.durationMin += edge.timeMin;
    } else {
      segments.push({
        line,
        stations: [fromSt, toSt],
        distanceKm: edge.distanceKm,
        durationMin: edge.timeMin,
      });
    }
  }

  const stationsCount = segments.reduce((n, s) => n + s.stations.length - 1, 0);

  return {
    entry,
    exit,
    segments,
    stationsCount,
    transfers,
    distanceKm: totalKm,
    durationMin: totalMin,
    fare: metroFare(net, totalKm),
  };
}
