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
import { modeMeta } from "@/lib/modes";
import type { CityConfig, Place, RouteOption } from "@/lib/types";

/**
 * The trip map: numbered stop markers, the selected option's geometry per
 * leg (colored by mode, metro segments in line colors, walks dashed), and
 * metro stations as subtle dots for orientation.
 */
export function TripMap({
  city,
  stops,
  selectedOptions,
}: {
  city: CityConfig;
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

  useEffect(() => {
    if (!mapRef.current || allPoints.length < 2) return;
    const [w, s, e, n] = bboxOf(allPoints, 0.004);
    mapRef.current.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 56, maxZoom: 15, duration: 700 },
    );
  }, [allPoints]);

  const metroStations = useMemo(
    () => (city.metro ? Object.values(city.metro.stations) : []),
    [city.metro],
  );

  return (
    <Map ref={mapRef} center={city.center} zoom={11.5} attributionControl={false}>
      <MapControls position="bottom-right" showZoom showLocate />

      {/* Metro stations as subtle orientation dots (only when a metro exists) */}
      {metroStations.map((st) => (
        <MapMarker key={st.id} longitude={st.lngLat[0]} latitude={st.lngLat[1]}>
          <MarkerContent>
            <div className="size-1.5 rounded-full bg-sky-500/50 ring-1 ring-white/60 dark:ring-black/40" />
          </MarkerContent>
          <MarkerTooltip>{st.name} Metro</MarkerTooltip>
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
              color={step.color ?? modeMeta(opt.mode).color}
              width={step.kind === "walk" ? 3 : 4.5}
              opacity={step.kind === "walk" ? 0.7 : 0.85}
              dashArray={step.kind === "walk" ? [1.5, 2] : undefined}
              interactive={false}
            />
          )),
      )}

      {/* Stop markers, numbered A, B, C… */}
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
