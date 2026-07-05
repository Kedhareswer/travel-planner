import { bookingFor } from "./deeplinks";
import { estimateFare, slabFare } from "./fares";
import { formatKm, haversineKm, straightLine } from "./geo";
import { metroRide, nearestStations } from "./transit/metro";
import { roadRoute } from "./routing/osrm";
import type {
  CityConfig,
  LegPlan,
  ModeId,
  Place,
  PriceBand,
  RouteOption,
  RouteStep,
  TripPreferences,
} from "./types";

/**
 * The planner: for one leg (from -> to) produce every viable RouteOption
 * with time bands, price bands and drawable steps, then mark the Pareto set.
 *
 * Time bands come from [off-peak, peak] speeds plus pickup/platform waits.
 * Price bands come from fare cards plus a demand-pricing uncertainty band.
 */

export const DEFAULT_PREFS: TripPreferences = {
  valueOfTimePerHour: 150,
  // Thermal-comfort research puts the comfortable walk in Indian heat at
  // ~500-800 m; 1.2 km default errs slightly generous, user-adjustable.
  maxWalkKm: 1.2,
  peakHours: false,
  excludedModes: [],
};

/** Max walk to/from a metro station before we switch the access leg to an auto. */
const STATION_WALK_MAX_KM = 0.8;
/** Pickup wait bands per road mode, minutes [low, high]. */
const PICKUP_WAIT: Record<string, [number, number]> = {
  auto: [1, 4],
  "uber-go": [3, 8],
  "uber-auto": [2, 6],
  "uber-moto": [2, 5],
  "rapido-bike": [2, 5],
  "rapido-auto": [2, 6],
  "rapido-cab": [3, 8],
};

interface SpeedBand {
  low: number; // km/h off-peak
  high: number; // km/h peak (slower)
}

function speedFor(city: CityConfig, mode: ModeId): SpeedBand {
  const s = city.speeds;
  switch (mode) {
    case "walk":
      return { low: s.walk, high: s.walk };
    case "uber-moto":
    case "rapido-bike":
      return { low: s.bike[1], high: s.bike[0] };
    case "auto":
    case "uber-auto":
    case "rapido-auto":
      return { low: s.auto[1], high: s.auto[0] };
    case "uber-go":
    case "rapido-cab":
      return { low: s.car[1], high: s.car[0] };
    case "bus":
      return { low: s.bus[1], high: s.bus[0] };
    case "metro":
      return { low: city.metro?.commercialSpeedKmh ?? 32, high: city.metro?.commercialSpeedKmh ?? 32 };
  }
}

function rideMinutes(km: number, speed: SpeedBand, peak: boolean): { low: number; high: number } {
  // Peak toggle narrows the band toward the slow end rather than pretending certainty.
  const fast = (km / speed.low) * 60;
  const slow = (km / speed.high) * 60;
  return peak ? { low: (fast + slow) / 2, high: slow * 1.15 } : { low: fast, high: slow };
}

// One option per mode per leg, so this id is unique AND stable across
// replans — React keys and the user's selection survive recomputation.
const oid = (mode: string, leg: number) => `${mode}-${leg}`;

