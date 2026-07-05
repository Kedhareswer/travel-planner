"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerTooltip,
  type MapRef,
} from "@/components/ui/map";
import { bboxOf } from "@/lib/geo";
import type { Place, RegionProfile, RouteOption } from "@/lib/types";

/**
 * The trip map: numbered stop markers, the selected option's geometry per
 * leg (colored by mode, transit segments in line colors, walks dashed),
 * and — where a curated network exists — its stations as subtle dots.
 */
export function TripMap({
  region,
  stops,
  selectedOptions,
}: {
  region: RegionProfile;
  stops: Place[];
  selectedOptions: RouteOption[];
}) {
  const mapRef = useRef<MapRef>(null);

  // Everything drawable → fit bounds when it changes.
  const allPoints = useMemo(() => {
    const pts = stops.map((s) => s.lngLat);
    for (const opt of selectedOptions) {
      for (const step of opt.steps) pts.push(...step.geometry);
    }
    return pts;
  }, [stops, selectedOptions]);

  const stopsKey = useMemo(
    () => JSON.stringify(stops.map((s) => s.lngLat)),
    [stops],
  );
  const lastStopsKey = useRef("");

  useEffect(() => {
    if (!mapRef.current || allPoints.length < 2) return;
    // Mid-replan the selection briefly empties; don't refit for that —
    // only when the stops themselves changed or new routes arrived.
    if (stopsKey === lastStopsKey.current && selectedOptions.length === 0) return;
    lastStopsKey.current = stopsKey;
    const [w, s, e, n] = bboxOf(allPoints, 0.004);
    mapRef.current.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 56, maxZoom: 15, duration: 700 },
    );
  }, [allPoints, stopsKey, selectedOptions.length]);

  const curatedStations = useMemo(
    () => (region.metro ? Object.values(region.metro.stations) : []),
    [region.metro],
  );

  return (
    <Map ref={mapRef} center={[20, 12]} zoom={1.6} attributionControl={{ compact: true }}>
      <MapControls position="bottom-right" showZoom showLocate />

      {/* Curated network stations as subtle orientation dots */}
      {curatedStations.map((st) => (
        <MapMarker key={st.id} longitude={st.lngLat[0]} latitude={st.lngLat[1]}>
          <MarkerContent>
            <div className="size-1.5 rounded-full bg-sky-500/50 ring-1 ring-white/60 dark:ring-black/40" />
          </MarkerContent>
          <MarkerTooltip>{st.name}</MarkerTooltip>
        </MapMarker>
      ))}

      {/* Selected option geometry per leg */}
      {selectedOptions.map((opt) =>
        opt.steps
          .filter((step) => step.geometry.length >= 2)
          .map((step, i) => (
            <MapRoute
              key={`${opt.id}-${i}`}
              id={`${opt.id}-${i}`}
              coordinates={step.geometry}
              color={step.color ?? opt.color}
              width={step.kind === "walk" ? 3 : 4.5}
              opacity={step.kind === "walk" ? 0.7 : 0.85}
              dashArray={step.kind === "walk" ? [1.5, 2] : undefined}
              interactive={false}
            />
          )),
      )}

      {/* Stop markers, lettered A, B, C… */}
      {stops.map((stop, i) => (
        <MapMarker
          key={`${stop.id}-${i}`}
          longitude={stop.lngLat[0]}
          latitude={stop.lngLat[1]}
        >
          <MarkerContent>
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow-lg dark:border-neutral-800">
              {String.fromCharCode(65 + i)}
            </div>
          </MarkerContent>
          <MarkerTooltip>{stop.name}</MarkerTooltip>
        </MapMarker>
      ))}
    </Map>
  );
}
