import type {
  FareCard,
  ModeKind,
  RegionProfile,
  SpeedModel,
  TransportMode,
} from "@/lib/types";
import { HYDERABAD_PACK } from "./hyderabad";

/**
 * Country transport profiles: which providers operate there, what rides
 * roughly cost (LOCAL currency), how fast traffic moves, and what a
 * transit ride costs. Compiled July 2026 from operator territory lists,
 * regulated tariff tables and fare trackers. Approximate by design —
 * every figure the UI shows is a labeled estimate band, and this file is
 * the one place to re-calibrate a country.
 *
 * Countries without a profile fall back to DEFAULT_REGION (USD bands,
 * clearly marked as rough international estimates). Curated city packs
 * (data/hyderabad.ts) override their country profile entirely.
 *
 * Notes baked into the data:
 *  - SE Asia has no Uber (Grab/Gojek/Bolt); China is DiDi; Russia/CIS is
 *    Yandex Go; Japan/Korea/HK/Turkey are taxi-hail-via-app at meter rates.
 *  - Bid-based platforms (inDrive) ≈ taxi minus 10-20%.
 *  - High-inflation currencies (ARS, TRY, EGP, NGN, PKR) drift fast — bands
 *    are wide and dated 2026-H1.
 */

/* ------------------------------ tiny builders ---------------------------- */

const KIND_COLORS: Record<ModeKind, string> = {
  walk: "#64748b",
  cycle: "#0d9488",
  scooter: "#84cc16",
  metro: "#0ea5e9",
  train: "#6366f1",
  tram: "#14b8a6",
  ferry: "#0284c7",
  bus: "#22c55e",
  auto: "#eab308",
  cab: "#171717",
  bike: "#f43f5e",
};

const PROVIDER_COLORS: Record<string, string> = {
  uber: "#171717",
  lyft: "#ea0b8c",
  bolt: "#34d186",
  grab: "#00b14f",
  gojek: "#00880e",
  ola: "#a3c626",
  rapido: "#f6c410",
  indrive: "#a7e92f",
  careem: "#37c86f",
  didi: "#ff7d41",
  d99: "#ffd329",
  yandex: "#fce000",
  yango: "#f5364a",
  freenow: "#e50040",
  cabify: "#7145d6",
  pathao: "#e0084c",
  pickme: "#ffc20e",
  bykea: "#0ba14a",
  angkas: "#0057ff",
  kakao: "#fee500",
  gojp: "#00479d",
  be: "#ffc805",
  xanhsm: "#00b5ad",
  lime: "#00de00",
};

function fare(
  baseFare: number,
  baseKm: number,
  perKm: number,
  minFare: number,
  opts: Partial<FareCard> = {},
): FareCard {
  return {
    baseFare,
    baseKm,
    perKm,
    minFare,
    band: opts.band ?? [0.9, 1.3],
    surgeProne: opts.surgeProne ?? true,
    perMin: opts.perMin,
    notes: opts.notes,
  };
}

function mode(
  id: string,
  label: string,
  kind: ModeKind,
  fareCard: FareCard,
  provider?: string,
  extra: Partial<Pick<TransportMode, "pickupWaitMin" | "maxKm">> = {},
): TransportMode {
  return {
    id,
    label,
    kind,
    provider,
    color: provider ? (PROVIDER_COLORS[provider] ?? KIND_COLORS[kind]) : KIND_COLORS[kind],
    fare: fareCard,
    pickupWaitMin: extra.pickupWaitMin ?? (kind === "cab" ? [3, 8] : [2, 6]),
    maxKm: extra.maxKm,
  };
}

/** Shared e-scooter: unlock fee + per-minute, sensible only for short hops. */
function scooter(unlock: number, perMin: number): TransportMode {
  return mode(
    "e-scooter",
    "Shared e-scooter",
    "scooter",
    fare(unlock, 0, 0, unlock, { perMin, band: [1, 1.15], surgeProne: false }),
    "lime",
    { pickupWaitMin: [1, 4], maxKm: 6 },
  );
}

function speeds(
  car: [number, number],
  bike: [number, number],
  auto: [number, number],
  bus: [number, number],
  detourIndex = 1.35,
): SpeedModel {
  return {
    walk: 4.5,
    cycle: 13,
    bike,
    auto,
    car,
    bus,
    detourIndex,
    busAvgWaitMin: 8,
  };
}

