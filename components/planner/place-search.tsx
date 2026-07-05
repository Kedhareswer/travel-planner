"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchLocal, searchPlaces } from "@/lib/places";
import type { LngLat, Place } from "@/lib/types";

/**
 * Global place autocomplete: instant curated results, the whole world via
 * the geocoder, biased toward the trip so far. Plain listbox (no portal)
 * so it works inside any layout.
 */
export function PlaceSearch({
  bias,
  onSelect,
  placeholder = "Search any place, anywhere…",
  autoFocus,
}: {
  /** bias results toward here (e.g. the previous stop) */
  bias?: LngLat;
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
  const listId = useId();

  const localResults = useMemo(() => searchLocal(query), [query]);
  const results = merged?.q === query ? merged.places : localResults;
  const busy = Boolean(query.trim().length >= 3 && merged?.q !== query);
  // Clamp against async result-list shrinkage.
  const hi = results.length ? Math.min(highlight, results.length - 1) : -1;
  const listOpen = open && Boolean(query.trim());

  useEffect(() => {
    if (query.trim().length < 3) return;
    const run = ++seq.current;
    const t = setTimeout(async () => {
      const places = await searchPlaces(query, bias);
      if (run !== seq.current) return;
      setMerged({ q: query, places });
    }, 250);
    return () => clearTimeout(t);
  }, [bias, query]);

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
              if (!listOpen) setOpen(true);
              else setHighlight(Math.min(hi + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight(Math.max(hi - 1, 0));
            } else if (e.key === "Enter") {
              if (listOpen && hi >= 0 && results[hi]) {
                e.preventDefault();
                pick(results[hi]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="pl-8"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-activedescendant={
            listOpen && hi >= 0 ? `${listId}-opt-${hi}` : undefined
          }
          aria-autocomplete="list"
        />
        {busy && (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {listOpen && (
        <ul
          id={listId}
          role="listbox"
          className="bg-popover text-popover-foreground absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border p-1 shadow-md"
        >
          {results.length === 0 && !busy && (
            <li className="text-muted-foreground px-2 py-3 text-center text-sm">
              No places found
            </li>
          )}
          {results.map((place, i) => (
            <li
              key={place.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === hi}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(place)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  i === hi && "bg-accent text-accent-foreground",
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
