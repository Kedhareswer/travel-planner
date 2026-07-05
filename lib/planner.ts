import { estimateFare, slabFare } from "./fares";
import { formatKm, haversineKm, straightLine } from "./geo";
import { googleMapsLink, providerHandoff } from "./providers";
import { metroRide, nearestStations } from "./transit/metro";
import { osmRailNetwork } from "./transit/overpass";
import { planTransit } from "./transit/transitous";
import { bikeRoute, roadRoute } from "./routing/osrm";
import type {
  LegPlan,
  MetroNetwork,
  ModeKind,
  Place,
  PriceBand,
  RegionProfile,
  RouteOption,
  RouteStep,
  TripPreferences,
} from "./types";

/**
 * The planner: for one leg (from -> to), in whatever region of the world
 * the stops are in, produce every viable RouteOption with time bands,
 * price bands in local currency, and drawable steps.
 *
 * Transit resolution is layered by data quality:
 *   curated pack network -> Transitous scheduled routing -> OSM-derived
 *   rail graph -> heuristic corridor bus. Road modes come from the
 *   region's transport catalog; walking and cycling are universal.
 */

export function defaultPrefs(region: RegionProfile): TripPreferences {
  return {
    valueOfTimePerHour: region.valueOfTimeDefault,
    // Thermal-comfort research puts the comfortable urban walk at
    // ~500-800 m in hot climates; 1.2 km errs slightly generous.
    maxWalkKm: 1.2,
    peakHours: false,
    excludedModes: [],
  };
}

/** Reserved non-catalog mode ids usable in prefs.excludedModes. */
export const TRANSIT_MODE_ID = "transit";
export const CYCLE_MODE_ID = "cycle";
export const WALK_MODE_ID = "walk";

/** Max distance we offer an own-bicycle option for. */
const CYCLE_MAX_KM = 10;
/** Max walk to/from a station before the access leg becomes an auto/cab hop. */
const STATION_WALK_MAX_KM = 0.8;

interface SpeedBand {
  fastKmh: number; // off-peak
  slowKmh: number; // peak
}

function speedForKind(region: RegionProfile, kind: ModeKind): SpeedBand {
  const s = region.speeds;
  switch (kind) {
    case "walk":
      return { fastKmh: s.walk, slowKmh: s.walk };
    case "cycle":
    case "scooter":
      return { fastKmh: s.cycle, slowKmh: s.cycle * 0.9 };
    case "bike":
      return { fastKmh: s.bike[1], slowKmh: s.bike[0] };
    case "auto":
      return { fastKmh: s.auto[1], slowKmh: s.auto[0] };
    case "bus":
      return { fastKmh: s.bus[1], slowKmh: s.bus[0] };
    default:
      return { fastKmh: s.car[1], slowKmh: s.car[0] };
  }
}

function rideMinutes(
  km: number,
  speed: SpeedBand,
  peak: boolean,
): { low: number; high: number } {
  const fast = (km / speed.fastKmh) * 60;
  const slow = (km / speed.slowKmh) * 60;
  return peak ? { low: (fast + slow) / 2, high: slow * 1.15 } : { low: fast, high: slow };
}

// One option per mode per leg — ids stay stable across replans.
const oid = (mode: string, leg: number) => `${mode}-${leg}`;

const price = (
  low: number,
  high: number,
  region: RegionProfile,
  surgeProne = false,
): PriceBand => ({
  low: Math.round(low * 100) / 100,
  high: Math.round(high * 100) / 100,
  currency: region.currency,
  surgeProne,
});

