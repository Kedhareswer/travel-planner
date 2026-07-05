"use client";

import { useCallback, useRef, useState } from "react";
import {
  ChevronDown,
  Globe2,
  Loader2,
  LocateFixed,
  Navigation,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { reversePlace } from "@/lib/places";
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
import type { Place } from "@/lib/types";

/** One-tap sample trips showing the quality tiers around the world. */
const SAMPLES: { label: string; stops: Omit<Place, "source">[] }[] = [
  {
    label: "Ameerpet → Secunderabad",
    stops: [
      { id: "s-amp", name: "Ameerpet", area: "Hyderabad", lngLat: [78.4483, 17.4375], countryCode: "in" },
      { id: "s-sec", name: "Secunderabad Railway Station", area: "Hyderabad", lngLat: [78.501, 17.434], countryCode: "in" },
    ],
  },
  {
    label: "Camden → Greenwich (London)",
    stops: [
      { id: "s-cam", name: "Camden Town", area: "London", lngLat: [-0.1426, 51.5392], countryCode: "gb" },
      { id: "s-grw", name: "Greenwich", area: "London", lngLat: [-0.0098, 51.4816], countryCode: "gb" },
    ],
  },
  {
    label: "Williamsburg → SoHo (NYC)",
    stops: [
      { id: "s-wbg", name: "Williamsburg", area: "Brooklyn, New York", lngLat: [-73.9573, 40.7081], countryCode: "us" },
      { id: "s-soho", name: "SoHo", area: "Manhattan, New York", lngLat: [-74.0019, 40.7233], countryCode: "us" },
    ],
  },
];

export default function Home() {
  const planner = useTripPlanner();
  const { region, addStop, stops } = planner;
  const [locating, setLocating] = useState(false);

  // Search bias, freshest first: the trip's last stop, else wherever the
  // map is currently looking (a ref so panning doesn't re-render the page).
  const mapCenterRef = useRef<[number, number] | undefined>(undefined);
  const getSearchBias = useCallback(
    () => stops[stops.length - 1]?.lngLat ?? mapCenterRef.current,
    [stops],
  );

  const loadSample = (stops: Omit<Place, "source">[]) => {
    planner.clearStops();
    for (const s of stops) planner.addStop({ ...s, source: "local" });
  };

  const useMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast.error("Location isn't available in this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const place = await reversePlace([pos.coords.longitude, pos.coords.latitude]);
        addStop(place);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow it in your browser settings"
            : "Couldn't get your location",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [addStop]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
        <Navigation className="size-5" />
        <h1 className="text-base font-semibold tracking-tight">Marg</h1>
        <Badge variant="secondary" className="hidden gap-1 sm:inline-flex">
          <Globe2 className="size-3" />
          {planner.stops.length ? region.name : "Anywhere"}
        </Badge>
        <span className="text-muted-foreground hidden text-xs md:block">
          Compare every way to get there — transit, cabs, bikes — anywhere
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
            <div className="flex gap-1.5">
              <div className="min-w-0 flex-1">
                <PlaceSearch
                  getBias={getSearchBias}
                  onSelect={planner.addStop}
                  placeholder={
                    planner.stops.length === 0
                      ? "Where are you starting from?"
                      : "Add the next stop…"
                  }
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={useMyLocation}
                disabled={locating}
                aria-label="Add my current location as a stop"
                title="Use my current location"
              >
                {locating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LocateFixed className="size-4" />
                )}
              </Button>
            </div>
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
              <EmptyState onSample={loadSample} onUseLocation={useMyLocation} />
            ) : (
              <div className="space-y-4">
                {region.tier === "default" && (
                  <p className="text-muted-foreground flex items-start gap-1.5 rounded-md border border-dashed px-2.5 py-2 text-xs">
                    <Globe2 className="mt-0.5 size-3.5 shrink-0" />
                    No local fare table for this country yet — road fares are
                    rough international estimates in USD. Transit uses live
                    open data where available.
                  </p>
                )}

                {planner.totals && (
                  <div className="bg-background/95 sticky top-0 z-10 -mx-1 px-1 pb-1 backdrop-blur-sm">
                    <TripSummary totals={planner.totals} region={region} />
                  </div>
                )}

                <Collapsible>
                  <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex w-full items-center justify-between text-xs font-medium tracking-wide uppercase">
                    Preferences
                    <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <PrefsPanel
                      region={region}
                      prefs={planner.prefs}
                      onChange={planner.setPrefs}
                    />
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                <LegPlans
                  plans={planner.plans}
                  planning={planner.planning}
                  region={region}
                  prefs={planner.prefs}
                  selected={planner.selected}
                  onSelect={planner.selectOption}
                />

                <p className="text-muted-foreground flex items-start gap-1.5 text-[11px] leading-snug">
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                  Prices and times are estimates, not live quotes — * marks
                  surge-prone fares. Check the operator app before you ride.
                  Not affiliated with any operator. Maps & transit data ©{" "}
                  <a
                    className="underline underline-offset-2"
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    OpenStreetMap
                  </a>{" "}
                  contributors, scheduled transit via{" "}
                  <a
                    className="underline underline-offset-2"
                    href="https://transitous.org/sources/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Transitous
                  </a>
                  .
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Map */}
        <main className="min-h-[40dvh] flex-1 md:min-h-0">
          <TripMap
            region={region}
            stops={planner.stops}
            selectedOptions={planner.selectedOptions}
            onCenterChange={(c) => (mapCenterRef.current = c)}
          />
        </main>
      </div>
    </div>
  );
}

function EmptyState({
  onSample,
  onUseLocation,
}: {
  onSample: (stops: Omit<Place, "source">[]) => void;
  onUseLocation: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <Navigation className="text-muted-foreground size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Plan a trip — anywhere on Earth</p>
        <p className="text-muted-foreground mx-auto max-w-64 text-xs">
          Add two or more stops and compare metro, bus, train, cabs, autos and
          bike taxis by price and time, in the local currency.
        </p>
      </div>
      <Button size="sm" onClick={onUseLocation} className="gap-1.5">
        <LocateFixed className="size-3.5" />
        Start from my location
      </Button>
      <div className="flex flex-col gap-1.5">
        {SAMPLES.map((s) => (
          <Button
            key={s.label}
            variant="outline"
            size="sm"
            onClick={() => onSample(s.stops)}
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
