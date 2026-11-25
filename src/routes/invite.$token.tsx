import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Section } from "@/components/layout-bits";
import { useAuth } from "@/hooks/use-auth";
import { acceptInvite, getInvite } from "@/lib/invites.functions";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Take over your listing | TradesmanFinder" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Invite,
});

const primary =
  "inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60";
const secondary =
  "inline-flex rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary";

function Invite() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const here = `/invite/${encodeURIComponent(token)}`;

  const {
    data: invite,
    isPending,
    error,
  } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => getInvite({ data: { token } }),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => acceptInvite({ data: { token } }),
    onSuccess: () => navigate({ to: "/dashboard" }),
  });

  return (
    <Section>
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Invitation</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">Take over your listing</h1>

        {error ? (
          <div className="mt-8 rounded-md border border-border bg-card p-8">
            <p role="alert" className="text-muted-foreground">
              {error.message}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              If your firm is already listed you can still ask to manage it. We check each request
              before linking an account.
            </p>
            <Link to="/join" hash="find" className={`mt-6 ${secondary}`}>
              Find and claim your listing
            </Link>
          </div>
        ) : isPending ? (
          <p className="mt-8 text-muted-foreground">Checking your invitation…</p>
        ) : (
          <>
            <div className="mt-8 rounded-md border border-border bg-card p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <Building2 className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="eyebrow">Your listing</p>
                  <h2 className="mt-2 text-2xl">{invite.company}</h2>
                  <p className="mt-2 text-sm capitalize text-muted-foreground">
                    {invite.trade.replaceAll("-", " ")}
                    {invite.area ? ` · ${invite.area}` : ""}
                  </p>
                  <Link
                    to="/pro/$id"
                    params={{ id: invite.proId }}
                    className="mt-3 inline-flex text-sm text-primary hover:underline"
                  >
                    See it as homeowners do
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-md border border-border bg-card p-6 sm:p-7">
              {loading ? (
                <p className="text-muted-foreground">Checking whether you're signed in…</p>
              ) : user ? (
                <>
                  <p className="text-muted-foreground">
                    You're signed in as <strong className="text-foreground">{user.email}</strong>.
                    Accepting links this account to {invite.company}, so you can edit the profile,
                    see jobs near you and add photos of your work.
                  </p>
                  {accept.error ? (
                    <p role="alert" className="mt-4 text-sm text-destructive">
                      {accept.error.message}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => accept.mutate()}
                    disabled={accept.isPending}
                    className={`mt-6 ${primary}`}
                  >
                    {accept.isPending ? "Linking your account…" : `Manage ${invite.company}`}
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-xl">First, create your free account</h2>
                  <p className="mt-3 text-muted-foreground">
                    Use <strong className="text-foreground">{invite.emailHint}</strong>, the address
                    we sent the invitation to. We'll email you a link to confirm it. Once you've
                    confirmed, open the invitation email again and choose "Take over your listing".
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      to="/signin"
                      search={{ redirect: here, intent: "claim" }}
                      className={primary}
                    >
                      Create an account
                    </Link>
                    <Link to="/signin" search={{ redirect: here }} className={secondary}>
                      I already have one
                    </Link>
                  </div>
                </>
              )}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              This link is personal to {invite.company} and works once. Not your firm? Email{" "}
              <a href="mailto:hello@tradesmanfinder.org" className="text-primary hover:underline">
                hello@tradesmanfinder.org
              </a>
              .
            </p>
          </>
        )}
      </div>
    </Section>
  );
}
