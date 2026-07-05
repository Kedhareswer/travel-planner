import type { FareCard } from "./types";

/**
 * Distance/time-based fare estimation from configurable fare cards.
 *
 * Reality check: no ride platform anywhere exposes a public price API
 * anymore — every comparison product either has a private partnership or
 * estimates from fare knowledge, like we do here. That's why results are
 * bands, not numbers. Currency is attached by the caller from the region.
 */
export function estimateFare(
  card: FareCard,
  distanceKm: number,
  durationMin: number,
): { low: number; high: number; surgeProne: boolean } {
  const extraKm = Math.max(0, distanceKm - card.baseKm);
  let fare = card.baseFare + extraKm * card.perKm;
  if (card.perMin) fare += durationMin * card.perMin;
  fare = Math.max(fare, card.minFare);

  // The minimum fare is a hard floor — platforms never quote below it,
  // so the uncertainty band only widens the estimate upward past it.
  return {
    low: Math.max(card.minFare, fare * card.band[0]),
    high: fare * card.band[1],
    surgeProne: card.surgeProne,
  };
}

/** Slab lookup used by stage-fare systems: [maxKm, fare][] ascending. */
export function slabFare(slabs: [number, number][], km: number): number {
  for (const [maxKm, fare] of slabs) {
    if (km <= maxKm) return fare;
  }
  return slabs[slabs.length - 1][1];
}
