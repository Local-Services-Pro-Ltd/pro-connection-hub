import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

type Route = {
  id: string;
  d: string;
  dur: string;
  begin: string;
};

/** Stylised road/route network — abstract UK-ish arterial layout. */
const routes: Route[] = [
  {
    id: "r1",
    d: "M -40 640 C 240 600, 320 420, 560 400 S 900 470, 1120 330 S 1450 250, 1680 300",
    dur: "13s",
    begin: "0s",
  },
  {
    id: "r2",
    d: "M -40 250 C 220 260, 360 180, 620 220 S 980 400, 1240 540 S 1500 700, 1680 690",
    dur: "17s",
    begin: "-4s",
  },
  {
    id: "r3",
    d: "M 300 940 C 340 720, 520 640, 700 600 S 1020 520, 1180 340 S 1300 130, 1340 -40",
    dur: "15s",
    begin: "-8s",
  },
  {
    id: "r4",
    d: "M -40 460 C 180 470, 300 560, 520 640 S 860 780, 1120 780 S 1520 820, 1680 900",
    dur: "19s",
    begin: "-11s",
  },
];

/** Live "hubs" — pulsing coverage nodes. */
const hubs = [
  { x: 560, y: 400, r: 120, label: "Manchester", live: 34 },
  { x: 1120, y: 330, r: 96, label: "Leeds", live: 21 },
  { x: 1240, y: 540, r: 150, label: "London", live: 78 },
  { x: 700, y: 600, r: 84, label: "Birmingham", live: 45 },
  { x: 300, y: 250, r: 70, label: "Glasgow", live: 12 },
];

function Tracker({ route, delay }: { route: Route; delay: string }) {
  return (
    <g>
      <circle r="13" className="fill-primary/20" />
      <circle r="6.5" className="fill-primary" />
      <circle r="3" className="fill-primary-foreground/90" />
      <animateMotion
        dur={route.dur}
        begin={delay}
        repeatCount="indefinite"
        rotate="auto"
        keyPoints="0;1"
        keyTimes="0;1"
        calcMode="linear"
      >
        <mpath href={`#${route.id}`} />
      </animateMotion>
    </g>
  );
}

export function LiveMapHero({
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
  const reduced = usePrefersReducedMotion();

  return (
    <div className="relative isolate overflow-hidden border-b border-border bg-surface">
      <svg
        className="absolute inset-0 -z-10 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Stylised live map of the UK showing tradesmen being GPS-tracked along routes between coverage areas"
      >
        <defs>
          <pattern
            id="map-grid"
            width="64"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M64 0H0V64"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-border"
            />
          </pattern>
          <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor="var(--color-primary)"
              stopOpacity="0.35"
            />
            <stop
              offset="100%"
              stopColor="var(--color-primary)"
              stopOpacity="0"
            />
          </radialGradient>
          {routes.map((r) => (
            <path key={r.id} id={r.id} d={r.d} fill="none" />
          ))}
        </defs>

        {/* Grid base */}
        <rect width="1600" height="900" className="fill-surface" />
        <rect width="1600" height="900" fill="url(#map-grid)" opacity="0.55" />

        {/* Landmass-ish blocks for depth */}
        <g className="text-border" opacity="0.5">
          {[
            [120, 120, 260, 150],
            [820, 90, 320, 180],
            [200, 700, 300, 160],
            [1180, 660, 300, 190],
          ].map(([x, y, w, h]) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={w}
              height={h}
              rx="14"
              fill="currentColor"
              opacity="0.35"
            />
          ))}
        </g>

        {/* Roads */}
        <g fill="none" strokeLinecap="round">
          {routes.map((r) => (
            <path
              key={`base-${r.id}`}
              d={r.d}
              className="stroke-foreground/15"
              strokeWidth="6"
            />
          ))}
          {routes.map((r, i) => (
            <path
              key={`trail-${r.id}`}
              d={r.d}
              className="stroke-primary"
              strokeWidth="3"
              strokeDasharray="140 1400"
              opacity="0.85"
              style={
                reduced
                  ? { opacity: 0.35, strokeDasharray: "none" }
                  : {
                      animation: `map-trail ${r.dur} linear ${i * -3}s infinite`,
                    }
              }
            />
          ))}
        </g>

        {/* Hubs */}
        {hubs.map((h) => (
          <g key={h.label}>
            <circle cx={h.x} cy={h.y} r={h.r} fill="url(#map-glow)" />
            {!reduced && (
              <circle
                cx={h.x}
                cy={h.y}
                r={h.r * 0.4}
                className="fill-none stroke-primary"
                strokeWidth="2"
                style={{
                  transformOrigin: `${h.x}px ${h.y}px`,
                  animation: `map-ping 3.2s ease-out ${(h.live % 5) * 0.4}s infinite`,
                }}
              />
            )}
            <circle cx={h.x} cy={h.y} r="9" className="fill-primary" />
            <circle
              cx={h.x}
              cy={h.y}
              r="3.5"
              className="fill-primary-foreground"
            />
            <text
              x={h.x + 18}
              y={h.y - 12}
              className="fill-foreground font-display"
              fontSize="19"
              fontWeight="600"
            >
              {h.label}
            </text>
            <text
              x={h.x + 18}
              y={h.y + 10}
              className="fill-primary"
              fontSize="14"
              letterSpacing="1.5"
            >
              {h.live} live now
            </text>
          </g>
        ))}

        {/* GPS trackers */}
        {!reduced &&
          routes.map((r) => (
            <Tracker key={`t-${r.id}`} route={r} delay={r.begin} />
          ))}
      </svg>

      <div className="hero-veil pointer-events-none absolute inset-0 -z-10" />
      <div className="hero-copy-scrim pointer-events-none absolute inset-0 -z-10" />

      <div className="relative mx-auto max-w-7xl px-5 py-20 sm:py-24 lg:px-8 lg:py-36">
        <p className="eyebrow hero-ink-muted flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {!reduced && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          {eyebrow}
        </p>
        <h1 className="hero-ink mt-4 max-w-3xl text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {sub && (
          <p className="hero-ink-muted mt-5 max-w-xl text-base leading-relaxed">
            {sub}
          </p>
        )}
        {children && <div className="mt-8 max-w-3xl">{children}</div>}
      </div>
    </div>
  );
}
