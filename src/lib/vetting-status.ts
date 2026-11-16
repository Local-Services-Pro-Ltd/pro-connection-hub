/**
 * Single source of truth for the vetting-status panel. The homepage component
 * and the /api/public/vetting-status endpoint both read this, so any client
 * page shows exactly the same stages and calls to action.
 */

export interface VettingStage {
  key: string;
  state: "Done" | "In progress" | "Next";
  title: string;
  body: string;
}

export interface VettingAction {
  key: string;
  title: string;
  body: string;
  href: "/post-job" | "/for-tradesmen";
  label: string;
}

export const VETTING_STAGES: VettingStage[] = [
  {
    key: "applications-open",
    state: "Done",
    title: "Applications open",
    body: "Local trades can apply to be listed while onboarding continues in their area.",
  },
  {
    key: "checks-under-way",
    state: "In progress",
    title: "Checks under way",
    body: "We ask for ID, public liability insurance, company details and any required trade credentials before a firm can quote.",
  },
  {
    key: "featured",
    state: "Next",
    title: "Featured on the homepage",
    body: "An admin selects homepage features separately from approval to quote. Listed firms remain marked vetting in progress until their checks are complete.",
  },
];

export const VETTING_ACTIONS: VettingAction[] = [
  {
    key: "post-job",
    title: "Need work doing now?",
    body: "Post the job and we'll match you with local trades as they join and complete their checks.",
    href: "/post-job",
    label: "Post a job — free",
  },
  {
    key: "for-tradesmen",
    title: "Run a trade business?",
    body: "Apply to be listed. We're onboarding a small number of firms per area so every postcode has cover without spreading thin.",
    href: "/for-tradesmen",
    label: "How membership works",
  },
];
