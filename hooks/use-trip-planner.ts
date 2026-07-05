"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generalizedCost, planLeg } from "@/lib/planner";
import { optimizeStopOrder } from "@/lib/optimize";
import type {
  CityConfig,
  LegPlan,
  Place,
  RouteOption,
  TripPreferences,
} from "@/lib/types";
import { DEFAULT_PREFS } from "@/lib/planner";

interface PlanResult {
  key: string;
  plans: LegPlan[];
}

/** Stable key for one planning input, so results/selections can be derived. */
function planKey(stops: Place[], prefs: TripPreferences): string {
  return JSON.stringify([
    stops.map((s) => [s.id, s.lngLat]),
    prefs.valueOfTimePerHour,
    prefs.maxWalkKm,
    prefs.peakHours,
    [...prefs.excludedModes].sort(),
  ]);
}

/**
 * Owns the whole planning state: stops, preferences, computed leg plans
 * and the user's per-leg mode selection. Plans are stored together with
 * the input key they were computed for, so "planning" and the visible
 * plans are pure derivations — no state clearing inside effects.
 */
export function useTripPlanner(city: CityConfig) {
  const [stops, setStops] = useState<Place[]>([]);
  const [prefs, setPrefs] = useState<TripPreferences>(DEFAULT_PREFS);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [selectedByLeg, setSelectedByLeg] = useState<Record<number, string>>({});
  const runRef = useRef(0);

  const key = planKey(stops, prefs);
  const plans = useMemo(
    () => (stops.length >= 2 && result?.key === key ? result.plans : []),
    [stops.length, result, key],
  );
  const planning = stops.length >= 2 && result?.key !== key;

  useEffect(() => {
    if (stops.length < 2) return;
    const run = ++runRef.current;
    let cancelled = false;
    (async () => {
      const legs = await Promise.all(
        stops.slice(0, -1).map((from, i) => planLeg(city, from, stops[i + 1], i, prefs)),
      );
      if (cancelled || run !== runRef.current) return;
      setResult({ key: planKey(stops, prefs), plans: legs });
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
  }, [city, stops, prefs]);

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

  const clearStops = useCallback(() => setStops([]), []);

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
    if (!selectedOptions.length) return null;
    return {
      priceLow: selectedOptions.reduce((n, o) => n + o.price.low, 0),
      priceHigh: selectedOptions.reduce((n, o) => n + o.price.high, 0),
      minLow: selectedOptions.reduce((n, o) => n + o.durationMin.low, 0),
      minHigh: selectedOptions.reduce((n, o) => n + o.durationMin.high, 0),
      walkKm: selectedOptions.reduce((n, o) => n + o.walkKm, 0),
      distanceKm: selectedOptions.reduce((n, o) => n + o.distanceKm, 0),
      surgeProne: selectedOptions.some((o) => o.price.surgeProne),
    };
  }, [selectedOptions]);

  return {
    stops,
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

/** Option ids look like `${mode}-${leg}-${seq}` — extract the mode part. */
function modeOf(id: string): string {
  return id.split("-").slice(0, -2).join("-");
}
