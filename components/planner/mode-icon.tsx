import {
  Bike,
  Bus,
  CarTaxiFront,
  Car,
  Footprints,
  Ship,
  TrainFront,
  TramFront,
  type LucideIcon,
} from "lucide-react";
import type { ModeKind } from "@/lib/types";

const ICONS: Record<ModeKind, LucideIcon> = {
  walk: Footprints,
  cycle: Bike,
  scooter: Bike,
  metro: TrainFront,
  train: TrainFront,
  tram: TramFront,
  ferry: Ship,
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
  const Icon = ICONS[kind] ?? Car;
  return <Icon className={className} aria-hidden />;
}