/** Build every option for one leg. Road geometry is fetched once and shared. */
export async function planLeg(
  city: CityConfig,
  from: Place,
  to: Place,
  legIndex: number,
  prefs: TripPreferences,
): Promise<LegPlan> {
  const road = await roadRoute(from.lngLat, to.lngLat, city.speeds.detourIndex);
  const crowKm = haversineKm(from.lngLat, to.lngLat);
  const roadKm = road.distanceKm;
  // Walking cuts corners cars can't; cap the walking distance estimate.
  const walkKm = Math.min(roadKm, crowKm * 1.3);
  const options: RouteOption[] = [];

  // ---- Walk ----
  if (walkKm <= prefs.maxWalkKm) {
    const mins = (walkKm / city.speeds.walk) * 60;
    options.push({
      id: oid("walk", legIndex),
      mode: "walk",
      legIndex,
      summary: `${formatKm(walkKm)} on foot`,
      durationMin: { low: mins, high: mins * 1.15 },
      price: { low: 0, high: 0, surgeProne: false },
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
      bookingUrl: bookingFor("walk", from, to)?.url,
      bookingLabel: bookingFor("walk", from, to)?.label,
      notes: walkKm > 1.2 ? ["Long walk — consider heat, footpath quality and time of day"] : [],
      roadGeometry: road.fromOsrm,
    });
  }

  // ---- Road modes from fare cards ----
  for (const card of city.fareCards) {
    if (prefs.excludedModes.includes(card.mode)) continue;
    const speed = speedFor(city, card.mode);
    const ride = rideMinutes(roadKm, speed, prefs.peakHours);
    const wait = PICKUP_WAIT[card.mode] ?? [2, 6];
    const price = estimateFare(card, roadKm, (ride.low + ride.high) / 2);
    const booking = bookingFor(card.mode, from, to);
    const notes = [...(card.notes ?? [])];
    if (price.surgeProne && prefs.peakHours) notes.push("Peak hours — surge pricing likely");
    if (!road.fromOsrm) notes.push("Distance estimated (road routing unavailable)");

    options.push({
      id: oid(card.mode, legIndex),
      mode: card.mode,
      legIndex,
      summary: `${formatKm(roadKm)} by road`,
      durationMin: { low: ride.low + wait[0], high: ride.high + wait[1] },
      price,
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
          kind: modeKindOf(card.mode),
          label: `Ride to ${to.name}`,
          detail: formatKm(roadKm),
          distanceKm: roadKm,
          durationMin: (ride.low + ride.high) / 2,
          geometry: road.geometry,
        },
      ],
      bookingUrl: booking?.url,
      bookingLabel: booking?.label,
      notes,
      roadGeometry: road.fromOsrm,
    });
  }

  // ---- Metro (with access/egress legs) ----
  if (city.metro && !prefs.excludedModes.includes("metro")) {
    const metroOpt = buildMetroOption(city, from, to, legIndex, prefs);
    if (metroOpt) options.push(metroOpt);
  }

  // ---- Bus (indicative) ----
  if (!prefs.excludedModes.includes("bus") && roadKm >= 1.5) {
    const busKm = roadKm * 1.1; // buses detour via stops
    const busWalkKm = 0.4; // typical walk to/from stops on the corridor
    const busWalkMin = (busWalkKm / city.speeds.walk) * 60;
    const speed = speedFor(city, "bus");
    const ride = rideMinutes(busKm, speed, prefs.peakHours);
    const wait = city.speeds.busAvgWaitMin;
    const fare = slabFare(city.busFareSlabsKm, busKm);
    options.push({
      id: oid("bus", legIndex),
      mode: "bus",
      legIndex,
      summary: `~${formatKm(busKm)} by bus`,
      durationMin: {
        low: ride.low + wait * 0.6 + busWalkMin,
        high: ride.high + wait * 1.6 + busWalkMin,
      },
      price: { low: fare, high: Math.round(fare * 1.6), surgeProne: false },
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
          geometry: road.geometry,
        },
      ],
      bookingUrl: bookingFor("bus", from, to)?.url,
      bookingLabel: bookingFor("bus", from, to)?.label,
      notes: [
        "Indicative — assumes a direct bus exists on this corridor; check live routes",
        "Women residents of Telangana ride free on Ordinary/Express (Mahalakshmi scheme)",
      ],
      roadGeometry: road.fromOsrm,
    });
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

function modeKindOf(mode: ModeId): RouteStep["kind"] {
  if (mode === "uber-go" || mode === "rapido-cab") return "cab";
  if (mode === "uber-moto" || mode === "rapido-bike") return "bike";
  if (mode === "bus") return "bus";
  if (mode === "metro") return "metro";
  if (mode === "walk") return "walk";
  return "auto";
}

