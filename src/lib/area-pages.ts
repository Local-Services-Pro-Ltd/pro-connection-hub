import { regions } from "@/lib/cost-guides";
import type { LiveArea } from "@/lib/postcode-gate";

export type AreaCostRegion = (typeof regions)[number]["id"];

export const AREA_COST_REGIONS: Record<LiveArea, AreaCostRegion> = {
  london: "london",
  kent: "south-east",
  surrey: "south-east",
  berkshire: "south-east",
  buckinghamshire: "south-east",
  hertfordshire: "south-east",
  birmingham: "midlands",
  bristol: "midlands",
  manchester: "north",
  leeds: "north",
};

export function areaCostRegion(areaSlug: string): AreaCostRegion {
  return AREA_COST_REGIONS[areaSlug as LiveArea] ?? "south-east";
}

export function regionalJobRange(areaSlug: string, low: number, high: number): [number, number] {
  const region = areaCostRegion(areaSlug);
  const factor = regions.find((item) => item.id === region)?.factor ?? 1;
  return [Math.round(low * factor), Math.round(high * factor)];
}
