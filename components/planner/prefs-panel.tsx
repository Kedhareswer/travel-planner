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
import { MODE_LIST } from "@/lib/modes";
import type { ModeId, TripPreferences } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Trip preferences: peak traffic, how much an hour is worth to the user
 * (drives the "Best" ranking), max walking distance, excluded modes.
 */
export function PrefsPanel({
  prefs,
  onChange,
}: {
  prefs: TripPreferences;
  onChange: (prefs: TripPreferences) => void;
}) {
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
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">₹50 / hour</SelectItem>
            <SelectItem value="100">₹100 / hour</SelectItem>
            <SelectItem value="150">₹150 / hour</SelectItem>
            <SelectItem value="300">₹300 / hour</SelectItem>
            <SelectItem value="600">₹600 / hour</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-normal">Max walk per leg</Label>
        <Select
          value={String(prefs.maxWalkKm)}
          onValueChange={(v) => onChange({ ...prefs, maxWalkKm: Number(v) })}
        >
          <SelectTrigger size="sm" className="w-32">
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
          {MODE_LIST.filter((m) => m.id !== "walk").map((mode) => {
            const excluded = prefs.excludedModes.includes(mode.id);
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...prefs,
                    excludedModes: excluded
                      ? prefs.excludedModes.filter((m: ModeId) => m !== mode.id)
                      : [...prefs.excludedModes, mode.id],
                  })
                }
                aria-pressed={!excluded}
              >
                <Badge
                  variant={excluded ? "outline" : "secondary"}
                  className={cn("cursor-pointer", excluded && "text-muted-foreground line-through opacity-60")}
                >
                  {mode.label}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