/** Build every option for one leg. Road geometry is fetched once and shared. */
export async function planLeg(
  region: RegionProfile,
  from: Place,
  to: Place,
  legIndex: number,
  prefs: TripPreferences,
): Promise<LegPlan> {
  const road = await roadRoute(from.lngLat, to.lngLat, region.speeds.detourIndex);
  const crowKm = haversineKm(from.lngLat, to.lngLat);
  const roadKm = road.distanceKm;
  // Walking/cycling cut corners cars can't; cap their distance estimate.
  const walkKm = Math.min(roadKm, crowKm * 1.3);
  const options: RouteOption[] = [];
  const excluded = new Set(prefs.excludedModes);

  // ---- Walk ----
  if (walkKm <= prefs.maxWalkKm && !excluded.has(WALK_MODE_ID)) {
    const mins = (walkKm / region.speeds.walk) * 60;
    options.push({
      id: oid(WALK_MODE_ID, legIndex),
      mode: WALK_MODE_ID,
      label: "Walk",
      kind: "walk",
      color: "#64748b",
      legIndex,
      summary: `${formatKm(walkKm)} on foot`,
      durationMin: { low: mins, high: mins * 1.15 },
      price: price(0, 0, region),
      distanceKm: walkKm,
      walkKm,
      transfers: 0,
      steps: [
        {
          kind: "walk",
          label: `Walk to ${to.name}`,
          distanceKm: walkKm,
          durationMin: mins,
          geometry: road.fromOsrm ? road.geometry : straightLine(from.lngLat, to.lngLat),
        },
      ],
      bookingUrl: googleMapsLink(from, to, "walking"),
      bookingLabel: "Walking directions",
      notes:
        walkKm > 1.2
          ? ["Long walk — consider heat, footpath quality and time of day"]
          : [],
      dataTier: road.fromOsrm ? "live" : "estimated",
    });
  }

  // ---- Own bicycle (bike-profile routing: paths & cycleways) ----
  if (region.cycling && crowKm <= CYCLE_MAX_KM && !excluded.has(CYCLE_MODE_ID)) {
    const bike = await bikeRoute(from.lngLat, to.lngLat, region.speeds.detourIndex);
    const cycleKm = bike.fromOsrm ? bike.distanceKm : Math.min(roadKm, crowKm * 1.35);
    const ride = bike.fromOsrm
      ? { low: bike.durationMin, high: bike.durationMin * 1.2 }
      : rideMinutes(cycleKm, speedForKind(region, "cycle"), prefs.peakHours);
    options.push({
      id: oid(CYCLE_MODE_ID, legIndex),
      mode: CYCLE_MODE_ID,
      label: "Bicycle",
      kind: "cycle",
      color: "#0d9488",
      legIndex,
      summary: `${formatKm(cycleKm)} by bike`,
      durationMin: ride,
      price: price(0, 0, region),
      distanceKm: cycleKm,
      walkKm: 0,
      transfers: 0,
      steps: [
        {
          kind: "cycle",
          label: `Cycle to ${to.name}`,
          detail: formatKm(cycleKm),
          distanceKm: cycleKm,
          durationMin: (ride.low + ride.high) / 2,
          geometry: bike.fromOsrm ? bike.geometry : road.geometry,
        },
      ],
      bookingUrl: googleMapsLink(from, to, "bicycling"),
      bookingLabel: "Cycling directions",
      notes: ["Assumes you have a bicycle available"],
      dataTier: bike.fromOsrm ? "live" : "estimated",
    });
  }

  // ---- Road modes from the region's transport catalog ----
  for (const tm of region.roadModes) {
    if (excluded.has(tm.id)) continue;
    if (tm.maxKm && roadKm > tm.maxKm) continue;
    const speed = speedForKind(region, tm.kind);
    const ride = rideMinutes(roadKm, speed, prefs.peakHours);
    const wait = tm.pickupWaitMin ?? [2, 6];
    const fareBand = estimateFare(tm.fare, roadKm, (ride.low + ride.high) / 2);
    const booking = providerHandoff(tm.provider, from, to) ?? {
      url: googleMapsLink(from, to, "driving"),
      label: "Directions",
    };
    const notes = [...(tm.fare.notes ?? [])];
    if (fareBand.surgeProne && prefs.peakHours) notes.push("Peak hours — surge pricing likely");
    if (!road.fromOsrm) notes.push("Distance estimated (road routing unavailable)");

    options.push({
      id: oid(tm.id, legIndex),
      mode: tm.id,
      label: tm.label,
      kind: tm.kind,
      color: tm.color,
      legIndex,
      summary: `${formatKm(roadKm)} by road`,
      durationMin: { low: ride.low + wait[0], high: ride.high + wait[1] },
      price: { ...fareBand, currency: region.currency },
      distanceKm: roadKm,
      walkKm: 0,
      transfers: 0,
      steps: [
        {
          kind: "wait",
          label: "Pickup wait",
          distanceKm: 0,
          durationMin: (wait[0] + wait[1]) / 2,
          geometry: [],
        },
        {
          kind: tm.kind,
          label: `Ride to ${to.name}`,
          detail: formatKm(roadKm),
          distanceKm: roadKm,
          durationMin: (ride.low + ride.high) / 2,
          geometry: road.geometry,
        },
      ],
      bookingUrl: booking.url,
      bookingLabel: booking.label,
      notes,
      dataTier: region.tier === "curated" ? "curated" : "estimated",
    });
  }

  // ---- Public transit (layered sources) ----
  if (!excluded.has(TRANSIT_MODE_ID) && crowKm >= 1) {
    const transit = await transitOptions(region, from, to, legIndex, prefs, roadKm, road.geometry, road.fromOsrm);
    options.push(...transit);
  }

  const scored = options.sort(
    (a, b) => generalizedCost(a, prefs) - generalizedCost(b, prefs),
  );

  return {
    from,
    to,
    legIndex,
    options: scored,
    paretoIds: paretoSet(scored).map((o) => o.id),
  };
}

