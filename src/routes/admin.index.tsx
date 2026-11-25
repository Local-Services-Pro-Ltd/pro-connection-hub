import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Section, PageHero } from "@/components/layout-bits";
import { useAuth } from "@/hooks/use-auth";
import { isAdminQuery } from "@/lib/queries";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Admin | TradesmanFinder" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminHome,
});

const GROUPS = [
  {
    title: "Firms",
    links: [
      {
        to: "/admin/applications",
        label: "Applications and claims",
        body: "Review firms applying to join or claiming a listing.",
      },
      {
        to: "/admin/firms",
        label: "Firms and invitations",
        body: "See which listings have an account and invite the rest to take theirs over.",
      },
      {
        to: "/admin/credentials",
        label: "Credentials",
        body: "Add and verify company numbers, insurance and trade registrations.",
      },
      {
        to: "/admin/galleries",
        label: "Work galleries",
        body: "Approve or reject firms' before-and-after jobs, and set visit windows.",
      },
      {
        to: "/admin/featured",
        label: "Featured firms",
        body: "Choose which firms appear on the homepage.",
      },
    ],
  },
  {
    title: "Homeowners and content",
    links: [
      {
        to: "/admin/projects",
        label: "Project postings",
        body: "Review homeowner projects before they go on the project board.",
      },
      {
        to: "/admin/complaints",
        label: "Complaints",
        body: "Problems homeowners have reported about a job, and what was decided.",
      },
      {
        to: "/admin/reviews",
        label: "Reviews",
        body: "Publish or reject homeowner reviews of firms.",
      },
      { to: "/admin/qa", label: "Ask the Pros", body: "Moderate questions and answers." },
      {
        to: "/admin/waiting-list",
        label: "Waiting list",
        body: "See demand from areas that are not live yet.",
      },
      {
        to: "/admin/hero-images",
        label: "Trade photos",
        body: "Replace the main photo on a trade page.",
      },
    ],
  },
  {
    title: "Settings and records",
    links: [
      { to: "/admin/plans", label: "Plans", body: "Control which membership plans are shown." },
      {
        to: "/admin/sla",
        label: "Review times",
        body: "How quickly applications are being handled.",
      },
      { to: "/admin/audit", label: "Vetting log", body: "A record of every vetting decision." },
      {
        to: "/admin/access",
        label: "Access map",
        body: "Which roles can read and write each table.",
      },
      {
        to: "/admin/events",
        label: "Denied access",
        body: "Attempts to reach something a user is not allowed to.",
      },
    ],
  },
] as const;

function AdminHome() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending } = useQuery({ ...isAdminQuery(user?.id), enabled: !loading });

  if (loading || (user && isPending)) {
    return (
      <Section>
        <p className="text-muted-foreground">Checking your access…</p>
      </Section>
    );
  }
  if (!user || !isAdmin) {
    return (
      <Section>
        <div className="max-w-xl rounded-md border border-border bg-card p-8">
          <h1 className="text-2xl">{user ? "Admins only" : "Sign in required"}</h1>
          <p className="mt-3 text-muted-foreground">
            {user
              ? "Your account does not hold the admin role."
              : "The admin area is only open to signed-in admins."}
          </p>
          {!user && (
            <Link
              to="/signin"
              search={{}}
              className="mt-6 inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Sign in
            </Link>
          )}
        </div>
      </Section>
    );
  }

  return (
    <>
      <PageHero eyebrow="Admin" title="Run TradesmanFinder." sub={user.email ?? "Signed in"} />
      <Section>
        <div className="space-y-12">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-xl">{group.title}</h2>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.links.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="block h-full rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
                    >
                      <span className="font-display text-base font-semibold text-foreground">
                        {item.label}
                      </span>
                      <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                        {item.body}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
