"use client";

import { MoveRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cheapestOf, fastestOf, generalizedCost } from "@/lib/planner";
import type { LegPlan, RegionProfile, TripPreferences } from "@/lib/types";
import { OptionCard } from "./option-card";

/** All legs with their mode options; one option selectable per leg. */
export function LegPlans({
  plans,
  planning,
  region,
  prefs,
  selected,
  onSelect,
}: {
  plans: LegPlan[];
  planning: boolean;
  region: RegionProfile;
  prefs: TripPreferences;
  selected: Record<number, string>;
  onSelect: (legIndex: number, optionId: string) => void;
}) {
  if (planning && !plans.length) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {plans.map((leg) => {
        const best = [...leg.options].sort(
          (a, b) => generalizedCost(a, prefs) - generalizedCost(b, prefs),
        )[0];
        const fastest = fastestOf(leg.options);
        const cheapest = cheapestOf(leg.options);

        return (
          <section key={leg.legIndex} aria-label={`Leg ${leg.legIndex + 1}`}>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
              <span className="bg-primary text-primary-foreground flex size-4.5 items-center justify-center rounded-full text-[10px]">
                {String.fromCharCode(65 + leg.legIndex)}
              </span>
              <span className="max-w-[38%] truncate">{leg.from.name}</span>
              <MoveRight className="text-muted-foreground size-3.5 shrink-0" />
              <span className="bg-primary text-primary-foreground flex size-4.5 items-center justify-center rounded-full text-[10px]">
                {String.fromCharCode(66 + leg.legIndex)}
              </span>
              <span className="max-w-[38%] truncate">{leg.to.name}</span>
            </h3>

            <div className="space-y-1.5">
              {leg.options.map((option) => {
                const badges: string[] = [];
                if (option.id === best?.id) badges.push("Best");
                if (option.id === fastest?.id) badges.push("Fastest");
                if (option.id === cheapest?.id && option.price.high > 0) badges.push("Cheapest");
                if (option.price.high === 0) badges.push("Free");
                return (
                  <OptionCard
                    key={option.id}
                    option={option}
                    region={region}
                    selected={selected[leg.legIndex] === option.id}
                    badges={badges}
                    onSelect={() => onSelect(leg.legIndex, option.id)}
                  />
                );
              })}
              {!leg.options.length && (
                <p className="text-muted-foreground text-sm">
                  No options for this leg — try re-enabling some modes or a
                  longer max walk in Preferences.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
