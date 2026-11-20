import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PublicPortfolioItem } from "@/lib/portfolio.shared";

type GalleryPhoto = { src: string; alt: string };

function PhotoButton({
  photo,
  onOpen,
  className = "",
}: {
  photo: GalleryPhoto;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative block w-full overflow-hidden bg-surface text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      aria-label={`Enlarge ${photo.alt}`}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        className="aspect-[4/3] h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
      />
    </button>
  );
}

export function ProjectGallery({
  projects,
  heading = "Work gallery",
  emptyNote,
}: {
  projects: PublicPortfolioItem[];
  heading?: string;
  emptyNote?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const photos = useMemo(
    () =>
      projects.flatMap((project) => {
        const items: GalleryPhoto[] = [];
        if (project.before) items.push({ src: project.before, alt: `${project.title} — before` });
        items.push({ src: project.after, alt: `${project.title} — after` });
        project.extras.forEach((src, index) =>
          items.push({ src, alt: `${project.title} — photo ${index + 1}` }),
        );
        return items;
      }),
    [projects],
  );

  if (projects.length === 0) {
    if (!emptyNote) return null;
    return (
      <div>
        {heading ? <h2 className="text-2xl">{heading}</h2> : null}
        <div className="mt-5 rounded-md border border-dashed border-border-strong bg-card p-6 text-sm text-muted-foreground">
          {emptyNote}
        </div>
      </div>
    );
  }

  let photoIndex = -1;
  const indexFor = () => {
    photoIndex += 1;
    return photoIndex;
  };
  return (
    <div>
      {heading ? <h2 className="text-2xl">{heading}</h2> : null}
      <ul className="mt-5 grid gap-5 lg:grid-cols-2">
        {projects.map((project) => (
          <li key={project.id} className="overflow-hidden rounded-md border border-border bg-card">
            <div className={`grid gap-1 ${project.before ? "sm:grid-cols-2" : ""}`}>
              {project.before ? (
                <div className="relative">
                  <PhotoButton
                    photo={{ src: project.before, alt: `${project.title} — before` }}
                    onOpen={() => setActive(indexFor())}
                  />
                  <span className="pointer-events-none absolute left-3 top-3 rounded-sm bg-background/90 px-2 py-1 text-xs font-semibold">
                    Before
                  </span>
                </div>
              ) : null}
              <div className="relative">
                <PhotoButton
                  photo={{ src: project.after, alt: `${project.title} — after` }}
                  onOpen={() => setActive(indexFor())}
                />
                <span className="pointer-events-none absolute left-3 top-3 rounded-sm bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                  After
                </span>
              </div>
            </div>
            {project.extras.length ? (
              <ul
                className="mt-1 grid grid-cols-3 gap-1 sm:grid-cols-6"
                aria-label={`More photos of ${project.title}`}
              >
                {project.extras.map((src, index) => (
                  <li key={src}>
                    <PhotoButton
                      photo={{ src, alt: `${project.title} — photo ${index + 1}` }}
                      onOpen={() => setActive(indexFor())}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="p-5">
              <h3 className="text-base">{project.title}</h3>
              {project.completed_on ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(`${project.completed_on}T00:00:00Z`).toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </p>
              ) : null}
              {project.summary ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {project.summary}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {active !== null && photos[active] ? (
        <Lightbox
          photos={photos}
          active={active}
          onChange={setActive}
          onClose={() => setActive(null)}
        />
      ) : null}
    </div>
  );
}

function Lightbox({
  photos,
  active,
  onChange,
  onClose,
}: {
  photos: GalleryPhoto[];
  active: number;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    restoreFocus.current = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocus.current?.focus();
    };
  }, []);
  const previous = () => onChange((active - 1 + photos.length) % photos.length);
  const next = () => onChange((active + 1) % photos.length);
  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Work gallery photo viewer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          previous();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          next();
        }
        if (event.key === "Tab") {
          const focusable = Array.from(
            dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [],
          );
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <button
        ref={close}
        type="button"
        onClick={onClose}
        aria-label="Close photo viewer"
        className="absolute right-4 top-4 rounded-sm border border-border-strong bg-card p-3 hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <X className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={previous}
        aria-label="Previous photo"
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-sm border border-border-strong bg-card p-3 hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <figure className="max-h-[90vh] w-full max-w-5xl px-10 text-center sm:px-16">
        <img
          src={photos[active]!.src}
          alt={photos[active]!.alt}
          className="mx-auto max-h-[78vh] max-w-full object-contain"
        />
        <figcaption className="mt-3 text-sm text-muted-foreground">
          {photos[active]!.alt} · {active + 1} of {photos.length}
        </figcaption>
      </figure>
      <button
        type="button"
        onClick={next}
        aria-label="Next photo"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm border border-border-strong bg-card p-3 hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}
