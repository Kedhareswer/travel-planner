"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ExternalLink, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatKm, formatMinRange, formatPrice } from "@/lib/geo";
import { modeMeta } from "@/lib/modes";
import type { RouteOption } from "@/lib/types";
import { ModeIcon } from "./mode-icon";

/** One selectable mode option for a leg, with expandable step details. */
export function OptionCard({
  option,
  selected,
  badges,
  onSelect,
}: {
  option: RouteOption;
  selected: boolean;
  badges: string[];
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = modeMeta(option.mode);

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
      )}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 text-left"
          aria-pressed={selected}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
          >
            <ModeIcon kind={meta.kind} className="size-4" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium">{meta.label}</span>
              {badges.map((b) => (
                <Badge
                  key={b}
                  variant={b === "Best" ? "default" : "secondary"}
                  className="h-4 px-1.5 text-[10px]"
                >
                  {b}
                </Badge>
              ))}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {option.summary}
              {option.transfers > 0 &&
                ` · ${option.transfers} transfer${option.transfers > 1 ? "s" : ""}`}
              {option.walkKm > 0.15 && ` · ${formatKm(option.walkKm)} walk`}
            </span>
          </span>

          <span className="shrink-0 text-right">
            <span className="block text-sm font-semibold tabular-nums">
              {formatMinRange(option.durationMin.low, option.durationMin.high)}
            </span>
            <span className="text-muted-foreground block text-xs tabular-nums">
              {formatPrice(option.price.low, option.price.high)}
              {option.price.surgeProne && "*"}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} ${meta.label} details`}
          className="text-muted-foreground hover:text-foreground flex shrink-0 items-center px-2.5"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      {expanded && (
        <div className="border-t px-3 py-2.5">
          <ol className="space-y-1.5">
            {option.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span
                  className="mt-1 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: step.color ?? meta.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground">{step.label}</span>
                  {step.detail && (
                    <span className="text-muted-foreground"> · {step.detail}</span>
                  )}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {Math.round(step.durationMin)} min
                </span>
              </li>
            ))}
          </ol>

          {option.notes.length > 0 && (
            <ul className="mt-2 space-y-1">
              {option.notes.map((note, i) => (
                <li key={i} className="text-muted-foreground flex items-start gap-1.5 text-xs">
                  {note.toLowerCase().includes("surge") || note.toLowerCase().includes("negotiate") ? (
                    <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-500" />
                  ) : (
                    <Info className="mt-0.5 size-3 shrink-0" />
                  )}
                  {note}
                </li>
              ))}
            </ul>
          )}

          {option.bookingUrl && (
            <Button asChild variant="outline" size="sm" className="mt-2 h-7 gap-1.5 text-xs">
              <a href={option.bookingUrl} target="_blank" rel="noopener noreferrer">
                {option.bookingLabel ?? "Open"}
                <ExternalLink className="size-3" />
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
