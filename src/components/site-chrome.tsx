import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { ChevronDown, Menu, X, UserRound, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { HeaderThemeControl, ThemeControl } from "@/components/theme-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { FeedbackForm } from "@/components/feedback-form";
import logoSrc from "@/assets/logo.png";

const nav = [
  { to: "/trades", label: "Find a tradesman" },
  { to: "/costs", label: "Cost guides" },
  { to: "/how-it-works", label: "How it works" },
] as const;

const moreNav = [
  { to: "/directory", label: "Directory" },
  { to: "/areas", label: "Areas" },
  { to: "/ask", label: "Ask the pros" },
  { to: "/projects", label: "Project board" },
  { to: "/saved", label: "Shortlist" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-3">
      <img
        src={logoSrc}
        alt="TradesmanFinder"
        width={52}
        height={52}
        className="h-11 w-11 sm:h-13 sm:w-13"
      />
      <span className="inline font-display text-[17px] font-bold tracking-tight sm:text-[19px] lg:hidden xl:inline">
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
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:flex lg:justify-between lg:px-5">
        <div className="flex min-w-0 items-center gap-5 xl:gap-7">
          <Logo />
          <nav aria-label="Main navigation" className="hidden items-center gap-5 lg:flex xl:gap-6">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                More <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {moreNav.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to} className="cursor-pointer px-3 py-2.5">
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <HeaderThemeControl />
          {user ? (
            <Link
              to="/account"
              className="hidden items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:flex"
            >
              <UserRound className="h-4 w-4 shrink-0" />
              My account
            </Link>
          ) : (
            <Link
              to="/signin"
              search={{}}
              className="hidden whitespace-nowrap rounded-sm px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:block"
            >
              Sign in
            </Link>
          )}
          <Link
            to="/post-job"
            search={{}}
            className="hidden h-10 whitespace-nowrap rounded-sm bg-primary px-4 py-0 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 lg:inline-flex lg:items-center"
          >
            Post a job
          </Link>
          <Link
            to="/join"
            className="hidden h-10 whitespace-nowrap rounded-sm border border-primary bg-background px-4 py-0 font-display text-sm font-semibold text-foreground hover:bg-muted lg:inline-flex lg:items-center"
          >
            For trades: Join or claim
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-border lg:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-5 py-4 lg:hidden">
          <div className="grid gap-3">
            <Link
              to="/post-job"
              search={{}}
              onClick={() => setOpen(false)}
              className="inline-flex h-11 w-full items-center justify-center rounded-sm bg-primary px-5 py-0 font-display font-semibold text-primary-foreground shadow-ember"
            >
              Post a job
            </Link>
            <Link
              to="/join"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 w-full items-center justify-center rounded-sm border border-primary bg-background px-5 py-0 font-display font-semibold text-foreground"
            >
              For trades: Join or claim
            </Link>
          </div>
          <nav
            aria-label="Mobile navigation"
            className="mt-4 flex flex-col gap-1 border-t border-border pt-3"
          >
            {[...nav, ...moreNav].map((item) => (
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
              to={user ? "/account" : "/signin"}
              search={{}}
              onClick={() => setOpen(false)}
              className="rounded-sm px-2 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {user ? "My account" : "Sign in"}
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
    "inline-flex h-10 items-center gap-2 rounded-sm px-5 py-0 font-display text-sm font-semibold tracking-tight transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";
  const styles = {
    ember:
      "bg-primary text-primary-foreground shadow-ember hover:brightness-110 active:translate-y-px",
    outline: "border border-border-strong text-foreground hover:border-primary hover:text-primary",
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
            Local UK trades, ID-checked and insured before they can quote.
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
              <Link to="/how-it-works" className="hover:text-foreground">
                How it works
              </Link>
            </li>
            <li>
              <Link to="/verification" className="hover:text-foreground">
                How we check firms
              </Link>
            </li>
            <li>
              <Link to="/complaints" className="hover:text-foreground">
                If something goes wrong
              </Link>
            </li>
            <li>
              <Link to="/join" className="hover:text-foreground">
                Join as a tradesman
              </Link>
            </li>
            <li>
              <Link to="/join" className="hover:text-foreground">
                Apply to join
              </Link>
            </li>
            <li>
              <Link to="/post-job" search={{}} className="hover:text-foreground">
                Post a job
              </Link>
            </li>
            <li>
              <Link to="/waiting-list" search={{}} className="hover:text-foreground">
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
              Whether it's a bug, a trade who let you down, or an idea we've missed — we'd rather
              hear it.
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
          <div className="space-y-1">
            <p>
              © {new Date().getFullYear()} TradesmanFinder. Tradesman Finder is part of Local
              Services Pro and All Care 4 U Group. All Rights Reserved.
            </p>
            <p>
              Local Services Pro Ltd · Registered in England &amp; Wales, company no. 12126782 · ICO
              registration no. 00015543780
            </p>
            <address className="not-italic">
              Registered office: 38 Bloomfield Road, London, SE18 7JH, United Kingdom
            </address>
          </div>
          <nav className="flex flex-wrap items-center gap-4">
            <ThemeControl />
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <button type="button" onClick={openCookiePreferences} className="hover:text-foreground">
              Cookies
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