// Traffic archetypes (car/bike/auto/bus km/h, [peak, offPeak])
const CONGESTED_MEGACITY = speeds([15, 22], [19, 26], [14, 18], [11, 16], 1.4);
const BUSY_ASIAN_CITY = speeds([16, 24], [20, 28], [15, 20], [11, 16], 1.35);
const EUROPEAN_CITY = speeds([16, 25], [20, 27], [16, 25], [12, 17], 1.35);
const NORTH_AMERICAN_CITY = speeds([22, 35], [24, 36], [22, 35], [13, 19], 1.3);

interface CountryOpts {
  name: string;
  currency: string;
  locale: string;
  speeds: SpeedModel;
  roadModes: TransportMode[];
  metroFare: [number, number];
  busFare: [number, number];
  vot: number[]; // presets, local currency / hour
  votDefault: number;
  cycling?: boolean;
  notes?: string[];
}

function country(cc: string, o: CountryOpts): RegionProfile {
  return {
    id: cc,
    name: o.name,
    countryCode: cc,
    currency: o.currency,
    locale: o.locale,
    speeds: o.speeds,
    roadModes: o.roadModes,
    transitFare: { metro: o.metroFare, bus: o.busFare },
    cycling: o.cycling ?? true,
    valueOfTimePresets: o.vot,
    valueOfTimeDefault: o.votDefault,
    tier: "country",
    notes: o.notes,
  };
}

/* ----------------------------- country profiles -------------------------- */

