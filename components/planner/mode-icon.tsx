import {
  Bike,
  Bus,
  Car,
  CarTaxiFront,
  Footprints,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import type { ModeKind } from "@/lib/types";

const ICONS: Record<ModeKind, LucideIcon> = {
  walk: Footprints,
  metro: TrainFront,
  bus: Bus,
  auto: CarTaxiFront,
  cab: Car,
  bike: Bike,
};

export function ModeIcon({
  kind,
  className,
}: {
  kind: ModeKind;
  className?: string;
}) {
  const Icon = ICONS[kind];
  return <Icon className={className} aria-hidden />;
}
