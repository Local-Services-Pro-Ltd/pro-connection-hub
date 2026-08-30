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
  href: string;
  label: string;
}

export const VETTING_STAGES: VettingStage[] = [
  {
    key: "applications-open",
    state: "Done",
    title: "Applications open",
    body: "Trades in Greater London, Kent and Surrey can apply to be listed today.",
  },
  {
    key: "checks-under-way",
    state: "In progress",
    title: "Checks under way",
    body: "We look at public liability insurance, trade-body membership, company records and recent jobs — in person where we can.",
  },
  {
    key: "featured",
    state: "Next",
    title: "Featured on the homepage",
    body: "A firm appears here only once those checks pass and an admin signs it off. Nothing is featured automatically.",
  },
];

export const VETTING_ACTIONS: VettingAction[] = [
  {
    key: "post-job",
    title: "Need work doing now?",
    body: "Post the job anyway. We match it by hand to checked trades in your postcode and come back to you with names and quotes.",
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