export const COUNTRY_PROFILES: Record<string, RegionProfile> = {
  /* ---------------------------- South Asia ---------------------------- */

  in: country("in", {
    name: "India",
    currency: "INR",
    locale: "en-IN",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("uber-go", "Uber Go", "cab", fare(45, 2, 13, 70, { perMin: 1 }), "uber"),
      mode("ola-mini", "Ola Mini", "cab", fare(45, 2, 13, 70, { perMin: 1 }), "ola"),
      mode("uber-auto", "Uber Auto", "auto", fare(30, 1.5, 12, 40, { perMin: 0.5 }), "uber"),
      mode("rapido-auto", "Rapido Auto", "auto", fare(30, 1.5, 12, 35), "rapido"),
      mode("rapido-bike", "Rapido Bike", "bike", fare(20, 1.6, 5, 30), "rapido"),
      mode("uber-moto", "Uber Moto", "bike", fare(20, 1.5, 5.5, 28), "uber"),
      mode(
        "auto-meter",
        "Auto (meter)",
        "auto",
        fare(28, 1.6, 11, 28, {
          band: [1.1, 2.0],
          surgeProne: false,
          notes: ["Meter rates vary by state and are often negotiated above"],
        }),
      ),
    ],
    metroFare: [11, 65],
    busFare: [10, 40],
    vot: [50, 100, 150, 300, 600],
    votDefault: 150,
  }),

  pk: country("pk", {
    name: "Pakistan",
    currency: "PKR",
    locale: "en-PK",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("indrive", "inDrive (bid)", "cab", fare(100, 1, 70, 280, { band: [0.8, 1.3], notes: ["Bid-based — you negotiate the fare"] }), "indrive"),
      mode("yango", "Yango", "cab", fare(120, 1, 75, 300), "yango"),
      mode("bykea", "Bykea (moto)", "bike", fare(50, 1, 28, 150), "bykea"),
      mode("rickshaw", "Rickshaw", "auto", fare(80, 1, 50, 120, { band: [1, 1.6], surgeProne: false, notes: ["Negotiated fares"] })),
    ],
    metroFare: [30, 50],
    busFare: [50, 120],
    vot: [200, 400, 800, 1500, 3000],
    votDefault: 800,
  }),

  bd: country("bd", {
    name: "Bangladesh",
    currency: "BDT",
    locale: "bn-BD",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("uber-x", "Uber", "cab", fare(80, 1.5, 37, 200, { perMin: 3.5 }), "uber"),
      mode("pathao-car", "Pathao Car", "cab", fare(80, 1.5, 35, 190, { perMin: 3 }), "pathao"),
      mode("pathao-bike", "Pathao Bike", "bike", fare(40, 1, 12, 65), "pathao"),
      mode("cng-auto", "CNG auto", "auto", fare(60, 1, 27, 120, { band: [1, 1.6], surgeProne: false, notes: ["Negotiated fares"] })),
    ],
    metroFare: [20, 100],
    busFare: [10, 50],
    vot: [100, 200, 400, 800, 1500],
    votDefault: 400,
  }),

  lk: country("lk", {
    name: "Sri Lanka",
    currency: "LKR",
    locale: "si-LK",
    speeds: BUSY_ASIAN_CITY,
    roadModes: [
      mode("pickme-mini", "PickMe Mini", "cab", fare(300, 1, 165, 450), "pickme"),
      mode("uber-x", "Uber", "cab", fare(300, 1, 170, 450), "uber"),
      mode("tuk", "Tuk-tuk (app)", "auto", fare(100, 1, 105, 150), "pickme"),
    ],
    metroFare: [30, 200],
    busFare: [30, 150],
    vot: [300, 600, 1200, 2500, 5000],
    votDefault: 1200,
  }),

  /* --------------------------- Southeast Asia -------------------------- */

  id: country("id", {
    name: "Indonesia",
    currency: "IDR",
    locale: "id-ID",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("gojek-ride", "GoRide (moto)", "bike", fare(9500, 4, 2400, 9500), "gojek"),
      mode("grab-bike", "GrabBike", "bike", fare(9000, 4, 2400, 9000), "grab"),
      mode("gojek-car", "GoCar", "cab", fare(11000, 2, 4800, 16000), "gojek"),
      mode("grab-car", "GrabCar", "cab", fare(11000, 2, 4800, 16000), "grab"),
      mode("bluebird", "Blue Bird taxi", "cab", fare(8500, 1, 6000, 25000, { band: [1, 1.3], surgeProne: false })),
    ],
    metroFare: [3000, 14000],
    busFare: [3500, 5000],
    vot: [15000, 30000, 60000, 120000, 250000],
    votDefault: 60000,
  }),

  th: country("th", {
    name: "Thailand",
    currency: "THB",
    locale: "th-TH",
    speeds: BUSY_ASIAN_CITY,
    roadModes: [
      mode("grab-car", "GrabCar", "cab", fare(45, 1, 13, 60, { perMin: 1.5 }), "grab"),
      mode("bolt", "Bolt", "cab", fare(40, 1, 11, 50, { perMin: 1.3 }), "bolt"),
      mode("taxi-meter", "Taxi (meter)", "cab", fare(35, 1, 6.5, 35, { band: [1, 1.3], surgeProne: false })),
      mode("win-moto", "Motorbike taxi (win)", "bike", fare(25, 1, 10, 30), "grab"),
      mode("tuktuk", "Tuk-tuk", "auto", fare(60, 1, 20, 80, { band: [1, 1.8], surgeProne: false, notes: ["Negotiate before boarding — tourist premium is real"] })),
    ],
    metroFare: [17, 62],
    busFare: [8, 25],
    vot: [60, 120, 250, 500, 1000],
    votDefault: 250,
  }),

  vn: country("vn", {
    name: "Vietnam",
    currency: "VND",
    locale: "vi-VN",
    speeds: BUSY_ASIAN_CITY,
    roadModes: [
      mode("grab-bike", "GrabBike", "bike", fare(12500, 2, 5000, 13000), "grab"),
      mode("be-bike", "Be Bike", "bike", fare(12000, 2, 4800, 12000), "be"),
      mode("grab-car", "GrabCar", "cab", fare(28000, 2, 11500, 30000), "grab"),
      mode("xanh-sm", "Xanh SM (EV)", "cab", fare(20000, 2, 15000, 25000, { band: [1, 1.2] }), "xanhsm"),
      mode("taxi-meter", "Taxi (meter)", "cab", fare(17500, 1, 14000, 20000, { band: [1, 1.25], surgeProne: false })),
    ],
    metroFare: [8000, 20000],
    busFare: [7000, 10000],
    vot: [30000, 60000, 120000, 250000, 500000],
    votDefault: 120000,
  }),

  ph: country("ph", {
    name: "Philippines",
    currency: "PHP",
    locale: "en-PH",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("grab-car", "GrabCar", "cab", fare(50, 1, 16, 120, { perMin: 2 }), "grab"),
      mode("taxi-meter", "Taxi (meter)", "cab", fare(45, 1, 13.5, 60, { perMin: 2, band: [1, 1.3], surgeProne: false })),
      mode("angkas", "Angkas (moto)", "bike", fare(50, 2, 10, 60), "angkas"),
    ],
    metroFare: [13, 45],
    busFare: [13, 40],
    vot: [80, 150, 300, 600, 1200],
    votDefault: 300,
  }),

  my: country("my", {
    name: "Malaysia",
    currency: "MYR",
    locale: "ms-MY",
    speeds: BUSY_ASIAN_CITY,
    roadModes: [
      mode("grab-car", "GrabCar", "cab", fare(3, 1, 1.8, 7, { perMin: 0.2 }), "grab"),
      mode("indrive", "inDrive (bid)", "cab", fare(3, 1, 1.6, 6, { band: [0.8, 1.2], notes: ["Bid-based — you negotiate the fare"] }), "indrive"),
      mode("taxi-budget", "Teksi (meter)", "cab", fare(3, 1, 1.25, 5, { band: [1, 1.5], surgeProne: false, notes: ["+50% midnight-6am"] })),
    ],
    metroFare: [1.2, 6],
    busFare: [1, 3],
    vot: [10, 20, 40, 80, 160],
    votDefault: 40,
  }),

  sg: country("sg", {
    name: "Singapore",
    currency: "SGD",
    locale: "en-SG",
    speeds: speeds([25, 35], [28, 38], [25, 35], [16, 22], 1.3),
    roadModes: [
      mode("grab-car", "GrabCar", "cab", fare(2.5, 1, 0.75, 9, { perMin: 0.2 }), "grab"),
      mode("gojek-car", "Gojek", "cab", fare(2.4, 1, 0.72, 8.5, { perMin: 0.2 }), "gojek"),
      mode("comfort-taxi", "ComfortDelGro taxi", "cab", fare(4.6, 1, 0.68, 8, { band: [1, 1.35], surgeProne: false })),
    ],
    metroFare: [1.2, 2.5],
    busFare: [1.2, 2.2],
    vot: [8, 15, 25, 50, 100],
    votDefault: 25,
  }),

  /* ------------------------------ East Asia ---------------------------- */

  jp: country("jp", {
    name: "Japan",
    currency: "JPY",
    locale: "ja-JP",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("taxi", "Taxi (GO / Uber)", "cab", fare(500, 1.1, 390, 500, { perMin: 15, band: [1, 1.25], surgeProne: false, notes: ["+20% 22:00–05:00"] }), "gojp"),
    ],
    metroFare: [180, 330],
    busFare: [210, 230],
    vot: [1000, 2000, 3500, 6000, 12000],
    votDefault: 3500,
    notes: ["No open ride-hailing — apps hail licensed taxis at meter rates"],
  }),

  kr: country("kr", {
    name: "South Korea",
    currency: "KRW",
    locale: "ko-KR",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("kakao-t", "Kakao T taxi", "cab", fare(4800, 1.6, 760, 4800, { perMin: 100, band: [1, 1.3], surgeProne: false, notes: ["+20–40% 22:00–04:00"] }), "kakao"),
    ],
    metroFare: [1550, 2500],
    busFare: [1500, 1700],
    vot: [8000, 15000, 30000, 60000, 120000],
    votDefault: 30000,
  }),

  cn: country("cn", {
    name: "China",
    currency: "CNY",
    locale: "zh-CN",
    speeds: BUSY_ASIAN_CITY,
    roadModes: [
      mode("didi", "DiDi Express", "cab", fare(11, 2.5, 2.4, 11, { perMin: 0.45 }), "didi"),
      mode("taxi-meter", "Taxi (meter)", "cab", fare(14, 3, 2.5, 14, { band: [1, 1.2], surgeProne: false })),
    ],
    metroFare: [3, 9],
    busFare: [2, 4],
    vot: [20, 40, 80, 150, 300],
    votDefault: 80,
  }),

  hk: country("hk", {
    name: "Hong Kong",
    currency: "HKD",
    locale: "zh-HK",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("taxi-red", "Taxi (urban)", "cab", fare(29, 2, 10, 29, { band: [1, 1.2], surgeProne: false })),
      mode("uber-x", "UberX", "cab", fare(15, 1, 7, 35), "uber"),
    ],
    metroFare: [5, 30],
    busFare: [5, 15],
    vot: [50, 100, 180, 350, 700],
    votDefault: 180,
  }),

  tw: country("tw", {
    name: "Taiwan",
    currency: "TWD",
    locale: "zh-TW",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("taxi", "Taxi / Uber", "cab", fare(85, 1.25, 25, 85, { perMin: 4, band: [1, 1.2], surgeProne: false }), "uber"),
    ],
    metroFare: [20, 65],
    busFare: [15, 30],
    vot: [150, 300, 500, 1000, 2000],
    votDefault: 500,
  }),

  /* --------------------------- Middle East ----------------------------- */

  ae: country("ae", {
    name: "United Arab Emirates",
    currency: "AED",
    locale: "ar-AE",
    speeds: NORTH_AMERICAN_CITY,
    roadModes: [
      mode("careem-go", "Careem GO", "cab", fare(6, 1, 2.1, 13, { perMin: 0.35 }), "careem"),
      mode("uber-x", "UberX", "cab", fare(6, 1, 2.15, 13, { perMin: 0.35 }), "uber"),
      mode("taxi-rta", "Taxi (RTA)", "cab", fare(5, 0, 2.05, 12, { band: [1, 1.2], surgeProne: false })),
    ],
    metroFare: [3, 7.5],
    busFare: [3, 7.5],
    vot: [20, 40, 70, 140, 280],
    votDefault: 70,
  }),

  sa: country("sa", {
    name: "Saudi Arabia",
    currency: "SAR",
    locale: "ar-SA",
    speeds: NORTH_AMERICAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(6, 1, 1.7, 15, { perMin: 0.3 }), "uber"),
      mode("careem-go", "Careem GO", "cab", fare(6, 1, 1.7, 15, { perMin: 0.3 }), "careem"),
    ],
    metroFare: [4, 14],
    busFare: [3, 5],
    vot: [15, 30, 60, 120, 240],
    votDefault: 60,
  }),

  tr: country("tr", {
    name: "Türkiye",
    currency: "TRY",
    locale: "tr-TR",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("taxi-meter", "Taxi (BiTaksi / Uber)", "cab", fare(54, 0, 36, 135, { band: [1, 1.25], surgeProne: false, notes: ["Uber hails metered taxis in Türkiye"] }), "uber"),
    ],
    metroFare: [35, 55],
    busFare: [35, 40],
    vot: [100, 200, 400, 800, 1600],
    votDefault: 400,
    notes: ["High inflation — fares revise often; bands dated mid-2026"],
  }),

  /* ------------------------------ Africa ------------------------------- */

  eg: country("eg", {
    name: "Egypt",
    currency: "EGP",
    locale: "ar-EG",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(13, 1, 4.5, 30, { perMin: 0.75 }), "uber"),
      mode("careem-go", "Careem GO", "cab", fare(13, 1, 4.5, 30, { perMin: 0.7 }), "careem"),
      mode("indrive", "inDrive (bid)", "cab", fare(12, 1, 4, 25, { band: [0.8, 1.3], notes: ["Bid-based — you negotiate the fare"] }), "indrive"),
      mode("taxi-white", "White taxi", "cab", fare(11.5, 1, 3.2, 20, { band: [1, 1.8], surgeProne: false, notes: ["Meters often refused — agree the fare first"] })),
    ],
    metroFare: [8, 20],
    busFare: [5, 15],
    vot: [30, 60, 120, 250, 500],
    votDefault: 120,
    notes: ["High inflation — bands dated mid-2026"],
  }),

  ng: country("ng", {
    name: "Nigeria",
    currency: "NGN",
    locale: "en-NG",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("bolt", "Bolt", "cab", fare(500, 1, 300, 1000, { perMin: 25 }), "bolt"),
      mode("uber-x", "UberX", "cab", fare(550, 1, 320, 1100, { perMin: 25 }), "uber"),
      mode("okada", "Okada (moto)", "bike", fare(150, 1, 200, 300, { band: [1, 1.6], surgeProne: false, notes: ["Banned in core Lagos districts — availability varies"] })),
    ],
    metroFare: [500, 1500],
    busFare: [200, 800],
    vot: [500, 1000, 2000, 4000, 8000],
    votDefault: 2000,
    notes: ["High inflation — bands dated mid-2026"],
  }),

  ke: country("ke", {
    name: "Kenya",
    currency: "KES",
    locale: "en-KE",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(125, 1, 50, 250, { perMin: 5 }), "uber"),
      mode("bolt", "Bolt", "cab", fare(120, 1, 48, 240, { perMin: 5 }), "bolt"),
      mode("boda", "Boda boda (moto)", "bike", fare(80, 1, 28, 120), "bolt"),
    ],
    metroFare: [50, 150],
    busFare: [30, 100],
    vot: [150, 300, 600, 1200, 2500],
    votDefault: 600,
  }),

  za: country("za", {
    name: "South Africa",
    currency: "ZAR",
    locale: "en-ZA",
    speeds: NORTH_AMERICAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(20, 1, 10.5, 40, { perMin: 1.2 }), "uber"),
      mode("bolt", "Bolt", "cab", fare(18, 1, 10, 38, { perMin: 1.1 }), "bolt"),
      mode("taxi-meter", "Metered taxi", "cab", fare(17, 1, 13.5, 40, { band: [1, 1.4], surgeProne: false })),
    ],
    metroFare: [15, 60],
    busFare: [10, 30],
    vot: [40, 80, 150, 300, 600],
    votDefault: 150,
  }),

  /* ------------------------------ Europe ------------------------------- */

  gb: country("gb", {
    name: "United Kingdom",
    currency: "GBP",
    locale: "en-GB",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(2.75, 0, 1.0, 6.5, { perMin: 0.18 }), "uber"),
      mode("bolt", "Bolt", "cab", fare(2.5, 0, 0.95, 6, { perMin: 0.16 }), "bolt"),
      mode("black-cab", "Black cab / taxi", "cab", fare(3.8, 0, 2.1, 8, { band: [1, 1.4], surgeProne: false })),
      scooter(1, 0.2),
    ],
    metroFare: [3, 7],
    busFare: [1.75, 2.5],
    vot: [8, 15, 25, 45, 90],
    votDefault: 25,
  }),

  de: country("de", {
    name: "Germany",
    currency: "EUR",
    locale: "de-DE",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(1.5, 0, 1.25, 7.5, { perMin: 0.3 }), "uber"),
      mode("bolt", "Bolt", "cab", fare(1.4, 0, 1.2, 7, { perMin: 0.28 }), "bolt"),
      mode("freenow", "FREE NOW taxi", "cab", fare(4.5, 0, 2.45, 9, { band: [1, 1.25], surgeProne: false }), "freenow"),
      scooter(1, 0.24),
    ],
    metroFare: [2.6, 3.8],
    busFare: [2.6, 3.8],
    vot: [10, 18, 30, 55, 110],
    votDefault: 30,
  }),

  fr: country("fr", {
    name: "France",
    currency: "EUR",
    locale: "fr-FR",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(2, 0, 1.2, 8, { perMin: 0.3 }), "uber"),
      mode("bolt", "Bolt", "cab", fare(1.8, 0, 1.1, 7.5, { perMin: 0.28 }), "bolt"),
      mode("taxi-paris", "Taxi (meter)", "cab", fare(4.4, 0, 1.5, 8.5, { band: [1, 1.3], surgeProne: false })),
    ],
    metroFare: [2.5, 2.6],
    busFare: [2, 2.2],
    vot: [10, 18, 30, 55, 110],
    votDefault: 30,
    notes: ["Rental e-scooters are banned in Paris (2023)"],
  }),

  es: country("es", {
    name: "Spain",
    currency: "EUR",
    locale: "es-ES",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(1.5, 0, 1.0, 6, { perMin: 0.25 }), "uber"),
      mode("bolt", "Bolt", "cab", fare(1.4, 0, 0.95, 5.5, { perMin: 0.22 }), "bolt"),
      mode("cabify", "Cabify", "cab", fare(1.6, 0, 1.05, 6, { perMin: 0.25 }), "cabify"),
      mode("taxi-meter", "Taxi (meter)", "cab", fare(2.85, 0, 1.45, 5.5, { band: [1, 1.3], surgeProne: false })),
    ],
    metroFare: [1.5, 2],
    busFare: [1.5, 1.7],
    vot: [8, 15, 25, 45, 90],
    votDefault: 25,
  }),

  nl: country("nl", {
    name: "Netherlands",
    currency: "EUR",
    locale: "nl-NL",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(3, 0, 1.75, 10, { perMin: 0.35 }), "uber"),
      mode("bolt", "Bolt", "cab", fare(2.8, 0, 1.6, 9, { perMin: 0.32 }), "bolt"),
      mode("taxi-meter", "Taxi (meter)", "cab", fare(3.95, 0, 2.6, 10, { perMin: 0.47, band: [1, 1.2], surgeProne: false })),
    ],
    metroFare: [2, 3.5],
    busFare: [2, 3.5],
    vot: [10, 18, 30, 55, 110],
    votDefault: 30,
  }),

  pl: country("pl", {
    name: "Poland",
    currency: "PLN",
    locale: "pl-PL",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("bolt", "Bolt", "cab", fare(5, 0, 2.0, 15, { perMin: 0.4 }), "bolt"),
      mode("uber-x", "UberX", "cab", fare(5.5, 0, 2.1, 16, { perMin: 0.42 }), "uber"),
      mode("freenow", "FREE NOW taxi", "cab", fare(8, 0, 3.7, 19, { band: [1, 1.25], surgeProne: false }), "freenow"),
      scooter(3, 0.8),
    ],
    metroFare: [3.4, 4.4],
    busFare: [3.4, 4.4],
    vot: [20, 40, 70, 140, 280],
    votDefault: 70,
  }),

  ru: country("ru", {
    name: "Russia",
    currency: "RUB",
    locale: "ru-RU",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("yandex-econom", "Yandex Go", "cab", fare(150, 1, 45, 350, { band: [0.85, 1.5] }), "yandex"),
    ],
    metroFare: [75, 112],
    busFare: [75, 90],
    vot: [200, 400, 800, 1500, 3000],
    votDefault: 800,
  }),

  /* ------------------------------ Americas ----------------------------- */

  us: country("us", {
    name: "United States",
    currency: "USD",
    locale: "en-US",
    speeds: NORTH_AMERICAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(4, 0, 0.85, 9, { perMin: 0.38 }), "uber"),
      mode("lyft", "Lyft", "cab", fare(4, 0, 0.85, 9, { perMin: 0.38 }), "lyft"),
      mode("taxi", "Taxi (meter)", "cab", fare(3, 0, 2.2, 10, { perMin: 0.5, band: [1, 1.3], surgeProne: false })),
      scooter(1, 0.35),
    ],
    metroFare: [2, 3.5],
    busFare: [1.5, 3],
    vot: [10, 20, 35, 60, 120],
    votDefault: 35,
  }),

  ca: country("ca", {
    name: "Canada",
    currency: "CAD",
    locale: "en-CA",
    speeds: NORTH_AMERICAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(2.75, 0, 0.95, 8.5, { perMin: 0.35 }), "uber"),
      mode("lyft", "Lyft", "cab", fare(2.75, 0, 0.95, 8.5, { perMin: 0.35 }), "lyft"),
      mode("taxi", "Taxi (meter)", "cab", fare(4.25, 0, 1.9, 9, { band: [1, 1.25], surgeProne: false })),
    ],
    metroFare: [3, 4],
    busFare: [3, 3.5],
    vot: [12, 22, 38, 65, 130],
    votDefault: 38,
  }),

  mx: country("mx", {
    name: "Mexico",
    currency: "MXN",
    locale: "es-MX",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(30, 1, 5.5, 50, { perMin: 2.2 }), "uber"),
      mode("didi", "DiDi Express", "cab", fare(28, 1, 5.2, 48, { perMin: 2 }), "didi"),
      mode("didi-moto", "DiDi Moto", "bike", fare(20, 1, 4, 27), "didi"),
      mode("taxi-libre", "Taxi libre", "cab", fare(10, 0, 5, 30, { band: [1, 1.5], surgeProne: false })),
    ],
    metroFare: [5, 7],
    busFare: [2, 8],
    vot: [40, 80, 150, 300, 600],
    votDefault: 150,
  }),

  br: country("br", {
    name: "Brazil",
    currency: "BRL",
    locale: "pt-BR",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(3.75, 0, 1.9, 10, { perMin: 0.35 }), "uber"),
      mode("d99", "99", "cab", fare(3.5, 0, 1.85, 9.5, { perMin: 0.33 }), "d99"),
      mode("moto99", "99Moto / Uber Moto", "bike", fare(3, 0, 1.25, 6), "d99"),
      mode("taxi", "Táxi (meter)", "cab", fare(6.25, 0, 4, 12, { band: [1, 1.35], surgeProne: false })),
    ],
    metroFare: [4.4, 5.4],
    busFare: [4.4, 5.3],
    vot: [15, 30, 50, 100, 200],
    votDefault: 50,
  }),

  ar: country("ar", {
    name: "Argentina",
    currency: "ARS",
    locale: "es-AR",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(1500, 1, 900, 3700, { band: [0.85, 1.4] }), "uber"),
      mode("didi", "DiDi", "cab", fare(1400, 1, 850, 3500, { band: [0.85, 1.4] }), "didi"),
      mode("taxi-ba", "Taxi (meter)", "cab", fare(1920, 0, 960, 2500, { band: [1, 1.3], surgeProne: false, notes: ["+20% at night"] })),
    ],
    metroFare: [900, 1500],
    busFare: [500, 1000],
    vot: [3000, 6000, 12000, 25000, 50000],
    votDefault: 12000,
    notes: ["Very high inflation — fares revise monthly; bands dated mid-2026"],
  }),

  co: country("co", {
    name: "Colombia",
    currency: "COP",
    locale: "es-CO",
    speeds: CONGESTED_MEGACITY,
    roadModes: [
      mode("didi", "DiDi", "cab", fare(3000, 1, 1400, 7500, { band: [0.85, 1.35] }), "didi"),
      mode("uber-x", "UberX", "cab", fare(3200, 1, 1500, 8000, { band: [0.85, 1.35] }), "uber"),
      mode("indrive", "inDrive (bid)", "cab", fare(2800, 1, 1300, 7000, { band: [0.8, 1.3], notes: ["Bid-based — you negotiate the fare"] }), "indrive"),
      mode("taxi", "Taxi", "cab", fare(4000, 1, 1500, 7000, { band: [1, 1.3], surgeProne: false })),
    ],
    metroFare: [3000, 3500],
    busFare: [3000, 3500],
    vot: [8000, 15000, 30000, 60000, 120000],
    votDefault: 30000,
  }),

  cl: country("cl", {
    name: "Chile",
    currency: "CLP",
    locale: "es-CL",
    speeds: EUROPEAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(700, 1, 600, 2800, { perMin: 125 }), "uber"),
      mode("didi", "DiDi", "cab", fare(650, 1, 570, 2600, { perMin: 115 }), "didi"),
      mode("taxi", "Taxi (meter)", "cab", fare(500, 0, 1050, 2000, { band: [1, 1.3], surgeProne: false })),
    ],
    metroFare: [750, 950],
    busFare: [750, 800],
    vot: [2500, 5000, 9000, 18000, 36000],
    votDefault: 9000,
  }),

  /* ------------------------------ Oceania ------------------------------ */

  au: country("au", {
    name: "Australia",
    currency: "AUD",
    locale: "en-AU",
    speeds: NORTH_AMERICAN_CITY,
    roadModes: [
      mode("uber-x", "UberX", "cab", fare(5, 0, 1.55, 10.5, { perMin: 0.4 }), "uber"),
      mode("didi", "DiDi", "cab", fare(4.5, 0, 1.45, 9.5, { perMin: 0.38 }), "didi"),
      mode("taxi", "Taxi (meter)", "cab", fare(3.6, 0, 2.29, 9, { band: [1, 1.3], surgeProne: false, notes: ["+20% at night"] })),
    ],
    metroFare: [3.8, 9.6],
    busFare: [2.3, 4.9],
    vot: [15, 25, 45, 80, 160],
    votDefault: 45,
  }),
};