/* ------------------------------ Transit chain ---------------------------- */

async function transitOptions(
  region: RegionProfile,
  from: Place,
  to: Place,
  legIndex: number,
  prefs: TripPreferences,
  roadKm: number,
  roadGeometry: [number, number][],
  roadFromOsrm: boolean,
): Promise<RouteOption[]> {
  const out: RouteOption[] = [];

  // Tier 1 — curated pack network (best data, includes real fares)
  if (region.metro) {
    const opt = buildRailOption(region, region.metro, from, to, legIndex, prefs, "curated");
    if (opt) out.push(opt);
  } else {
    // Tier 2 — Transitous scheduled routing (real timetables worldwide,
    // where coverage exists)
    const itineraries = await planTransit(from.lngLat, to.lngLat);
    if (itineraries?.length) {
      out.push(transitousOption(region, itineraries[0], from, to, legIndex));
    } else {
      // Tier 3 — OSM-derived rail graph
      const net = await osmRailNetwork(from.lngLat, to.lngLat);
      if (net) {
        const opt = buildRailOption(region, net, from, to, legIndex, prefs, "estimated");
        if (opt) out.push(opt);
      }
    }
  }

  // Corridor bus heuristic — only when no scheduled source produced the
  // bus picture (Transitous itineraries already include buses).
  const haveScheduled = out.some((o) => o.dataTier === "live");
  if (!haveScheduled && roadKm >= 1.5) {
    out.push(busHeuristicOption(region, from, to, legIndex, prefs, roadKm, roadGeometry, roadFromOsrm));
  }

  return out;
}

