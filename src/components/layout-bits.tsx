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
  image,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  children?: ReactNode;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <div className="relative overflow-hidden border-b border-border bg-surface">
      {image ? (
        <>
          <img
            src={image}
            alt={imageAlt ?? ""}
            width={1600}
            height={900}
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/25" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        </>
      ) : (
        <div className="rule-grid pointer-events-none absolute inset-0 opacity-40" />
      )}
      <div
        className={`relative mx-auto max-w-7xl px-5 lg:px-8 ${image ? "py-24 lg:py-36" : "py-16 lg:py-24"}`}
      >
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