/* ------------------------------ global default --------------------------- */

export const DEFAULT_REGION: RegionProfile = {
  id: "default",
  name: "International",
  countryCode: "",
  currency: "USD",
  locale: "en-US",
  speeds: speeds([18, 28], [22, 30], [18, 26], [12, 17], 1.35),
  roadModes: [
    mode(
      "rideshare",
      "Ride-hailing app",
      "cab",
      fare(1.5, 0, 1.0, 5, {
        band: [0.7, 1.6],
        notes: ["No local fare data — rough international estimate in USD"],
      }),
    ),
    mode(
      "taxi",
      "Taxi",
      "cab",
      fare(2.5, 0, 1.5, 6, {
        band: [0.7, 1.8],
        surgeProne: false,
        notes: ["No local fare data — rough international estimate in USD"],
      }),
    ),
  ],
  transitFare: { metro: [0.5, 3], bus: [0.3, 2.5] },
  cycling: true,
  valueOfTimePresets: [5, 10, 20, 40, 80],
  valueOfTimeDefault: 20,
  tier: "default",
  notes: ["No local fare table for this country yet — estimates are rough and in USD"],
};

/** Curated city packs beat country profiles when the whole trip fits inside. */
export const CURATED_PACKS: RegionProfile[] = [HYDERABAD_PACK];
