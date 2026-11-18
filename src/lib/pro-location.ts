import type { Area, Pro } from "@/lib/queries";

type ProLocation = Pick<Pro, "area" | "area_slug">;
type AreaName = Pick<Area, "slug" | "name">;

/** Display the town with its public area name, avoiding duplicate place names. */
export function formatProLocation(pro: ProLocation, areas: AreaName[]): string {
  const town = pro.area.trim();
  const areaName = areas.find((area) => area.slug === pro.area_slug)?.name.trim();
  if (!areaName || town.localeCompare(areaName, "en-GB", { sensitivity: "accent" }) === 0) {
    return town;
  }
  return `${town}, ${areaName}`;
}
