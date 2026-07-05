import type { ModeId, ModeMeta } from "./types";

/**
 * Registry of comparable modes. Colors are used consistently for
 * map polylines, badges and legends.
 */
export const MODES: Record<ModeId, ModeMeta> = {
  walk: { id: "walk", label: "Walk", kind: "walk", provider: "public", color: "#64748b" },
  metro: { id: "metro", label: "Metro", kind: "metro", provider: "public", color: "#0ea5e9" },
  bus: { id: "bus", label: "City Bus", kind: "bus", provider: "public", color: "#22c55e" },
  auto: { id: "auto", label: "Auto (meter)", kind: "auto", provider: "street", color: "#eab308" },
  "uber-go": { id: "uber-go", label: "Uber Go", kind: "cab", provider: "uber", color: "#171717" },
  "uber-auto": { id: "uber-auto", label: "Uber Auto", kind: "auto", provider: "uber", color: "#f59e0b" },
  "uber-moto": { id: "uber-moto", label: "Uber Moto", kind: "bike", provider: "uber", color: "#dc2626" },
  "rapido-bike": { id: "rapido-bike", label: "Rapido Bike", kind: "bike", provider: "rapido", color: "#f43f5e" },
  "rapido-auto": { id: "rapido-auto", label: "Rapido Auto", kind: "auto", provider: "rapido", color: "#f97316" },
  "rapido-cab": { id: "rapido-cab", label: "Rapido Cab", kind: "cab", provider: "rapido", color: "#8b5cf6" },
};

export const MODE_LIST: ModeMeta[] = Object.values(MODES);

export function modeMeta(id: ModeId): ModeMeta {
  return MODES[id];
}
