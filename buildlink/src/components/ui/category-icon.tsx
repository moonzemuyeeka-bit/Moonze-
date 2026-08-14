import * as React from "react";
import {
  Blocks,
  Boxes,
  Container,
  DoorOpen,
  Droplets,
  Grid3x3,
  Hammer,
  Layers,
  Mountain,
  Package,
  Paintbrush,
  TreePine,
  Warehouse,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryIconName } from "@/lib/catalogue";

/**
 * Category icon registry.
 *
 * An explicit map rather than a dynamic `lucide-react` lookup, so only the
 * fifteen icons actually used are bundled and a bad name is a type error rather
 * than a blank square in production.
 */
const ICONS: Record<CategoryIconName, React.ComponentType<{ className?: string }>> = {
  cement: Package,
  blocks: Blocks,
  sand: Layers,
  stone: Mountain,
  steel: Boxes,
  timber: TreePine,
  roofing: Warehouse,
  plumbing: Wrench,
  electrical: Zap,
  flooring: Grid3x3,
  paint: Paintbrush,
  doors: DoorOpen,
  hardware: Hammer,
  water: Droplets,
  other: Container,
};

export function CategoryIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name as CategoryIconName] ?? Package;
  return <Icon className={cn("size-5", className)} />;
}
