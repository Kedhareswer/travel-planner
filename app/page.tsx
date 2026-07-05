"use client";

import { useMemo } from "react";
import {
  ChevronDown,
  Loader2,
  Navigation,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { LegPlans } from "@/components/planner/leg-plans";
import { PlaceSearch } from "@/components/planner/place-search";
import { PrefsPanel } from "@/components/planner/prefs-panel";
import { StopList } from "@/components/planner/stop-list";
import { TripMap } from "@/components/planner/trip-map";
import { TripSummary } from "@/components/planner/trip-summary";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTripPlanner } from "@/hooks/use-trip-planner";
import { HYDERABAD } from "@/data/hyderabad";

export default function Home() {
  const city = HYDERABAD;
  const planner = useTripPlanner(city);

  const demo = useMemo(
    () => ({
      from: city.places.find((p) => p.name === "Ameerpet"),
      to: city.places.find((p) => p.name === "Secunderabad Railway Station"),
    }),
    [city],
  );

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
        <Navigation className="size-5" />
        <h1 className="text-base font-semibold tracking-tight">Marg</h1>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {city.name}
        </Badge>
        <span className="text-muted-foreground hidden text-xs md:block">
          Compare metro · bus · auto · cab · bike for every leg of your trip
        </span>
        <div className="ml-auto flex items-center gap-1">
          {planner.planning && (
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        {/* Sidebar */}
        <aside className="flex max-h-[60dvh] min-h-0 w-full shrink-0 flex-col border-t md:max-h-none md:w-105 md:border-t-0 md:border-r">
          <div className="shrink-0 space-y-2.5 p-3">
            <PlaceSearch
              city={city}
              onSelect={planner.addStop}
              placeholder={
                planner.stops.length === 0
                  ? "Where are you starting from?"
                  : "Add the next stop…"
              }
            />
            <StopList
              stops={planner.stops}
              onRemove={planner.removeStop}
              onMove={planner.moveStop}
              onClear={planner.clearStops}
              onOptimize={planner.optimizeOrder}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {planner.stops.length < 2 ? (
              <EmptyState
                onDemo={
                  demo.from && demo.to
                    ? () => {
                        planner.clearStops();
                        planner.addStop({ ...demo.from!, source: "local" });
                        planner.addStop({ ...demo.to!, source: "local" });
                      }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-4">
                {planner.totals && <TripSummary totals={planner.totals} />}

                <Collapsible>
                  <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex w-full items-center justify-between text-xs font-medium tracking-wide uppercase">
                    Preferences
                    <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <PrefsPanel prefs={planner.prefs} onChange={planner.setPrefs} />
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                <LegPlans
                  plans={planner.plans}
                  planning={planner.planning}
                  prefs={planner.prefs}
                  selected={planner.selected}
                  onSelect={planner.selectOption}
                />

                <p className="text-muted-foreground flex items-start gap-1.5 text-[11px] leading-snug">
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                  All prices and times are estimates from published fare cards and
                  typical traffic — not live quotes. * marks surge-prone fares.
                  Check the operator app for the real price before you ride. Not
                  affiliated with Uber, Rapido, HMRL or TSRTC.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Map */}
        <main className="min-h-[40dvh] flex-1 md:min-h-0">
          <TripMap
            city={city}
            stops={planner.stops}
            selectedOptions={planner.selectedOptions}
          />
        </main>
      </div>
    </div>
  );
}

function EmptyState({ onDemo }: { onDemo?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <Navigation className="text-muted-foreground size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Plan a trip across the city</p>
        <p className="text-muted-foreground mx-auto max-w-60 text-xs">
          Add two or more stops and compare metro, bus, auto, cab and bike-taxi
          options by price and time.
        </p>
      </div>
      {onDemo && (
        <Button variant="outline" size="sm" onClick={onDemo}>
          Try Ameerpet → Secunderabad
        </Button>
      )}
    </div>
  );
}
