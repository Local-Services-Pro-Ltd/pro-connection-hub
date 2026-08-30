import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { ProProject } from "@/lib/queries";

function BeforeAfter({ project }: { project: ProProject }) {
  const [pos, setPos] = useState(50);
  const hasBoth = Boolean(project.before_url && project.after_url);
  const single = project.after_url ?? project.before_url;

  if (!single) {
    return (
      <div className="grid aspect-[4/3] place-items-center bg-surface text-muted-foreground">
        <ImageOff className="h-6 w-6" aria-hidden />
      </div>
    );
  }

  if (!hasBoth) {
    return (
      <img
        src={single}
        alt={project.title}
        loading="lazy"
        className="aspect-[4/3] w-full object-cover"
      />
    );
  }

  return (
    <div className="relative aspect-[4/3] w-full select-none overflow-hidden">
      <img
        src={project.before_url!}
        alt={`${project.title} — before`}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      >
        <img
          src={project.after_url!}
          alt={`${project.title} — after`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-sm bg-background/85 px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-widest backdrop-blur">
        Before
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-sm bg-primary px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
        After
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`Reveal the after photo for ${project.title}`}
        className="absolute bottom-3 left-1/2 w-[85%] -translate-x-1/2 accent-[var(--color-primary)]"
      />
    </div>
  );
}

export function ProjectGallery({
  projects,
  heading = "Recent work",
  emptyNote,
}: {
  projects: ProProject[];
  heading?: string;
  emptyNote?: string;
}) {
  if (projects.length === 0) {
    if (!emptyNote) return null;
    return (
      <div className="mt-5 rounded-md border border-dashed border-border-strong bg-card p-6 text-sm text-muted-foreground">
        {emptyNote}
      </div>
    );
  }

  return (
    <div>
      {heading && <h2 className="text-2xl">{heading}</h2>}
      <ul className="mt-5 grid gap-5 sm:grid-cols-2">
        {projects.map((p) => (
          <li
            key={p.id}
            className="overflow-hidden rounded-md border border-border bg-card"
          >
            <BeforeAfter project={p} />
            <div className="p-5">
              <h3 className="text-base">{p.title}</h3>
              {p.summary && (
                <p className="mt-1.5 text-sm text-muted-foreground">{p.summary}</p>
              )}
              {p.completed_on && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Completed{" "}
                  {new Date(p.completed_on).toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
