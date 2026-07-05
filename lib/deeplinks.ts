import type { ModeId, Place } from "./types";

/**
 * Hand-off links. None of the Indian ride platforms expose a public
 * price-estimate API anymore, but all of them accept (or tolerate)
 * pre-filled pickup/drop deep links — so the honest flow is:
 * estimate locally, book on the platform.
 */

/** Uber universal link with pre-filled pickup & drop. Works on web + app. */
export function uberDeepLink(from: Place, to: Place): string {
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

/**
 * Rapido has no public web-booking deep link with coordinates;
 * the best hand-off is opening the app / install page.
 */
export function rapidoLink(): string {
  return "https://rapido.bike/";
}

/** Google Maps directions in a specific travel mode — best transit hand-off. */
export function googleMapsLink(
  from: Place,
  to: Place,
  mode: "transit" | "walking" | "driving" | "two_wheeler" = "transit",
): string {
  const p = new URLSearchParams({
    api: "1",
    origin: `${from.lngLat[1]},${from.lngLat[0]}`,
    destination: `${to.lngLat[1]},${to.lngLat[0]}`,
    travelmode: mode === "two_wheeler" ? "driving" : mode,
  });
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

export function bookingFor(mode: ModeId, from: Place, to: Place): { url: string; label: string } | undefined {
  switch (mode) {
    case "uber-go":
    case "uber-auto":
    case "uber-moto":
      return { url: uberDeepLink(from, to), label: "Open in Uber" };
    case "rapido-bike":
    case "rapido-auto":
    case "rapido-cab":
      return { url: rapidoLink(), label: "Open Rapido" };
    case "metro":
    case "bus":
      return { url: googleMapsLink(from, to, "transit"), label: "Transit directions" };
    case "walk":
      return { url: googleMapsLink(from, to, "walking"), label: "Walking directions" };
    case "auto":
      return undefined; // street-hail — nothing to open
  }
}
