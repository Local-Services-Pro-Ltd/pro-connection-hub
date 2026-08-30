import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { Menu, X, UserRound, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ThemeControl } from "@/components/theme-control";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { FeedbackForm } from "@/components/feedback-form";



const nav = [
  { to: "/trades", label: "Find a tradesman" },
  { to: "/costs", label: "Cost guides" },
  { to: "/areas", label: "Areas" },
  { to: "/saved", label: "Shortlist" },
  { to: "/for-tradesmen", label: "For tradesmen" },

];

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-sm bg-primary font-display text-sm font-bold text-primary-foreground">
        TF
      </span>
      <span className="font-display text-[15px] font-bold tracking-tight">
        Tradesman<span className="text-primary">Finder</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 lg:px-8">
        <div className="flex min-w-0 items-center gap-10">
          <Logo />
          <nav className="hidden items-center gap-8 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeControl />
          {user ? (

            <Link
              to="/account"
              className="hidden items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex"
            >
              <UserRound className="h-4 w-4" />
              My account
            </Link>
          ) : (
            <Link
              to="/signin"
              search={{}}
              className="hidden rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Sign in
            </Link>
          )}
          <Link to="/post-job" search={{}} className="hidden sm:block">
            <Action>Post a job</Action>
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border lg:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-5 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {[
              ...nav,
              user
                ? { to: "/account", label: "My account" }
                : { to: "/signin", label: "Sign in" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-sm px-2 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/post-job"
              search={{}}
              onClick={() => setOpen(false)}
              className="mt-2"
            >
              <Action className="w-full justify-center">Post a job</Action>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function Action({
  children,
  variant = "ember",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "ember" | "outline" | "ghost";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center gap-2 rounded-sm px-4 py-2.5 font-display text-sm font-semibold tracking-tight transition-all duration-300";
  const styles = {
    ember:
      "bg-primary text-primary-foreground shadow-ember hover:brightness-110 active:translate-y-px",
    outline:
      "border border-border-strong text-foreground hover:border-primary hover:text-primary",
    ghost: "text-muted-foreground hover:text-foreground",
  }[variant];

  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            A vetted network of UK trades. Post a job free, compare real quotes,
            hire with a paper trail.
          </p>
        </div>
        <div>
          <p className="eyebrow">Popular trades and services</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {["plumber", "electrician", "builder", "roofer"].map((slug) => (
              <li key={slug}>
                <Link
                  to="/trades/$trade"
                  params={{ trade: slug }}
                  search={{}}
                  className="capitalize transition-colors hover:text-foreground"
                >
                  {slug.replace("-", " ")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">Company</p>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link to="/areas" className="hover:text-foreground">
                Areas we cover
              </Link>
            </li>
            <li>
              <Link to="/for-tradesmen" className="hover:text-foreground">
                Join as a tradesman
              </Link>
            </li>
            <li>
              <Link to="/post-job" search={{}} className="hover:text-foreground">
                Post a job
              </Link>
            </li>
            <li>
              <Link
                to="/waiting-list"
                search={{}}
                className="hover:text-foreground"
              >
                Waiting list
              </Link>
            </li>

            <li>
              <Link to="/privacy" className="hover:text-foreground">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-foreground">
                Terms of Use
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={openCookiePreferences}
                className="text-left transition-colors hover:text-foreground"
              >
                Cookie preferences
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.4fr_2fr] lg:px-8">
          <div>
            <p className="eyebrow">Contact us</p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              Something to tell us?
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Whether it's a bug, a trade who let you down, or an idea we've
              missed — we'd rather hear it.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <a
                  href="mailto:hello@tradesmanfinder.org"
                  className="transition-colors hover:text-foreground"
                >
                  hello@tradesmanfinder.org
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <a
                  href="mailto:privacy@tradesmanfinder.org"
                  className="transition-colors hover:text-foreground"
                >
                  privacy@tradesmanfinder.org
                </a>
              </li>
            </ul>
          </div>
          <div>
            <FeedbackForm />
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs leading-relaxed text-muted-foreground lg:px-8">
          <p>
            © {new Date().getFullYear()} TradesmanFinder. Tradesman Finder is
            part of Local Services Pro and All Care 4 U Group. All Rights
            Reserved.
          </p>
          <nav className="flex flex-wrap items-center gap-4">
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <button
              type="button"
              onClick={openCookiePreferences}
              className="hover:text-foreground"
            >
              Cookies
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}

