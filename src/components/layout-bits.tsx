import type { ReactNode } from "react";

export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`px-5 py-20 lg:px-8 lg:py-28 ${className}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
  aside,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 border-b border-border pb-8">
      <div className="min-w-0 max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 text-3xl leading-[1.05] sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        {sub && (
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {sub}
          </p>
        )}
      </div>
      {aside}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-border bg-surface">
      <div className="rule-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {sub && (
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            {sub}
          </p>
        )}
        {children && <div className="mt-8 max-w-3xl">{children}</div>}
      </div>
    </div>
  );
}
