import type { CityConfig, MetroStation } from "@/lib/types";

/**
 * Hyderabad city dataset.
 *
 * Station/place coordinates are curated approximations (good to a few hundred
 * meters — enough for walk-distance and fare-slab estimates, not navigation).
 * Fares follow published fare cards and the Dec 2024 HMRL fare revision;
 * they are estimates and drift with time — see the in-app disclaimer.
 */

const st = (
  id: string,
  name: string,
  lat: number,
  lng: number,
  lines: string[],
): MetroStation => ({ id, name, lngLat: [lng, lat], lines });

/* ------------------------------ Metro network ---------------------------- */

// Station coordinates from the official HMRL GTFS (June 2022 open-data release).
const STATIONS: MetroStation[] = [
  // Red Line — Corridor I: Miyapur → LB Nagar
  st("miyapur", "Miyapur", 17.496545, 78.373026, ["red"]),
  st("jntu", "JNTU College", 17.498704, 78.388867, ["red"]),
  st("kphb", "KPHB Colony", 17.49376, 78.401826, ["red"]),
  st("kukatpally", "Kukatpally", 17.484903, 78.41179, ["red"]),
  st("balanagar", "Balanagar", 17.476746, 78.422108, ["red"]),
  st("moosapet", "Moosapet", 17.471885, 78.426118, ["red"]),
  st("bharatnagar", "Bharat Nagar", 17.462909, 78.430536, ["red"]),
  st("erragadda", "Erragadda", 17.457049, 78.433581, ["red"]),
  st("esi", "ESI Hospital", 17.448697, 78.437628, ["red"]),
  st("srnagar", "S.R. Nagar", 17.44312, 78.440724, ["red"]),
  st("ameerpet", "Ameerpet", 17.435721, 78.444793, ["red", "blue"]),
  st("punjagutta", "Punjagutta", 17.428936, 78.450955, ["red"]),
  st("erramanzil", "Erra Manzil", 17.420229, 78.456349, ["red"]),
  st("khairatabad", "Khairatabad", 17.411632, 78.460868, ["red"]),
  st("lakdikapul", "Lakdi-ka-pul", 17.404043, 78.464944, ["red"]),
  st("assembly", "Assembly", 17.397991, 78.47088, ["red"]),
  st("nampally", "Nampally", 17.392222, 78.470161, ["red"]),
  st("gandhibhavan", "Gandhi Bhavan", 17.385825, 78.473335, ["red"]),
  st("omc", "Osmania Medical College", 17.382077, 78.481701, ["red"]),
  st("mgbs", "MG Bus Station", 17.379789, 78.486157, ["red", "green"]),
  st("malakpet", "Malakpet", 17.377189, 78.493936, ["red"]),
  st("newmarket", "New Market", 17.373445, 78.503179, ["red"]),
  st("musarambagh", "Musarambagh", 17.371087, 78.511955, ["red"]),
  st("dilsukhnagar", "Dilsukhnagar", 17.368549, 78.525387, ["red"]),
  st("chaitanyapuri", "Chaitanyapuri", 17.36815, 78.538134, ["red"]),
  st("victoriamemorial", "Victoria Memorial", 17.361856, 78.543962, ["red"]),
  st("lbnagar", "LB Nagar", 17.349846, 78.547941, ["red"]),

  // Blue Line — Corridor III: Nagole → Raidurg
  st("nagole", "Nagole", 17.390768, 78.558822, ["blue"]),
  st("uppal", "Uppal", 17.400067, 78.560187, ["blue"]),
  st("stadium", "Stadium", 17.4074, 78.554253, ["blue"]),
  st("ngri", "NGRI", 17.414826, 78.546335, ["blue"]),
  st("habsiguda", "Habsiguda", 17.42018, 78.540548, ["blue"]),
  st("tarnaka", "Tarnaka", 17.427442, 78.530008, ["blue"]),
  st("mettuguda", "Mettuguda", 17.435521, 78.519575, ["blue"]),
  st("secunderabadeast", "Secunderabad East", 17.435718, 78.505462, ["blue"]),
  st("paradeground", "Parade Ground", 17.443194, 78.497469, ["blue", "green"]),
  st("paradise", "Paradise", 17.443467, 78.486244, ["blue"]),
  st("rasoolpura", "Rasoolpura", 17.443612, 78.476405, ["blue"]),
  st("prakashnagar", "Prakash Nagar", 17.444889, 78.465875, ["blue"]),
  st("begumpet", "Begumpet", 17.437566, 78.456934, ["blue"]),
  st("madhuranagar", "Madhura Nagar", 17.436965, 78.439099, ["blue"]),
  st("yusufguda", "Yusufguda", 17.435113, 78.427322, ["blue"]),
  st("roadno5", "Road No. 5 Jubilee Hills", 17.430049, 78.423207, ["blue"]),
  st("jhcheckpost", "Jubilee Hills Check Post", 17.428197, 78.413714, ["blue"]),
  st("peddammagudi", "Peddamma Gudi", 17.430651, 78.408372, ["blue"]),
  st("madhapurst", "Madhapur", 17.437264, 78.400426, ["blue"]),
  st("durgamcheruvu", "Durgam Cheruvu", 17.442947, 78.387572, ["blue"]),
  st("hiteccity", "Hitec City", 17.449005, 78.383138, ["blue"]),
  st("raidurg", "Raidurg", 17.4422, 78.3772, ["blue"]),

  // Green Line — Corridor II: JBS → MG Bus Station
  st("jbs", "JBS (Jubilee Bus Station)", 17.448753, 78.496483, ["green"]),
  st("secunderabadwest", "Secunderabad West", 17.433803, 78.499518, ["green"]),
  st("gandhihospital", "Gandhi Hospital", 17.425515, 78.501956, ["green"]),
  st("musheerabad", "Musheerabad", 17.417874, 78.499505, ["green"]),
  st("rtcxroads", "RTC X Roads", 17.407032, 78.496802, ["green"]),
  st("chikkadpally", "Chikkadpally", 17.400363, 78.494896, ["green"]),
  st("narayanguda", "Narayanguda", 17.394366, 78.489958, ["green"]),
  st("sultanbazar", "Sultan Bazaar", 17.384447, 78.484024, ["green"]),
];

