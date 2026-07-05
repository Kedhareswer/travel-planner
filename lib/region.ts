import { CURATED_PACKS, COUNTRY_PROFILES, DEFAULT_REGION } from "@/data/regions";
import type { Place, RegionProfile } from "./types";

/**
 * Region resolution — "where is this trip happening?"
 *
 *   1. Every stop inside a curated city pack's bbox  -> the pack
 *   2. A known country code among the stops          -> country profile
 *   3. Otherwise                                     -> global default (USD)
 *
 * Places from the geocoder carry ISO country codes; curated places carry
 * their pack's code. Mixed-country trips resolve to the first stop's
 * country (cross-border legs still plan — with that country's pricing).
 */
export function resolveRegion(stops: Place[]): RegionProfile {
  if (!stops.length) return DEFAULT_REGION;

  for (const pack of CURATED_PACKS) {
    const [w, s, e, n] = pack.bbox!;
    const allInside = stops.every(
      (p) =>
        p.lngLat[0] >= w && p.lngLat[0] <= e && p.lngLat[1] >= s && p.lngLat[1] <= n,
    );
    if (allInside) return pack;
  }

  const cc = stops.find((p) => p.countryCode)?.countryCode?.toLowerCase();
  if (cc && COUNTRY_PROFILES[cc]) return COUNTRY_PROFILES[cc];

  return DEFAULT_REGION;
}

/** Format a money amount in the region's currency, no false precision. */
export function formatMoney(amount: number, region: RegionProfile): string {
  const rounded = roundSensibly(amount, region.currency);
  try {
    return new Intl.NumberFormat(region.locale, {
      style: "currency",
      currency: region.currency,
      maximumFractionDigits: fractionDigits(rounded, region.currency),
    }).format(rounded);
  } catch {
    return `${region.currency} ${rounded}`;
  }
}

export function formatMoneyRange(
  low: number,
  high: number,
  region: RegionProfile,
): string {
  if (low === 0 && high === 0) return "Free";
  const l = roundSensibly(low, region.currency);
  const h = roundSensibly(high, region.currency);
  if (l === h) return formatMoney(l, region);
  // "₹103–144", "$12–18" — one symbol, compact
  const hi = new Intl.NumberFormat(region.locale, {
    maximumFractionDigits: fractionDigits(h, region.currency),
  }).format(h);
  return `${formatMoney(l, region)}–${hi}`;
}

/** Zero-decimal currencies and big-number currencies round to integers. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "IDR", "VND", "CLP", "ISK", "HUF", "TWD", "COP", "PYG", "LKR", "PKR", "NGN", "KES", "INR", "PHP", "THB", "RUB", "TRY", "MXN", "BRL", "ZAR", "EGP", "AED", "SAR", "CNY", "HKD"]);

function fractionDigits(amount: number, currency: string): number {
  if (ZERO_DECIMAL.has(currency)) return 0;
  return Number.isInteger(amount) ? 0 : 2; // $12 and $4.50, never $12.00
}

function roundSensibly(amount: number, currency: string): number {
  if (ZERO_DECIMAL.has(currency)) {
    if (amount >= 1000) return Math.round(amount / 50) * 50;
    if (amount >= 100) return Math.round(amount / 5) * 5;
    return Math.round(amount);
  }
  return amount >= 20 ? Math.round(amount) : Math.round(amount * 2) / 2;
}
