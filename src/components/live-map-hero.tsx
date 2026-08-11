import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, MapPin, X, ShieldCheck } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useGpsConsent } from "@/hooks/use-gps-consent";
import heroVideo from "@/assets/hero.mp4.asset.json";
import heroPoster from "@/assets/hero-poster.jpg";

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

type Hub = {
  x: number;
  y: number;
  r: number;
  label: string;
  live: number;
  postcode: string;
};

/** Live "hubs" — pulsing coverage nodes. */
const hubs: Hub[] = [
  { x: 560, y: 400, r: 120, label: "Manchester", live: 34, postcode: "M1" },
  { x: 1120, y: 330, r: 96, label: "Leeds", live: 21, postcode: "LS1" },
  { x: 1240, y: 540, r: 150, label: "London", live: 78, postcode: "EC1" },
  { x: 700, y: 600, r: 84, label: "Birmingham", live: 45, postcode: "B1" },
  { x: 300, y: 250, r: 70, label: "Glasgow", live: 12, postcode: "G1" },
];

/** Rough equirectangular projection of the UK onto the 1600x900 viewBox. */
function project(lat: number, lon: number) {
  const x = ((lon + 8.2) / 10.2) * 1600;
  const y = ((59.2 - lat) / 9.2) * 900;
  return {
    x: Math.max(30, Math.min(1570, x)),
    y: Math.max(30, Math.min(870, y)),
  };
}

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

