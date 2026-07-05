"use client";

import { ArrowDown, ArrowUp, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Place } from "@/lib/types";

/** Ordered stops with reorder / remove / auto-optimize controls. */
export function StopList({
  stops,
  onRemove,
  onMove,
  onClear,
  onOptimize,
}: {
  stops: Place[];
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onClear: () => void;
  onOptimize: () => void;
}) {
  if (!stops.length) return null;

  return (
    <div className="space-y-1">
      <ol className="space-y-1">
        {stops.map((stop, i) => (
          <li
            key={`${stop.id}-${i}`}
            className="group bg-card flex items-center gap-2 rounded-md border px-2 py-1.5"
          >
            <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{stop.name}</span>
              {stop.area && (
                <span className="text-muted-foreground block truncate text-xs">
                  {stop.area}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center opacity-40 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
                aria-label={`Move ${stop.name} up`}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                disabled={i === stops.length - 1}
                onClick={() => onMove(i, 1)}
                aria-label={`Move ${stop.name} down`}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${stop.name}`}
              >
                <X className="size-3.5" />
              </Button>
            </span>
          </li>
        ))}
      </ol>

      {stops.length >= 2 && (
        <div className="flex items-center gap-1.5 pt-1">
          {stops.length >= 4 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onOptimize} className="h-7 gap-1.5 text-xs">
                  <Sparkles className="size-3.5" />
                  Best order
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Reorder middle stops to minimize total travel (start & end stay fixed)
              </TooltipContent>
            </Tooltip>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground h-7 gap-1.5 text-xs"
          >
            <Trash2 className="size-3.5" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
