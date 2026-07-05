"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchLocal, searchPlaces } from "@/lib/places";
import type { CityConfig, Place } from "@/lib/types";

/**
 * Debounced place autocomplete: instant curated results, geocoder for the
 * long tail. Plain listbox (no portal) so it works inside any layout.
 */
export function PlaceSearch({
  city,
  onSelect,
  placeholder = "Search a place or locality…",
  autoFocus,
}: {
  city: CityConfig;
  onSelect: (place: Place) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  // Merged (local + geocoder) results are stored with the query they answer,
  // so what's displayed is a pure derivation and never goes stale.
  const [merged, setMerged] = useState<{ q: string; places: Place[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const seq = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const localResults = useMemo(() => searchLocal(city, query), [city, query]);
  const results = merged?.q === query ? merged.places : localResults;
  const busy = Boolean(query.trim().length >= 3 && merged?.q !== query);

  useEffect(() => {
    if (query.trim().length < 3) return;
    const run = ++seq.current;
    const t = setTimeout(async () => {
      const places = await searchPlaces(city, query);
      if (run !== seq.current) return;
      setMerged({ q: query, places });
    }, 250);
    return () => clearTimeout(t);
  }, [city, query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (place: Place) => {
    onSelect(place);
    setQuery("");
    setMerged(null);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && results[highlight]) {
              e.preventDefault();
              pick(results[highlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="pl-8"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-autocomplete="list"
        />
        {busy && (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {open && query.trim() && (
        <ul
          role="listbox"
          className="bg-popover text-popover-foreground absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border p-1 shadow-md"
        >
          {results.length === 0 && !busy && (
            <li className="text-muted-foreground px-2 py-3 text-center text-sm">
              No places found
            </li>
          )}
          {results.map((place, i) => (
            <li key={place.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(place)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  i === highlight && "bg-accent text-accent-foreground",
                )}
              >
                <MapPin className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{place.name}</span>
                  {place.area && (
                    <span className="text-muted-foreground block truncate text-xs">
                      {place.area}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