function relTime(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
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
  const { consent, fix, error, allow, deny, reset } = useGpsConsent();

  // Live hub counts + last-update clock (client-side only).
  const [counts, setCounts] = useState(() =>
    Object.fromEntries(hubs.map((h) => [h.label, h.live])) as Record<string, number>,
  );
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState<Hub | null>(null);

  useEffect(() => {
    setUpdatedAt(Date.now());
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const feed = setInterval(() => {
      setCounts((prev) => {
        const next = { ...prev };
        for (const h of hubs) {
          const drift = Math.round((Math.random() - 0.5) * 4);
          next[h.label] = Math.max(3, (prev[h.label] ?? h.live) + drift);
        }
        return next;
      });
      setUpdatedAt(Date.now());
    }, 6000);
    return () => {
      clearInterval(tick);
      clearInterval(feed);
    };
  }, []);

  // Live video feed overlay
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(!reduced);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing]);

  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);

  const me = fix ? project(fix.lat, fix.lon) : null;

  return (
    <div className="relative isolate overflow-hidden border-b border-border bg-surface">
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
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

        {/* Hubs — clickable */}
        {hubs.map((h) => (
          <g
            key={h.label}
            role="button"
            tabIndex={0}
            aria-label={`${h.label}: ${counts[h.label]} tradesmen live now. Open coverage details.`}
            className="pointer-events-auto cursor-pointer focus:outline-none"
            onClick={() => setSelected(h)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(h);
              }
            }}
          >
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
            <circle
              cx={h.x}
              cy={h.y}
              r={h.r * 0.42}
              fill="transparent"
              className="stroke-transparent"
            />
            <circle
              cx={h.x}
              cy={h.y}
              r="9"
              className={
                selected?.label === h.label
                  ? "fill-accent"
                  : "fill-primary"
              }
            />
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
              {counts[h.label]} live now
            </text>
          </g>
        ))}

        {/* Your live GPS position */}
        {me && (
          <g>
            <circle
              cx={me.x}
              cy={me.y}
              r="46"
              className="fill-accent"
              opacity="0.18"
            />
            {!reduced && (
              <circle
                cx={me.x}
                cy={me.y}
                r="24"
                className="fill-none stroke-accent"
                strokeWidth="3"
                style={{
                  transformOrigin: `${me.x}px ${me.y}px`,
                  animation: "map-ping 2.4s ease-out infinite",
                }}
              />
            )}
            <circle cx={me.x} cy={me.y} r="11" className="fill-accent" />
            <circle
              cx={me.x}
              cy={me.y}
              r="4"
              className="fill-accent-foreground"
            />
            <text
              x={me.x + 20}
              y={me.y + 6}
              className="fill-foreground font-display"
              fontSize="17"
              fontWeight="600"
            >
              You
            </text>
          </g>
        )}
      </svg>

      <div className="hero-veil pointer-events-none absolute inset-0 z-[1]" />
      <div className="hero-copy-scrim pointer-events-none absolute inset-0 z-[1]" />

      {/* Live video feed overlay */}
      <div className="absolute right-4 top-4 z-10 w-44 overflow-hidden rounded-md border border-border-strong bg-card/85 shadow-lift backdrop-blur sm:w-60 lg:w-72">
        <div className="relative">
          <video
            ref={videoRef}
            className="h-24 w-full object-cover sm:h-32 lg:h-40"
            src={heroVideo.url}
            poster={heroPoster}
            muted
            loop
            playsInline
            autoPlay={!reduced}
            aria-label="Live field feed from tradesmen on the road"
          />
          <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-sm bg-background/80 px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Live feed
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 px-2.5 py-2">
          <p className="truncate text-[11px] text-muted-foreground">
            Van cam · M60 corridor
          </p>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause live feed" : "Play live feed"}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground hover:brightness-110"
          >
            {playing ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="pointer-events-none relative z-[2] mx-auto max-w-7xl px-5 py-20 sm:py-24 lg:px-8 lg:py-36">
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
        {children && <div className="pointer-events-auto mt-8 max-w-3xl">{children}</div>}

        {/* Hub shortcuts — same panel as clicking a map node */}
        <div className="pointer-events-auto mt-7 flex flex-wrap gap-2">
          {hubs.map((h) => (
            <button
              key={`chip-${h.label}`}
              type="button"
              onClick={() => setSelected(h)}
              aria-pressed={selected?.label === h.label}
              className={`rounded-sm border px-3 py-1.5 font-display text-xs font-semibold backdrop-blur transition-colors ${
                selected?.label === h.label
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border-strong bg-card/80 hover:bg-surface"
              }`}
            >
              {h.label}
              <span className={selected?.label === h.label ? "ml-2" : "ml-2 text-primary"}>{counts[h.label]}</span>
            </button>
          ))}
        </div>

        {/* Hub detail panel */}
        {selected && (
          <div
            role="dialog"
            aria-label={`${selected.label} coverage`}
            className="pointer-events-auto mt-8 max-w-sm rounded-md border border-border-strong bg-card/95 p-5 shadow-lift backdrop-blur animate-fade-in"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> {selected.postcode} coverage
                </p>
                <h2 className="mt-1 text-2xl">{selected.label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close coverage panel"
                className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Live now</dt>
                <dd className="font-display text-xl text-primary">
                  {counts[selected.label]}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last update</dt>
                <dd className="font-display text-xl">
                  {updatedAt ? relTime(updatedAt, now) : "—"}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* GPS consent / opt-out */}
        <div className="pointer-events-auto mt-8 max-w-xl">
          {consent === "unknown" ? (
            <div className="rounded-md border border-border-strong bg-card/95 p-5 shadow-lift backdrop-blur">
              <p className="eyebrow flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" /> Privacy
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                We can plot your live position on the map to show trades working
                near you. Your location stays in this browser — it's never sent
                to us or stored. The map works fine without it.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={allow}
                  className="rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:brightness-110"
                >
                  Use my location
                </button>
                <button
                  type="button"
                  onClick={deny}
                  className="rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:bg-surface"
                >
                  No thanks
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/80 px-4 py-3 text-sm backdrop-blur">
              <span className="text-muted-foreground">
                {consent === "granted"
                  ? error
                    ? `Live GPS unavailable: ${error}`
                    : fix
                      ? `Live GPS on · accurate to ~${Math.round(fix.accuracy)}m · updated ${relTime(fix.at, now)}`
                      : "Live GPS on · waiting for a fix…"
                  : "Live GPS off — showing the standard coverage map."}
              </span>
              <button
                type="button"
                onClick={consent === "granted" ? deny : reset}
                className="ml-auto rounded-sm border border-border-strong px-3 py-1.5 font-display text-xs font-semibold hover:bg-surface"
              >
                {consent === "granted" ? "Turn off GPS" : "Change choice"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
