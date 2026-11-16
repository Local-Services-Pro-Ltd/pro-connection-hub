import { ONBOARDING_FREE } from "@/lib/onboarding";

export type FactTile = { value: string; label: string };

/** Fact tiles on /join. Driven by the single onboarding switch. */
export function joinFactTiles(onboardingFree: boolean = ONBOARDING_FREE): FactTile[] {
  if (!onboardingFree) {
    return [
      { value: "£0", label: "per lead or job won" },
      { value: "3", label: "quotes max per job" },
    ];
  }
  return [
    { value: "Free", label: "while we onboard trades" },
    { value: "50% off", label: "your first 12 months once charging starts" },
    { value: "£0", label: "per lead or job won" },
    { value: "30 days", label: "notice before anything is charged" },
  ];
}
