/**
 * Core domain types for the multimodal intra-city trip planner.
 *
 * The planner works on a list of Places (stops). For every consecutive pair
 * of stops (a Leg), it computes RouteOptions — one per viable mode — each
 * with a time estimate, a price band, and drawable geometry.
 */

export type LngLat = [number, number]; // [longitude, latitude] — MapLibre order

export interface Place {
  id: string;
  name: string;
  /** Secondary line, e.g. locality / city */
  area?: string;
  lngLat: LngLat;
  /** Where this place came from — curated dataset or live geocoder */
  source: "local" | "photon";
}

/** Travel modes the planner can compare. */
export type ModeId =
  | "walk"
  | "metro"
  | "bus"
  | "auto" // street-hailed auto rickshaw (meter)
  | "uber-go" // hatchback cab
  | "uber-auto"
  | "uber-moto" // bike taxi
  | "rapido-bike"
  | "rapido-auto"
  | "rapido-cab";

export type ModeKind = "walk" | "metro" | "bus" | "auto" | "cab" | "bike";

export interface ModeMeta {
  id: ModeId;
  label: string;
  kind: ModeKind;
  provider?: "uber" | "rapido" | "street" | "public";
  /** Accent color used for map polylines and badges */
  color: string;
}

/** A price band in INR. Estimates are ranges, never a false-precision number. */
export interface PriceBand {
  low: number;
  high: number;
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
  mode: ModeId;
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
  /** Caveats surfaced to the user (e.g. "fares revised Dec 2024", "peak surge likely") */
  notes: string[];
  /** True when road geometry came from OSRM; false = heuristic straight-line estimate */
  roadGeometry: boolean;
}

/** All options for one leg, plus the picks. */
export interface LegPlan {
  from: Place;
  to: Place;
  legIndex: number;
  options: RouteOption[];
  /** ids of the Pareto-optimal options (no other option is both cheaper and faster) */
  paretoIds: string[];
}

export interface TripPreferences {
  /** Rupees the user assigns to one hour of their time; drives "best" ranking */
  valueOfTimePerHour: number;
  /** Max walk the user tolerates for a whole leg, km */
  maxWalkKm: number;
  /** Peak traffic changes road speeds & surge likelihood */
  peakHours: boolean;
  /** Modes the user wants excluded */
  excludedModes: ModeId[];
}

export interface TripPlan {
  legs: LegPlan[];
  /** Chosen option id per leg (defaults to "best") */
  selected: Record<number, string>;
}

/* ------------------------------ City config ------------------------------ */

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
  /** fare by number of km ridden — [maxKm, fareINR] slabs, ascending */
  fareSlabsKm: [number, number][];
  /** average commercial speed incl. stops, km/h */
  commercialSpeedKmh: number;
  /** typical wait = headway / 2, minutes */
  avgWaitMin: number;
  /** minutes lost per interchange */
  interchangePenaltyMin: number;
  firstTrain: string;
  lastTrain: string;
}

/** Distance-based fare card for road modes. */
export interface FareCard {
  mode: ModeId;
  baseFare: number; // includes baseKm
  baseKm: number;
  perKm: number;
  perMin?: number; // time component, if the platform charges one
  minFare: number;
  /** multiplier band applied on top (demand pricing uncertainty) */
  band: [number, number];
  surgeProne: boolean;
  notes?: string[];
}

export interface SpeedModel {
  /** km/h by mode kind, [peak, offPeak] */
  walk: number;
  bike: [number, number];
  auto: [number, number];
  car: [number, number];
  bus: [number, number];
  /** ratio of road distance to straight-line distance when OSRM is unavailable */
  detourIndex: number;
  busAvgWaitMin: number;
}

export interface CityConfig {
  id: string;
  name: string;
  center: LngLat;
  /** rough bounding box [west, south, east, north] used to bias geocoding */
  bbox: [number, number, number, number];
  metro?: MetroNetwork;
  fareCards: FareCard[];
  speeds: SpeedModel;
  /** curated searchable places for instant, offline-friendly autocomplete */
  places: Omit<Place, "source">[];
  /** bus fare slabs [maxKm, fareINR], ascending — city ordinary buses */
  busFareSlabsKm: [number, number][];
}
