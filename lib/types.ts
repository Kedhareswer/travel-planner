/**
 * Core domain types for the multimodal trip planner.
 *
 * The planner is region-agnostic: it works on a list of Places (stops)
 * anywhere on Earth. For every consecutive pair of stops (a Leg) it
 * computes RouteOptions — one per transport mode available in the region
 * the stops are in — each with a time estimate, a price band in the local
 * currency, and drawable geometry.
 *
 * Where a mode's data comes from decides its quality tier:
 *   1. curated city packs (e.g. Hyderabad) — hand-checked networks & fares
 *   2. live open data (Transitous scheduled transit, OSM rail networks)
 *   3. country fare tables — heuristic but honest, wide coverage
 *   4. global defaults — the planner never comes up empty
 */

export type LngLat = [number, number]; // [longitude, latitude] — MapLibre order

export interface Place {
  id: string;
  name: string;
  /** Secondary line, e.g. locality / city / country */
  area?: string;
  lngLat: LngLat;
  /** ISO-3166 alpha-2, lowercase, when known — drives region resolution */
  countryCode?: string;
  /** Where this place came from — curated dataset or live geocoder */
  source: "local" | "photon";
}

/** Icon/semantic families; individual modes are open-ended data. */
export type ModeKind =
  | "walk"
  | "cycle" // own bicycle
  | "scooter" // shared e-scooter
  | "metro"
  | "train"
  | "tram"
  | "ferry"
  | "bus"
  | "auto" // auto-rickshaw / tuk-tuk / bajaj
  | "cab" // taxi & rideshare cars
  | "bike"; // motorcycle taxi

/** Distance/time-based fare card, in the region's local currency. */
export interface FareCard {
  baseFare: number; // includes baseKm
  baseKm: number;
  perKm: number;
  perMin?: number; // time component, if the operator charges one
  minFare: number;
  /** multiplier band applied on top (demand-pricing uncertainty) */
  band: [number, number];
  surgeProne: boolean;
  notes?: string[];
}

/**
 * One bookable/usable transport mode in a region — an open catalog entry,
 * not a closed enum: "uber-go", "grab-bike", "black-cab", "boda-boda"…
 */
export interface TransportMode {
  id: string;
  label: string;
  kind: ModeKind;
  /** provider id from lib/providers.ts, for deep links & branding */
  provider?: string;
  /** Accent color used for map polylines and badges */
  color: string;
  fare: FareCard;
  /** wait-for-pickup band, minutes [low, high] */
  pickupWaitMin?: [number, number];
  /** don't offer beyond this distance (e.g. shared e-scooters) */
  maxKm?: number;
}

/** A price band. Estimates are ranges, never a false-precision number. */
export interface PriceBand {
  low: number;
  high: number;
  /** ISO-4217 code the amounts are in */
  currency: string;
  /** true when surge/night charges could push beyond `high` */
  surgeProne: boolean;
}

/** One drawable step of a route option (e.g. "walk to station", "ride metro"). */
export interface RouteStep {
  kind: ModeKind | "wait" | "transfer";
  label: string;
  detail?: string;
  distanceKm: number;
  durationMin: number;
  geometry: LngLat[];
  /** Line color override (e.g. metro line color) */
  color?: string;
}

/** A complete way to travel one leg (stop i -> stop i+1). */
export interface RouteOption {
  id: string;
  /** catalog mode id, or a synthetic id for transit itineraries */
  mode: string;
  label: string;
  kind: ModeKind;
  color: string;
  legIndex: number;
  summary: string;
  durationMin: { low: number; high: number };
  price: PriceBand;
  distanceKm: number;
  walkKm: number;
  transfers: number;
  steps: RouteStep[];
  /** Deep link to book / open directions externally */
  bookingUrl?: string;
  bookingLabel?: string;
  /** Caveats surfaced to the user */
  notes: string[];
  /** "curated" | "live" | "estimated" — how trustworthy the data is */
  dataTier: "curated" | "live" | "estimated";
}

/** All options for one leg, plus the Pareto set. */
export interface LegPlan {
  from: Place;
  to: Place;
  legIndex: number;
  options: RouteOption[];
  /** ids of the Pareto-optimal options (no other option is both cheaper and faster) */
  paretoIds: string[];
}

export interface TripPreferences {
  /** Local-currency value of one hour of the user's time; drives "best" ranking */
  valueOfTimePerHour: number;
  /** Max walk the user tolerates for a whole leg, km */
  maxWalkKm: number;
  /** Peak traffic changes road speeds & surge likelihood */
  peakHours: boolean;
  /** Mode ids (or kinds) the user wants excluded */
  excludedModes: string[];
}

/* ------------------------------ Transit data ----------------------------- */

export interface MetroStation {
  id: string;
  name: string;
  lngLat: LngLat;
  /** line ids this station belongs to; >1 = interchange */
  lines: string[];
}

export interface MetroLine {
  id: string;
  name: string;
  color: string;
  /** ordered station ids from terminus to terminus */
  stations: string[];
}

export interface MetroNetwork {
  lines: MetroLine[];
  stations: Record<string, MetroStation>;
  /** fare by km ridden — [maxKm, fare] slabs ascending; null = use region band */
  fareSlabsKm: [number, number][] | null;
  /** average commercial speed incl. stops, km/h */
  commercialSpeedKmh: number;
  /** typical wait = headway / 2, minutes */
  avgWaitMin: number;
  /** minutes lost per interchange */
  interchangePenaltyMin: number;
  firstTrain?: string;
  lastTrain?: string;
}

/* ------------------------------ Region model ----------------------------- */

export interface SpeedModel {
  /** km/h by mode kind, [peak, offPeak] where banded */
  walk: number;
  cycle: number;
  bike: [number, number];
  auto: [number, number];
  car: [number, number];
  bus: [number, number];
  /** ratio of road distance to straight-line distance when routing is unavailable */
  detourIndex: number;
  busAvgWaitMin: number;
}

/**
 * Everything the planner needs to know about "here".
 * Country profiles cover whole countries; curated city packs override them.
 */
export interface RegionProfile {
  id: string; // "in", "us", "city:hyderabad", "default"
  name: string; // "India", "United States", "Hyderabad"
  /** ISO-3166 alpha-2 lowercase ("" for the global default) */
  countryCode: string;
  currency: string; // ISO 4217
  /** BCP-47 locale used for currency formatting */
  locale: string;
  speeds: SpeedModel;
  /** road modes available here (taxis, rideshare, moto, auto…) */
  roadModes: TransportMode[];
  /** typical single-ride fare bands when no schedule/fare table exists */
  transitFare: { metro: [number, number]; bus: [number, number] };
  /** offer an own-bicycle option */
  cycling: boolean;
  /** presets for the "my time is worth" control, local currency per hour */
  valueOfTimePresets: number[];
  valueOfTimeDefault: number;
  /** data quality: curated packs are hand-checked */
  tier: "curated" | "country" | "default";

  /* -------- curated-pack extras (optional) -------- */
  metro?: MetroNetwork;
  places?: Omit<Place, "source">[];
  /** rough bbox [west, south, east, north] a pack applies to */
  bbox?: [number, number, number, number];
  busFareSlabsKm?: [number, number][];
  notes?: string[];
}
