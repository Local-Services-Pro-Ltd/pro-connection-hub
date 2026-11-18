import { useState, type ReactNode } from "react";

type PageBannerProps = {
  eyebrow: string;
  title: string;
  sub?: string;
  image: string;
  imageAlt: string;
  children?: ReactNode;
};

/** Compact, reusable page header with a local photo and a safe no-image state. */
export function PageBanner({ eyebrow, title, sub, image, imageAlt, children }: PageBannerProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const showImage = failedImage !== image;

  return (
    <section
      data-page-banner
      className="relative isolate flex min-h-[220px] items-center overflow-hidden border-b border-border bg-surface sm:min-h-[320px]"
    >
      {showImage ? (
        <>
          <img
            data-page-banner-image
            src={image}
            alt={imageAlt}
            width={1600}
            height={900}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={() => setFailedImage(image)}
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div className="hero-veil pointer-events-none absolute inset-0 -z-10" />
          <div className="hero-copy-scrim pointer-events-none absolute inset-0 -z-10" />
        </>
      ) : (
        <div className="rule-grid pointer-events-none absolute inset-0 -z-10 opacity-40" />
      )}

      <div className="mx-auto w-full max-w-7xl px-5 py-7 sm:py-10 lg:px-8">
        <p className={`eyebrow ${showImage ? "hero-ink-muted" : ""}`}>{eyebrow}</p>
        <h1
          className={`mt-3 max-w-3xl text-3xl leading-[1.05] sm:mt-4 sm:text-5xl ${
            showImage ? "hero-ink" : ""
          }`}
        >
          {title}
        </h1>
        {sub && (
          <p
            className={`mt-4 max-w-2xl text-sm leading-relaxed sm:text-base ${
              showImage ? "hero-ink-muted" : "text-muted-foreground"
            }`}
          >
            {sub}
          </p>
        )}
        {children && <div className="mt-6 max-w-3xl">{children}</div>}
      </div>
    </section>
  );
}