/** Map the best Transitous itinerary to a RouteOption. */
function transitousOption(
  region: RegionProfile,
  it: import("./transit/transitous").TransitousItinerary,
  from: Place,
  to: Place,
  legIndex: number,
): RouteOption {
  const steps: RouteStep[] = it.legs.map((leg) => ({
    kind: leg.kind,
    label:
      leg.kind === "walk"
        ? `Walk to ${leg.toName}`
        : `${leg.routeName ?? leg.kind} · ${leg.fromName} → ${leg.toName}`,
    detail: leg.headsign ? `toward ${leg.headsign}` : undefined,
    distanceKm: leg.distanceKm,
    durationMin: leg.durationMin,
    geometry: leg.geometry,
    color: leg.color,
  }));

  // Fares aren't in most GTFS feeds — use the region band per boarding,
  // assuming transfers are often free/capped past the second vehicle.
  const [fmLow, fmHigh] = region.transitFare.metro;
  const [fbLow, fbHigh] = region.transitFare.bus;
  const railBoardings = it.legs.filter((l) => ["metro", "train", "tram", "ferry"].includes(l.kind)).length;
  const busBoardings = it.boardings - railBoardings;
  const low = Math.min(railBoardings ? fmLow : Infinity, busBoardings ? fbLow : Infinity);
  const high =
    (railBoardings ? fmHigh : 0) + (busBoardings ? fbHigh : 0) * Math.min(busBoardings, 1);

  const kinds = it.legs.filter((l) => l.kind !== "walk").map((l) => l.kind);
  const primaryKind = (kinds.find((k) => k === "metro" || k === "train") ?? kinds[0] ?? "bus") as ModeKind;
  const lineNames = it.legs.filter((l) => l.routeName).map((l) => l.routeName).slice(0, 3);

  return {
    id: oid(TRANSIT_MODE_ID, legIndex),
    mode: TRANSIT_MODE_ID,
    label: "Public transit",
    kind: primaryKind,
    color: "#0ea5e9",
    legIndex,
    summary: lineNames.length ? lineNames.join(" → ") : "Scheduled transit",
    durationMin: { low: it.durationMin, high: it.durationMin * 1.15 },
    price: price(low === Infinity ? fbLow : low, Math.max(high, low === Infinity ? fbHigh : low), region),
    distanceKm: it.distanceKm,
    walkKm: it.walkKm,
    transfers: it.transfers,
    steps,
    bookingUrl: googleMapsLink(from, to, "transit"),
    bookingLabel: "Transit directions",
    notes: ["Live timetable routing (Transitous) — fares are a local estimate band"],
    dataTier: "live",
  };
}

/** Shared rail-graph option builder (curated pack or OSM-derived). */
function buildRailOption(
  region: RegionProfile,
  net: MetroNetwork,
  from: Place,
  to: Place,
  legIndex: number,
  prefs: TripPreferences,
  dataTier: "curated" | "estimated",
): RouteOption | null {
  const entries = nearestStations(net, from.lngLat, 2);
  const exits = nearestStations(net, to.lngLat, 2);
  if (!entries.length || !exits.length) return null;
  const stationWalkMax = Math.min(STATION_WALK_MAX_KM, prefs.maxWalkKm);

  // Score = ride time + access/egress at walking pace + transfer aversion.
  const walkMinPerKm = 60 / region.speeds.walk;
  let best: { ride: NonNullable<ReturnType<typeof metroRide>>; entryKm: number; exitKm: number } | null = null;
  let bestScore = Infinity;
  for (const e of entries) {
    for (const x of exits) {
      if (e.station.id === x.station.id) continue;
      const ride = metroRide(net, e.station.id, x.station.id);
      if (!ride) continue;
      const s = ride.durationMin + (e.km + x.km) * walkMinPerKm + ride.transfers * 6;
      if (s < bestScore) {
        bestScore = s;
        best = { ride, entryKm: e.km, exitKm: x.km };
      }
    }
  }
  if (!best) return null;
  const { ride, entryKm, exitKm } = best;

  const crowKm = haversineKm(from.lngLat, to.lngLat);
  if (crowKm < 1 || ride.distanceKm < 1 || ride.distanceKm < crowKm * 0.45) return null;

  // Fare: real slabs when the network has them, else the region band.
  const fareLow = ride.fare ?? region.transitFare.metro[0];
  const fareHigh = ride.fare ?? region.transitFare.metro[1];

  const steps: RouteStep[] = [];
  const notes: string[] = [];
  let priceLow = fareLow;
  let priceHigh = fareHigh;
  let walkTotal = 0;

  const access = accessLeg(region, from.lngLat, ride.entry.lngLat, entryKm, `${ride.entry.name} station`, stationWalkMax);
  steps.push(access.step);
  priceLow += access.price.low;
  priceHigh += access.price.high;
  walkTotal += access.walkKm;

  steps.push({
    kind: "wait",
    label: "Ticket + platform wait",
    distanceKm: 0,
    durationMin: net.avgWaitMin,
    geometry: [],
  });

  ride.segments.forEach((seg, i) => {
    if (i > 0) {
      steps.push({
        kind: "transfer",
        label: `Interchange at ${seg.stations[0].name}`,
        distanceKm: 0,
        durationMin: net.interchangePenaltyMin,
        geometry: [],
      });
    }
    steps.push({
      kind: "metro",
      label: `${seg.line.name} · ${seg.stations[0].name} → ${seg.stations[seg.stations.length - 1].name}`,
      detail: `${seg.stations.length - 1} stops`,
      distanceKm: seg.distanceKm,
      durationMin: seg.durationMin,
      geometry: seg.stations.map((s) => s.lngLat),
      color: seg.line.color,
    });
  });
  if (ride.transfers > 0) notes.push(`${ride.transfers} interchange${ride.transfers > 1 ? "s" : ""}`);

  const egressWalkMax = Math.max(0, Math.min(stationWalkMax, prefs.maxWalkKm - access.walkKm));
  const egress = accessLeg(region, ride.exit.lngLat, to.lngLat, exitKm, to.name, egressWalkMax);
  steps.push(egress.step);
  priceLow += egress.price.low;
  priceHigh += egress.price.high;
  walkTotal += egress.walkKm;

  const rideMin = ride.durationMin + net.avgWaitMin;
  const low = rideMin + access.durationMin.low + egress.durationMin.low;
  const high = rideMin * 1.1 + access.durationMin.high + egress.durationMin.high;

  if (dataTier === "curated") {
    if (ride.fare !== null) notes.push(`Metro fare ${region.currency === "INR" ? "₹" : ""}${ride.fare}`);
    if (net.firstTrain && net.lastTrain) notes.push(`Trains ${net.firstTrain}–${net.lastTrain}`);
  } else {
    notes.push("Network from OpenStreetMap; fares are a local estimate band");
  }

  return {
    id: oid("metro", legIndex),
    mode: "metro",
    label: dataTier === "curated" ? "Metro" : "Metro / rail",
    kind: "metro",
    color: "#0ea5e9",
    legIndex,
    summary: `${ride.entry.name} → ${ride.exit.name}`,
    durationMin: { low, high },
    price: {
      low: Math.round(priceLow),
      high: Math.round(priceHigh),
      currency: region.currency,
      surgeProne: access.price.surgeProne || egress.price.surgeProne,
    },
    distanceKm: ride.distanceKm + entryKm + exitKm,
    walkKm: walkTotal,
    transfers: ride.transfers,
    steps,
    bookingUrl: googleMapsLink(from, to, "transit"),
    bookingLabel: "Transit directions",
    notes,
    dataTier,
  };
}

