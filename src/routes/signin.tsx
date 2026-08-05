import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import heroPoster from "@/assets/hero-poster.jpg";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in | TradesmanFinder" },
      {
        name: "description",
        content:
          "Sign in to manage your posted jobs, quotes and messages on TradesmanFinder.",
      },
      { property: "og:title", content: "Sign in — TradesmanFinder" },
      {
        property: "og:description",
        content: "Manage your jobs, quotes and messages.",
      },
    ],
  }),
  component: SignIn,
});

const field =
  "w-full rounded-sm border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary";

function SignIn() {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="flex items-center px-5 py-16 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <p className="eyebrow">Welcome back</p>
          <h1 className="mt-3 text-4xl leading-tight">Sign in.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Manage your jobs, quotes and messages in one place.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              toast("Demo only — authentication isn't wired up yet.");
            }}
            className="mt-8 space-y-5"
          >
            <label className="block">
              <span className="eyebrow">Email</span>
              <input required type="email" className={`${field} mt-2`} />
            </label>
            <label className="block">
              <span className="eyebrow">Password</span>
              <input required type="password" className={`${field} mt-2`} />
            </label>
            <button
              type="submit"
              className="w-full rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Sign in
            </button>
          </form>

          <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
            Are you a trade?{" "}
            <Link to="/for-tradesmen" className="text-primary hover:underline">
              Apply to join the network
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden border-l border-border lg:block">
        <img
          src={heroPoster}
          alt="A tradesman on a UK renovation site"
          loading="lazy"
          width={1920}
          height={1088}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-background/55" />
        <blockquote className="absolute bottom-12 left-12 right-12 font-display text-2xl leading-snug">
          "Three quotes in under two hours, all with photos of previous work."
          <footer className="mt-4 font-sans text-sm text-muted-foreground">
            Hannah D. — Bristol
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
