import type { Place } from "./types";

/**
 * Ride-platform registry: branding + the best available hand-off link.
 *
 * Only Uber and Lyft publicly document coordinate-prefilled links; for
 * everyone else the honest hand-off is opening their app/site. Fare
 * estimation never depends on these — they are exits, not data sources.
 */

export interface Provider {
  id: string;
  label: string;
  /** deep link with pickup/drop pre-filled, when the platform supports one */
  deepLink?: (from: Place, to: Place) => string;
  /** fallback: app / site URL */
  url: string;
}

function uberLink(from: Place, to: Place): string {
  const p = new URLSearchParams({
    action: "setPickup",
    "pickup[latitude]": String(from.lngLat[1]),
    "pickup[longitude]": String(from.lngLat[0]),
    "pickup[nickname]": from.name,
    "dropoff[latitude]": String(to.lngLat[1]),
    "dropoff[longitude]": String(to.lngLat[0]),
    "dropoff[nickname]": to.name,
  });
  return `https://m.uber.com/ul/?${p.toString()}`;
}

function lyftLink(from: Place, to: Place): string {
  const p = new URLSearchParams({
    id: "lyft",
    "pickup[latitude]": String(from.lngLat[1]),
    "pickup[longitude]": String(from.lngLat[0]),
    "destination[latitude]": String(to.lngLat[1]),
    "destination[longitude]": String(to.lngLat[0]),
  });
  return `https://lyft.com/ride?${p.toString()}`;
}

/** Yandex Go / Yango documented deep link via AppMetrica redirect. */
function yandexGoLink(from: Place, to: Place): string {
  const p = new URLSearchParams({
    "start-lat": String(from.lngLat[1]),
    "start-lon": String(from.lngLat[0]),
    "end-lat": String(to.lngLat[1]),
    "end-lon": String(to.lngLat[0]),
    tariffClass: "econom",
    ref: "marg",
    appmetrica_tracking_id: "1178268795219780156",
  });
  return `https://3.redirect.appmetrica.yandex.com/route?${p.toString()}`;
}

export const PROVIDERS: Record<string, Provider> = {
  uber: { id: "uber", label: "Uber", deepLink: uberLink, url: "https://m.uber.com" },
  lyft: { id: "lyft", label: "Lyft", deepLink: lyftLink, url: "https://ride.lyft.com" },
  yandex: { id: "yandex", label: "Yandex Go", deepLink: yandexGoLink, url: "https://go.yandex" },
  bolt: { id: "bolt", label: "Bolt", url: "https://bolt.eu" },
  grab: { id: "grab", label: "Grab", url: "https://www.grab.com" },
  gojek: { id: "gojek", label: "Gojek", url: "https://www.gojek.com" },
  ola: { id: "ola", label: "Ola", url: "https://www.olacabs.com" },
  rapido: { id: "rapido", label: "Rapido", url: "https://rapido.bike" },
  indrive: { id: "indrive", label: "inDrive", url: "https://indrive.com" },
  careem: { id: "careem", label: "Careem", url: "https://www.careem.com" },
  didi: { id: "didi", label: "DiDi", url: "https://web.didiglobal.com" },
  d99: { id: "d99", label: "99", url: "https://99app.com" },
  yango: { id: "yango", label: "Yango", url: "https://yango.com" },
  freenow: { id: "freenow", label: "FREE NOW", url: "https://www.free-now.com" },
  cabify: { id: "cabify", label: "Cabify", url: "https://cabify.com" },
  pathao: { id: "pathao", label: "Pathao", url: "https://pathao.com" },
  pickme: { id: "pickme", label: "PickMe", url: "https://pickme.lk" },
  bykea: { id: "bykea", label: "Bykea", url: "https://bykea.com" },
  angkas: { id: "angkas", label: "Angkas", url: "https://angkas.com" },
  kakao: { id: "kakao", label: "Kakao T", url: "https://www.kakaomobility.com" },
  gojp: { id: "gojp", label: "GO", url: "https://go.goinc.jp" },
  be: { id: "be", label: "Be", url: "https://be.com.vn" },
  xanhsm: { id: "xanhsm", label: "Xanh SM", url: "https://www.xanhsm.com" },
  lime: { id: "lime", label: "Lime", url: "https://www.li.me" },
};

export function providerHandoff(
  providerId: string | undefined,
  from: Place,
  to: Place,
): { url: string; label: string } | undefined {
  if (!providerId) return undefined;
  const p = PROVIDERS[providerId];
  if (!p) return undefined;
  if (p.deepLink) return { url: p.deepLink(from, to), label: `Open in ${p.label}` };
  return { url: p.url, label: `Open ${p.label}` };
}

/** Google Maps directions — the universal fallback that works everywhere. */
export function googleMapsLink(
  from: Place,
  to: Place,
  mode: "transit" | "walking" | "driving" | "bicycling" = "transit",
): string {
  const p = new URLSearchParams({
    api: "1",
    origin: `${from.lngLat[1]},${from.lngLat[0]}`,
    destination: `${to.lngLat[1]},${to.lngLat[0]}`,
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}