function buildMetroOption(
  city: CityConfig,
  from: Place,
  to: Place,
  legIndex: number,
  prefs: TripPreferences,
): RouteOption | null {
  const net = city.metro!;
  const entries = nearestStations(net, from.lngLat, 2);
  const exits = nearestStations(net, to.lngLat, 2);
  if (!entries.length || !exits.length) return null;
  // The user's walk tolerance also bounds each station access walk.
  const stationWalkMax = Math.min(STATION_WALK_MAX_KM, prefs.maxWalkKm);

  // Try the nearest pair combinations, keep the best total time.
  let best: {
    ride: NonNullable<ReturnType<typeof metroRide>>;
    entryKm: number;
    exitKm: number;
  } | null = null;

  // Score = ride time + access/egress at walking pace + a transfer-aversion
  // penalty (beyond the interchange time itself) — prefers the direct line
  // even when a transfer-route station is slightly closer.
  const walkMinPerKm = 60 / city.speeds.walk;
  const score = (ride: NonNullable<ReturnType<typeof metroRide>>, eKm: number, xKm: number) =>
    ride.durationMin + (eKm + xKm) * walkMinPerKm + ride.transfers * 6;

  let bestScore = Infinity;
  for (const e of entries) {
    for (const x of exits) {
      if (e.station.id === x.station.id) continue;
      const ride = metroRide(net, e.station.id, x.station.id);
      if (!ride) continue;
      const s = score(ride, e.km, x.km);
      if (s < bestScore) {
        bestScore = s;
        best = { ride, entryKm: e.km, exitKm: x.km };
      }
    }
  }
  if (!best) return null;
  const { ride, entryKm, exitKm } = best;

  // Metro only makes sense if the ride is a meaningful part of the journey:
  // not for sub-km hops (walk/auto dominate and a 1-stop ride trivially
  // passes a ratio test), and not when most of the trip is access/egress.
  const crowKm = haversineKm(from.lngLat, to.lngLat);
  if (crowKm < 1 || ride.distanceKm < 1 || ride.distanceKm < crowKm * 0.45) return null;

  const steps: RouteStep[] = [];
  const notes: string[] = [];
  let priceLow = ride.fare;
  let priceHigh = ride.fare;
  let walkTotal = 0;

  // Access leg
  const access = accessLeg(city, from.lngLat, ride.entry.lngLat, entryKm, `${ride.entry.name} Metro`, stationWalkMax);
  steps.push(access.step);
  priceLow += access.price.low;
  priceHigh += access.price.high;
  walkTotal += access.walkKm;

  // Platform wait
  steps.push({
    kind: "wait",
    label: "Ticket + platform wait",
    distanceKm: 0,
    durationMin: net.avgWaitMin,
    geometry: [],
  });

  // Ride segments (colored per line), with interchanges as explicit steps
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

  // Egress leg — the walk budget is per whole leg, so spend what the
  // access walk left over (an auto hop takes over past the remainder).
  const egressWalkMax = Math.max(0, Math.min(stationWalkMax, prefs.maxWalkKm - access.walkKm));
  const egress = accessLeg(city, ride.exit.lngLat, to.lngLat, exitKm, to.name, egressWalkMax);
  steps.push(egress.step);
  priceLow += egress.price.low;
  priceHigh += egress.price.high;
  walkTotal += egress.walkKm;

  const rideMin = ride.durationMin + net.avgWaitMin;
  const low = rideMin + access.durationMin.low + egress.durationMin.low;
  const high = rideMin * 1.1 + access.durationMin.high + egress.durationMin.high;

  const booking = bookingFor("metro", from, to);
  notes.push(`Metro fare ₹${ride.fare} · trains ${net.firstTrain}–${net.lastTrain}`);

  return {
    id: oid("metro", legIndex),
    mode: "metro",
    legIndex,
    summary: `${ride.entry.name} → ${ride.exit.name}`,
    durationMin: { low, high },
    price: {
      low: Math.round(priceLow),
      high: Math.round(priceHigh),
      // The metro fare is fixed, but an auto access/egress leg is not.
      surgeProne: access.price.surgeProne || egress.price.surgeProne,
    },
    distanceKm: ride.distanceKm + entryKm + exitKm,
    walkKm: walkTotal,
    transfers: ride.transfers,
    steps,
    bookingUrl: booking?.url,
    bookingLabel: booking?.label,
    notes,
    roadGeometry: true,
  };
}

/** Walk if close, otherwise a short auto hop — the first/last-mile reality. */
function accessLeg(
  city: CityConfig,
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
    const mins = (walkKm / city.speeds.walk) * 60;
    return {
      step: {
        kind: "walk",
        label: `Walk to ${destLabel}`,
        detail: formatKm(walkKm),
        distanceKm: walkKm,
        durationMin: mins,
        geometry: straightLine(from, to),
      },
      price: { low: 0, high: 0, surgeProne: false },
      durationMin: { low: mins, high: mins * 1.2 },
      walkKm,
    };
  }
  // Short auto hop
  const autoCard = city.fareCards.find((c) => c.mode === "rapido-auto") ?? city.fareCards.find((c) => c.mode === "auto");
  const roadKm = crowKm * city.speeds.detourIndex;
  const mins = (roadKm / ((city.speeds.auto[0] + city.speeds.auto[1]) / 2)) * 60 + 3;
  const price = autoCard
    ? estimateFare(autoCard, roadKm, mins)
    : { low: 30, high: 60, surgeProne: true };
  return {
    step: {
      kind: "auto",
      label: `Auto to ${destLabel}`,
      detail: formatKm(roadKm),
      distanceKm: roadKm,
      durationMin: mins,
      geometry: straightLine(from, to),
    },
    price,
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

/** Rupee-equivalent cost of an option: money + time valued at the user's rate. */
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