function busHeuristicOption(
  region: RegionProfile,
  from: Place,
  to: Place,
  legIndex: number,
  prefs: TripPreferences,
  roadKm: number,
  roadGeometry: [number, number][],
  roadFromOsrm: boolean,
): RouteOption {
  const busKm = roadKm * 1.1; // buses detour via stops
  const busWalkKm = 0.4;
  const busWalkMin = (busWalkKm / region.speeds.walk) * 60;
  const ride = rideMinutes(busKm, speedForKind(region, "bus"), prefs.peakHours);
  const wait = region.speeds.busAvgWaitMin;
  const [bandLow, bandHigh] = region.transitFare.bus;
  const fareLow = region.busFareSlabsKm ? slabFare(region.busFareSlabsKm, busKm) : bandLow;
  const fareHigh = region.busFareSlabsKm ? Math.round(fareLow * 1.6) : bandHigh;

  const notes = ["Indicative — assumes a direct bus exists on this corridor; check live routes"];
  if (region.id === "city:hyderabad") {
    notes.push("Women residents of Telangana ride free on Ordinary/Express (Mahalakshmi scheme)");
  }

  return {
    id: oid("bus", legIndex),
    mode: "bus",
    label: "City bus",
    kind: "bus",
    color: "#22c55e",
    legIndex,
    summary: `~${formatKm(busKm)} by bus`,
    durationMin: {
      low: ride.low + wait * 0.6 + busWalkMin,
      high: ride.high + wait * 1.6 + busWalkMin,
    },
    price: price(fareLow, fareHigh, region),
    distanceKm: busKm,
    walkKm: busWalkKm,
    transfers: 0,
    steps: [
      {
        kind: "walk",
        label: "Walk to/from bus stops",
        detail: formatKm(busWalkKm),
        distanceKm: busWalkKm,
        durationMin: busWalkMin,
        geometry: [],
      },
      { kind: "wait", label: "Wait for bus", distanceKm: 0, durationMin: wait, geometry: [] },
      {
        kind: "bus",
        label: `Bus toward ${to.name}`,
        detail: "Route availability varies",
        distanceKm: busKm,
        durationMin: (ride.low + ride.high) / 2,
        geometry: roadGeometry,
      },
    ],
    bookingUrl: googleMapsLink(from, to, "transit"),
    bookingLabel: "Transit directions",
    notes,
    dataTier: roadFromOsrm ? "estimated" : "estimated",
  };
}

