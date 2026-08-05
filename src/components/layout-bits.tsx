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
  focal = "center",
  focalMobile,
  priority = true,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  children?: ReactNode;
  image?: string;
  imageAlt?: string;
  /** object-position on >= sm screens, e.g. "50% 35%" */
  focal?: string;
  /** object-position on mobile; defaults to `focal` */
  focalMobile?: string;
  /** Above-the-fold heroes load eagerly; set false to lazy-load. */
  priority?: boolean;
}) {
  const mobileFocal = focalMobile ?? focal;
  return (
    <div className="relative isolate overflow-hidden border-b border-border bg-surface">
      {image ? (
        <>
          {/* Reserved by the content padding below, so no layout shift. */}
          <picture className="absolute inset-0 -z-10 block">
            <img
              src={image}
              alt={imageAlt ?? ""}
              width={1600}
              height={900}
              sizes="100vw"
              decoding="async"
              loading={priority ? "eager" : "lazy"}
              {...(priority ? { fetchPriority: "high" as const } : {})}
              className="h-full w-full object-cover [object-position:var(--focal-mobile)] sm:[object-position:var(--focal)]"
              style={
                {
                  opacity: "var(--hero-image-opacity)",
                  "--focal": focal,
                  "--focal-mobile": mobileFocal,
                } as React.CSSProperties
              }
            />
          </picture>
          <div className="hero-veil pointer-events-none absolute inset-0 -z-10" />
          <div className="hero-veil-bottom pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32" />
        </>
      ) : (
        <div className="rule-grid pointer-events-none absolute inset-0 -z-10 opacity-40" />
      )}

      <div
        className={`relative mx-auto max-w-7xl px-5 lg:px-8 ${image ? "py-20 sm:py-24 lg:py-36" : "py-16 lg:py-24"}`}
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


