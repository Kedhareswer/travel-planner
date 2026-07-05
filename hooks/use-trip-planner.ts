"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultPrefs, generalizedCost, planLeg } from "@/lib/planner";
import { optimizeStopOrder } from "@/lib/optimize";
import { resolveRegion } from "@/lib/region";
import type {
  LegPlan,
  Place,
  RegionProfile,
  RouteOption,
  TripPreferences,
} from "@/lib/types";

interface PlanResult {
  key: string;
  plans: LegPlan[];
}

/** Stable key for one planning input, so results/selections can be derived. */
function planKey(stops: Place[], prefs: TripPreferences, region: RegionProfile): string {
  return JSON.stringify([
    region.id,
    stops.map((s) => [s.id, s.lngLat]),
    prefs.valueOfTimePerHour,
    prefs.maxWalkKm,
    prefs.peakHours,
    [...prefs.excludedModes].sort(),
  ]);
}

/**
 * Owns the whole planning state: stops, the region they resolve to,
 * preferences, computed leg plans and the user's per-leg mode selection.
 */
export function useTripPlanner() {
  const [stops, setStops] = useState<Place[]>([]);
  const region = useMemo(() => resolveRegion(stops), [stops]);

  const [prefs, setPrefsRaw] = useState<TripPreferences>(() => defaultPrefs(region));
  const [result, setResult] = useState<PlanResult | null>(null);
  const [selectedByLeg, setSelectedByLeg] = useState<Record<number, string>>({});
  const runRef = useRef(0);

  // Money means different numbers in different currencies — when the trip
  // moves to a new region, the value-of-time pref resets to its default.
  const regionIdRef = useRef(region.id);
  useEffect(() => {
    if (regionIdRef.current === region.id) return;
    regionIdRef.current = region.id;
    setPrefsRaw((p) => ({
      ...p,
      valueOfTimePerHour: region.valueOfTimeDefault,
      excludedModes: [],
    }));
  }, [region]);

  const key = planKey(stops, prefs, region);
  // Stale-while-revalidate: keep showing the previous plans while a replan
  // is in flight (the header spinner signals staleness).
  const plans = useMemo(
    () => (stops.length >= 2 ? (result?.plans ?? []) : []),
    [stops.length, result],
  );
  const planning = stops.length >= 2 && result?.key !== key;

  useEffect(() => {
    if (stops.length < 2) return;
    const run = ++runRef.current;
    let cancelled = false;
    (async () => {
      const legs = await Promise.all(
        stops.slice(0, -1).map((from, i) => planLeg(region, from, stops[i + 1], i, prefs)),
      );
      if (cancelled || run !== runRef.current) return;
      setResult({ key: planKey(stops, prefs, region), plans: legs });
      // Carry the user's mode choice across replans when possible.
      setSelectedByLeg((prev) => {
        const next: Record<number, string> = {};
        for (const leg of legs) {
          const prevId = prev[leg.legIndex];
          const sameMode = prevId
            ? leg.options.find((o) => modeOf(o.id) === modeOf(prevId))
            : undefined;
          const best = [...leg.options].sort(
            (a, b) => generalizedCost(a, prefs) - generalizedCost(b, prefs),
          )[0];
          next[leg.legIndex] = (sameMode ?? best)?.id ?? "";
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [region, stops, prefs]);

  const setPrefs = useCallback((p: TripPreferences) => setPrefsRaw(p), []);

  const addStop = useCallback((place: Place) => {
    setStops((s) => [...s, place]);
  }, []);

  const removeStop = useCallback((index: number) => {
    setStops((s) => s.filter((_, i) => i !== index));
  }, []);

  const moveStop = useCallback((index: number, dir: -1 | 1) => {
    setStops((s) => {
      const j = index + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }, []);

  const clearStops = useCallback(() => {
    setStops([]);
    // A cleared trip is a new trip — don't show the old plans while the
    // next one computes (stale-while-revalidate is for tweaks, not resets).
    setResult(null);
    setSelectedByLeg({});
  }, []);

  const optimizeOrder = useCallback(() => {
    setStops((s) => optimizeStopOrder(s));
  }, []);

  const selectOption = useCallback((legIndex: number, optionId: string) => {
    setSelectedByLeg((prev) => ({ ...prev, [legIndex]: optionId }));
  }, []);

  const selectedOptions: RouteOption[] = useMemo(
    () =>
      plans
        .map((leg) => leg.options.find((o) => o.id === selectedByLeg[leg.legIndex]))
        .filter((o): o is RouteOption => Boolean(o)),
    [plans, selectedByLeg],
  );

  const totals = useMemo(() => {
    // Only total a complete trip — a leg with no selectable option would
    // silently vanish from the sum and misstate the whole-trip cost/time.
    if (!selectedOptions.length || selectedOptions.length !== plans.length) return null;
    return {
      priceLow: selectedOptions.reduce((n, o) => n + o.price.low, 0),
      priceHigh: selectedOptions.reduce((n, o) => n + o.price.high, 0),
      minLow: selectedOptions.reduce((n, o) => n + o.durationMin.low, 0),
      minHigh: selectedOptions.reduce((n, o) => n + o.durationMin.high, 0),
      walkKm: selectedOptions.reduce((n, o) => n + o.walkKm, 0),
      distanceKm: selectedOptions.reduce((n, o) => n + o.distanceKm, 0),
      surgeProne: selectedOptions.some((o) => o.price.surgeProne),
    };
  }, [selectedOptions, plans.length]);

  return {
    stops,
    region,
    prefs,
    setPrefs,
    plans,
    planning,
    selected: selectedByLeg,
    selectOption,
    selectedOptions,
    totals,
    addStop,
    removeStop,
    moveStop,
    clearStops,
    optimizeOrder,
  };
}

/** Option ids look like `${mode}-${leg}` — extract the mode part. */
function modeOf(id: string): string {
  return id.split("-").slice(0, -1).join("-");
}