/** Walk if close, otherwise a short paid hop — the first/last-mile reality. */
function accessLeg(
  region: RegionProfile,
  from: [number, number],
  to: [number, number],
  crowKm: number,
  destLabel: string,
  walkMaxKm: number,
): {
  step: RouteStep;
  price: PriceBand;
  durationMin: { low: number; high: number };
  walkKm: number;
} {
  const walkKm = crowKm * 1.25;
  if (walkKm <= walkMaxKm) {
    const mins = (walkKm / region.speeds.walk) * 60;
    return {
      step: {
        kind: "walk",
        label: `Walk to ${destLabel}`,
        detail: formatKm(walkKm),
        distanceKm: walkKm,
        durationMin: mins,
        geometry: straightLine(from, to),
      },
      price: price(0, 0, region),
      durationMin: { low: mins, high: mins * 1.2 },
      walkKm,
    };
  }
  // Short paid hop with the cheapest quick road mode available here
  const hop =
    region.roadModes.find((m) => m.kind === "auto") ??
    region.roadModes.find((m) => m.kind === "bike") ??
    region.roadModes[0];
  const roadKm = crowKm * region.speeds.detourIndex;
  const kind = hop?.kind ?? "auto";
  const speed = speedForKind(region, kind);
  const mins = (roadKm / ((speed.fastKmh + speed.slowKmh) / 2)) * 60 + 3;
  const fare = hop
    ? estimateFare(hop.fare, roadKm, mins)
    : { low: 2, high: 5, surgeProne: true };
  return {
    step: {
      kind,
      label: `${hop?.label ?? "Ride"} to ${destLabel}`,
      detail: formatKm(roadKm),
      distanceKm: roadKm,
      durationMin: mins,
      geometry: straightLine(from, to),
    },
    price: { ...fare, currency: region.currency },
    durationMin: { low: mins * 0.8, high: mins * 1.3 },
    walkKm: 0,
  };
}

/* ------------------------------- Ranking -------------------------------- */

export function midTime(o: RouteOption): number {
  return (o.durationMin.low + o.durationMin.high) / 2;
}

export function midPrice(o: RouteOption): number {
  return (o.price.low + o.price.high) / 2;
}

/** Local-currency-equivalent cost: money + time valued at the user's rate. */
export function generalizedCost(o: RouteOption, prefs: TripPreferences): number {
  return midPrice(o) + (midTime(o) / 60) * prefs.valueOfTimePerHour;
}

/** Options not dominated on (time, price) by any other option. */
export function paretoSet(options: RouteOption[]): RouteOption[] {
  return options.filter(
    (a) =>
      !options.some(
        (b) =>
          b !== a &&
          midTime(b) <= midTime(a) &&
          midPrice(b) <= midPrice(a) &&
          (midTime(b) < midTime(a) || midPrice(b) < midPrice(a)),
      ),
  );
}

export function fastestOf(options: RouteOption[]): RouteOption | undefined {
  return [...options].sort((a, b) => midTime(a) - midTime(b))[0];
}

export function cheapestOf(options: RouteOption[]): RouteOption | undefined {
  return [...options].sort(
    (a, b) => midPrice(a) - midPrice(b) || midTime(a) - midTime(b),
  )[0];
}