export const HYDERABAD: CityConfig = {
  id: "hyderabad",
  name: "Hyderabad",
  center: [78.4772, 17.4065],
  bbox: [78.24, 17.2, 78.72, 17.62],

  metro: {
    lines: [
      {
        id: "red",
        name: "Red Line",
        color: "#e11d48",
        stations: [
          "miyapur", "jntu", "kphb", "kukatpally", "balanagar", "moosapet",
          "bharatnagar", "erragadda", "esi", "srnagar", "ameerpet",
          "punjagutta", "erramanzil", "khairatabad", "lakdikapul",
          "assembly", "nampally", "gandhibhavan", "omc", "mgbs", "malakpet",
          "newmarket", "musarambagh", "dilsukhnagar", "chaitanyapuri",
          "victoriamemorial", "lbnagar",
        ],
      },
      {
        id: "blue",
        name: "Blue Line",
        color: "#2563eb",
        stations: [
          "nagole", "uppal", "stadium", "ngri", "habsiguda", "tarnaka",
          "mettuguda", "secunderabadeast", "paradeground", "paradise",
          "rasoolpura", "prakashnagar", "begumpet", "ameerpet",
          "madhuranagar", "yusufguda", "roadno5", "jhcheckpost",
          "peddammagudi", "madhapurst", "durgamcheruvu", "hiteccity",
          "raidurg",
        ],
      },
      {
        id: "green",
        name: "Green Line",
        color: "#16a34a",
        stations: [
          "jbs", "paradeground", "secunderabadwest", "gandhihospital",
          "musheerabad", "rtcxroads", "chikkadpally", "narayanguda",
          "sultanbazar", "mgbs",
        ],
      },
    ],
    stations: Object.fromEntries(STATIONS.map((s) => [s.id, s])),
    // HMRL distance slabs effective 24 May 2025 — [maxKm, fare INR]
    fareSlabsKm: [
      [2, 11],
      [4, 17],
      [6, 28],
      [9, 37],
      [12, 47],
      [15, 51],
      [18, 56],
      [21, 61],
      [24, 65],
      [999, 69],
    ],
    commercialSpeedKmh: 33,
    avgWaitMin: 5, // peak headway ~4-6 min, off-peak 8-15 (Green Line sparser)
    interchangePenaltyMin: 4,
    firstTrain: "06:00",
    lastTrain: "23:00",
  },

  /*
   * Heuristic fare cards calibrated to observed Hyderabad app fares (2025-26).
   * None of Uber/Rapido/Ola expose a public estimates API anymore, so like
   * every fare-comparison product these are fare-card estimates, not quotes.
   * Surge is legally bounded to 2× base by the MV Aggregator Guidelines 2025;
   * typical observed peak/rain surge is 1.2-1.8×.
   */
  fareCards: [
    {
      mode: "uber-go",
      baseFare: 42,
      baseKm: 2,
      perKm: 10.5,
      perMin: 0.8,
      minFare: 60,
      band: [0.9, 1.3],
      surgeProne: true,
    },
    {
      mode: "uber-auto",
      baseFare: 26,
      baseKm: 1.5,
      perKm: 12,
      perMin: 0.5,
      minFare: 40,
      band: [0.9, 1.3],
      surgeProne: true,
    },
    {
      mode: "uber-moto",
      baseFare: 18,
      baseKm: 1.5,
      perKm: 8,
      perMin: 0.4,
      minFare: 27,
      band: [0.9, 1.3],
      surgeProne: true,
    },
    {
      mode: "rapido-bike",
      baseFare: 20,
      baseKm: 1.6,
      perKm: 9.5,
      minFare: 30,
      band: [0.9, 1.25],
      surgeProne: true,
    },
    {
      mode: "rapido-auto",
      baseFare: 30,
      baseKm: 1.5,
      perKm: 14,
      minFare: 35,
      band: [0.9, 1.25],
      surgeProne: true,
    },
    {
      mode: "rapido-cab",
      baseFare: 45,
      baseKm: 2,
      perKm: 15,
      perMin: 1,
      minFare: 60,
      band: [0.9, 1.3],
      surgeProne: true,
    },
    {
      mode: "auto",
      baseFare: 20,
      baseKm: 1.6,
      perKm: 11,
      minFare: 20,
      band: [1.2, 2.2],
      surgeProne: false,
      notes: [
        "Official meter (₹20 first 1.6 km + ₹11/km, unrevised since 2014) — street autos usually quote well above it; 1.5× after 11 PM",
      ],
    },
  ],

  // Speeds from TomTom Traffic Index 2025 (car peak 16.1 / off-peak 18.4 km/h)
  // and IRC 103-2012 walking speed; [peak, off-peak] km/h.
  speeds: {
    walk: 4.3,
    bike: [19, 25],
    auto: [14, 18],
    car: [15, 21],
    bus: [11, 16],
    detourIndex: 1.35, // mean road/crow circuity; higher across the lake/rail yards
    busAvgWaitMin: 8,
  },

  // TSRTC city slabs — [maxKm, fare INR], blended Ordinary/Metro Express
  // (Ordinary min ₹10 covers ~10 km; Express min ₹15; city max ~₹30-40)
  busFareSlabsKm: [
    [6, 10],
    [10, 15],
    [16, 20],
    [22, 30],
    [999, 35],
  ],

  places: [
    { id: "hyd-ameerpet", name: "Ameerpet", area: "Hyderabad", lngLat: [78.4483, 17.4375] },
    { id: "hyd-secunderabad", name: "Secunderabad Railway Station", area: "Secunderabad", lngLat: [78.501, 17.434] },
    { id: "hyd-hitec", name: "Hitec City", area: "Madhapur", lngLat: [78.3818, 17.4504] },
    { id: "hyd-gachibowli", name: "Gachibowli", area: "Hyderabad", lngLat: [78.3489, 17.4401] },
    { id: "hyd-kondapur", name: "Kondapur", area: "Hyderabad", lngLat: [78.3591, 17.4593] },
    { id: "hyd-madhapur", name: "Madhapur", area: "Hyderabad", lngLat: [78.3915, 17.4483] },
    { id: "hyd-jubileehills", name: "Jubilee Hills", area: "Hyderabad", lngLat: [78.41, 17.431] },
    { id: "hyd-banjarahills", name: "Banjara Hills", area: "Hyderabad", lngLat: [78.435, 17.416] },
    { id: "hyd-kukatpally", name: "Kukatpally", area: "Hyderabad", lngLat: [78.407, 17.484] },
    { id: "hyd-kphb", name: "KPHB Colony", area: "Kukatpally", lngLat: [78.399, 17.49] },
    { id: "hyd-miyapur", name: "Miyapur", area: "Hyderabad", lngLat: [78.3717, 17.4966] },
    { id: "hyd-dilsukhnagar", name: "Dilsukhnagar", area: "Hyderabad", lngLat: [78.5242, 17.3687] },
    { id: "hyd-lbnagar", name: "LB Nagar", area: "Hyderabad", lngLat: [78.5513, 17.3498] },
    { id: "hyd-uppal", name: "Uppal", area: "Hyderabad", lngLat: [78.5595, 17.402] },
    { id: "hyd-tarnaka", name: "Tarnaka", area: "Secunderabad", lngLat: [78.5286, 17.4276] },
    { id: "hyd-charminar", name: "Charminar", area: "Old City", lngLat: [78.4747, 17.3616] },
    { id: "hyd-golconda", name: "Golconda Fort", area: "Hyderabad", lngLat: [78.4011, 17.3833] },
    { id: "hyd-tankbund", name: "Tank Bund", area: "Hussain Sagar", lngLat: [78.4738, 17.4239] },
    { id: "hyd-necklace", name: "Necklace Road", area: "Hussain Sagar", lngLat: [78.4665, 17.4238] },
    { id: "hyd-nampally", name: "Nampally Railway Station", area: "Hyderabad", lngLat: [78.469, 17.3925] },
    { id: "hyd-koti", name: "Koti", area: "Hyderabad", lngLat: [78.4867, 17.385] },
    { id: "hyd-abids", name: "Abids", area: "Hyderabad", lngLat: [78.4756, 17.3903] },
    { id: "hyd-himayatnagar", name: "Himayatnagar", area: "Hyderabad", lngLat: [78.482, 17.4028] },
    { id: "hyd-lakdikapul", name: "Lakdi-ka-pul", area: "Hyderabad", lngLat: [78.4665, 17.4058] },
    { id: "hyd-mehdipatnam", name: "Mehdipatnam", area: "Hyderabad", lngLat: [78.437, 17.3945] },
    { id: "hyd-tolichowki", name: "Tolichowki", area: "Hyderabad", lngLat: [78.413, 17.401] },
    { id: "hyd-manikonda", name: "Manikonda", area: "Hyderabad", lngLat: [78.386, 17.404] },
    { id: "hyd-financialdistrict", name: "Financial District", area: "Nanakramguda", lngLat: [78.341, 17.416] },
    { id: "hyd-kokapet", name: "Kokapet", area: "Hyderabad", lngLat: [78.332, 17.394] },
    { id: "hyd-airport", name: "RGIA Airport (Shamshabad)", area: "Shamshabad", lngLat: [78.4294, 17.2403] },
    { id: "hyd-paradise", name: "Paradise Circle", area: "Secunderabad", lngLat: [78.4848, 17.4425] },
    { id: "hyd-punjagutta", name: "Punjagutta", area: "Hyderabad", lngLat: [78.452, 17.4283] },
    { id: "hyd-somajiguda", name: "Somajiguda", area: "Hyderabad", lngLat: [78.461, 17.426] },
    { id: "hyd-khairatabad", name: "Khairatabad", area: "Hyderabad", lngLat: [78.463, 17.411] },
    { id: "hyd-begumpet", name: "Begumpet", area: "Hyderabad", lngLat: [78.466, 17.444] },
    { id: "hyd-malakpet", name: "Malakpet", area: "Hyderabad", lngLat: [78.4938, 17.3743] },
    { id: "hyd-falaknuma", name: "Falaknuma Palace", area: "Old City", lngLat: [78.4676, 17.3316] },
    { id: "hyd-salarjung", name: "Salar Jung Museum", area: "Old City", lngLat: [78.4804, 17.3714] },
    { id: "hyd-birlamandir", name: "Birla Mandir", area: "Hyderabad", lngLat: [78.4691, 17.4062] },
    { id: "hyd-jntu", name: "JNTU Kukatpally", area: "Kukatpally", lngLat: [78.3915, 17.4933] },
    { id: "hyd-isb", name: "ISB Hyderabad", area: "Gachibowli", lngLat: [78.3404, 17.4347] },
    { id: "hyd-hcu", name: "University of Hyderabad (HCU)", area: "Gachibowli", lngLat: [78.3341, 17.4574] },
    { id: "hyd-shilparamam", name: "Shilparamam", area: "Hitec City", lngLat: [78.38, 17.4526] },
    { id: "hyd-inorbit", name: "Inorbit Mall", area: "Madhapur", lngLat: [78.3867, 17.4348] },
    { id: "hyd-sarathcity", name: "Sarath City Capital Mall", area: "Kondapur", lngLat: [78.363, 17.4571] },
    { id: "hyd-ikea", name: "IKEA Hyderabad", area: "Hitec City", lngLat: [78.3853, 17.4412] },
    { id: "hyd-durgamcheruvu", name: "Durgam Cheruvu", area: "Madhapur", lngLat: [78.3892, 17.4322] },
    { id: "hyd-ou", name: "Osmania University", area: "Hyderabad", lngLat: [78.5288, 17.4126] },
    { id: "hyd-ecil", name: "ECIL X Roads", area: "Secunderabad", lngLat: [78.5654, 17.4735] },
    { id: "hyd-alwal", name: "Alwal", area: "Secunderabad", lngLat: [78.508, 17.504] },
    { id: "hyd-bowenpally", name: "Bowenpally", area: "Secunderabad", lngLat: [78.488, 17.475] },
    { id: "hyd-erragadda", name: "Erragadda", area: "Hyderabad", lngLat: [78.4351, 17.4529] },
    { id: "hyd-srnagar", name: "S.R. Nagar", area: "Hyderabad", lngLat: [78.4442, 17.4415] },
    { id: "hyd-moosapet", name: "Moosapet", area: "Hyderabad", lngLat: [78.4241, 17.4682] },
    { id: "hyd-chandanagar", name: "Chandanagar", area: "Hyderabad", lngLat: [78.3306, 17.4932] },
    { id: "hyd-lingampally", name: "Lingampally", area: "Hyderabad", lngLat: [78.3182, 17.4938] },
    { id: "hyd-attapur", name: "Attapur", area: "Hyderabad", lngLat: [78.4353, 17.3672] },
    { id: "hyd-basheerbagh", name: "Basheerbagh", area: "Hyderabad", lngLat: [78.4767, 17.3998] },
    { id: "hyd-rtcxroads", name: "RTC X Roads", area: "Hyderabad", lngLat: [78.488, 17.4137] },
    { id: "hyd-ramoji", name: "Ramoji Film City", area: "Abdullahpurmet", lngLat: [78.6808, 17.2543] },
  ],
};

export const CITIES: CityConfig[] = [HYDERABAD];
