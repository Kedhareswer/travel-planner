import type { FareCard, PriceBand } from "./types";

/**
 * Distance/time-based fare estimation from configurable fare cards.
 *
 * Reality check: Uber retired public access to its price-estimates API and
 * Rapido/Ola never had one — every comparison app either has a private
 * partnership or estimates from published fare cards, like we do here.
 * That's why results are shown as bands, not exact prices.
 */
export function estimateFare(
  card: FareCard,
  distanceKm: number,
  durationMin: number,
): PriceBand {
  const extraKm = Math.max(0, distanceKm - card.baseKm);
  let fare = card.baseFare + extraKm * card.perKm;
  if (card.perMin) fare += durationMin * card.perMin;
  fare = Math.max(fare, card.minFare);

  // The minimum fare is a hard floor — platforms never quote below it,
  // so the uncertainty band only widens the estimate upward past it.
  return {
    low: Math.round(Math.max(card.minFare, fare * card.band[0])),
    high: Math.round(fare * card.band[1]),
    surgeProne: card.surgeProne,
  };
}

/** Slab lookup used by bus (and any stage-fare system): [maxKm, fare][] ascending. */
export function slabFare(slabs: [number, number][], km: number): number {
  for (const [maxKm, fare] of slabs) {
    if (km <= maxKm) return fare;
  }
  return slabs[slabs.length - 1][1];
}
