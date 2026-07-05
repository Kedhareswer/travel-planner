"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/region";
import { CYCLE_MODE_ID, TRANSIT_MODE_ID } from "@/lib/planner";
import type { RegionProfile, TripPreferences } from "@/lib/types";

/**
 * Trip preferences: peak traffic, what an hour is worth to the user in the
 * local currency (drives the "Best" ranking), max walking distance, and
 * which of the region's modes to compare.
 */
export function PrefsPanel({
  region,
  prefs,
  onChange,
}: {
  region: RegionProfile;
  prefs: TripPreferences;
  onChange: (prefs: TripPreferences) => void;
}) {
  const toggles: { id: string; label: string }[] = [
    { id: TRANSIT_MODE_ID, label: "Public transit" },
    ...(region.cycling ? [{ id: CYCLE_MODE_ID, label: "Bicycle" }] : []),
    ...region.roadModes.map((m) => ({ id: m.id, label: m.label })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="peak" className="text-sm font-normal">
          Peak-hour traffic
        </Label>
        <Switch
          id="peak"
          checked={prefs.peakHours}
          onCheckedChange={(peakHours) => onChange({ ...prefs, peakHours })}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-normal">My time is worth</Label>
        <Select
          value={String(prefs.valueOfTimePerHour)}
          onValueChange={(v) => onChange({ ...prefs, valueOfTimePerHour: Number(v) })}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {region.valueOfTimePresets.map((v) => (
              <SelectItem key={v} value={String(v)}>
                {formatMoney(v, region)} / hour
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-normal">Max walk per leg</Label>
        <Select
          value={String(prefs.maxWalkKm)}
          onValueChange={(v) => onChange({ ...prefs, maxWalkKm: Number(v) })}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.8">800 m</SelectItem>
            <SelectItem value="1.2">1.2 km</SelectItem>
            <SelectItem value="1.8">1.8 km</SelectItem>
            <SelectItem value="3">3 km</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 block text-sm font-normal">Modes to compare</Label>
        <div className="flex flex-wrap gap-1">
          {toggles.map((t) => {
            const excluded = prefs.excludedModes.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...prefs,
                    excludedModes: excluded
                      ? prefs.excludedModes.filter((m) => m !== t.id)
                      : [...prefs.excludedModes, t.id],
                  })
                }
                aria-pressed={!excluded}
              >
                <Badge
                  variant={excluded ? "outline" : "secondary"}
                  className={cn(
                    "cursor-pointer",
                    excluded && "text-muted-foreground line-through opacity-60",
                  )}
                >
                  {t.label}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
