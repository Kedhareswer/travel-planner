"use client";

import { Clock, Footprints, Route, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatKm, formatMinRange } from "@/lib/geo";
import { formatMoneyRange } from "@/lib/region";
import type { RegionProfile } from "@/lib/types";

/** Whole-trip totals across the selected option of every leg. */
export function TripSummary({
  totals,
  region,
}: {
  totals: {
    priceLow: number;
    priceHigh: number;
    minLow: number;
    minHigh: number;
    walkKm: number;
    distanceKm: number;
    surgeProne: boolean;
  };
  region: RegionProfile;
}) {
  return (
    <Card className="py-3">
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 sm:grid-cols-4">
        <Stat
          icon={<Clock className="size-3.5" />}
          label="Total time"
          value={formatMinRange(totals.minLow, totals.minHigh)}
        />
        <Stat
          icon={<Wallet className="size-3.5" />}
          label="Total cost"
          value={`${formatMoneyRange(totals.priceLow, totals.priceHigh, region)}${totals.surgeProne ? "*" : ""}`}
        />
        <Stat
          icon={<Route className="size-3.5" />}
          label="Distance"
          value={formatKm(totals.distanceKm)}
        />
        <Stat
          icon={<Footprints className="size-3.5" />}
          label="Walking"
          value={formatKm(totals.walkKm)}
        />
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
