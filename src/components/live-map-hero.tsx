import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Pause,
  Play,
  MapPin,
  X,
  ShieldCheck,
  History,
  Link2,
  Check,
  Radio,
  Download,
  Trash2,
} from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useGpsConsent } from "@/hooks/use-gps-consent";
import { useHubCounts } from "@/hooks/use-hub-counts";
import { encodeShare, SHARE_DURATIONS } from "@/lib/share-position";
import {
  accuracyBand,
  downloadText,
  toGpx,
  toKml,
} from "@/lib/track-export";
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
  const { consent, fix, smoothed, track, error, allow, deny, reset } =
    useGpsConsent();

  // Live hub counts over a realtime WebSocket channel.
  const { counts, updatedAt, connected } = useHubCounts(
    Object.fromEntries(hubs.map((h) => [h.label, h.live])),
  );
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState<Hub | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // ---- 30-minute replay timeline -------------------------------------
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!replaying || track.length < 2) return;
    const id = setInterval(() => {
      setReplayIdx((i) => {
        const next = (i ?? -1) + 1;
        if (next >= track.length - 1) {
          setReplaying(false);
          return track.length - 1;
        }
        return next;
      });
    }, 600 / speed);
    return () => clearInterval(id);
  }, [replaying, track.length, speed]);

  const replayPoint =
    replayIdx !== null ? (track[Math.min(replayIdx, track.length - 1)] ?? null) : null;

  function exportTrack(kind: "gpx" | "kml") {
    if (track.length < 2) return;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    if (kind === "gpx") {
      downloadText(
        `tradesman-finder-track-${stamp}.gpx`,
        "application/gpx+xml",
        toGpx(track),
      );
    } else {
      downloadText(
        `tradesman-finder-track-${stamp}.kml`,
        "application/vnd.google-earth.kml+xml",
        toKml(track),
      );
    }
  }

  // ---- Temporary share link -------------------------------------------
  const [share, setShare] = useState<{ url: string; exp: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [shareMs, setShareMs] = useState<number>(SHARE_DURATIONS[1].ms);

  useEffect(() => {
    if (!share) return;
    if (now && now >= share.exp) setShare(null);
  }, [now, share]);

  function makeShareLink() {
    if (!fix) return;
    const exp = Date.now() + shareMs;
    const token = encodeShare({ lat: fix.lat, lon: fix.lon, exp });
    const url = `${window.location.origin}/areas?live=${token}`;
    setShare({ url, exp });
    setCopied(false);
    setRevoked(false);
    void navigator.clipboard
      ?.writeText(url)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  }

  function revokeShareLink() {
    setShare(null);
    setCopied(false);
    setRevoked(true);
  }

  function countdown(ms: number) {
    const total = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
      ? `${h}h ${String(m).padStart(2, "0")}m`
      : `${m}:${String(s).padStart(2, "0")}`;
  }



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

  const shown = smoothed ?? fix;
  const me = shown ? project(shown.lat, shown.lon) : null;
  const band = fix ? accuracyBand(fix.accuracy) : null;
  // Accuracy halo in viewBox units (~0.00088 units per metre), kept visible.
  const accuracyR = fix ? Math.min(90, Math.max(26, fix.accuracy * 0.00088 + 26)) : 0;
  const trackPts = track.map((f) => project(f.lat, f.lon));
  const trackPath = trackPts.length > 1 ? `M ${trackPts.map((p) => `${p.x} ${p.y}`).join(" L ")}` : null;
  const ghost = replayPoint ? project(replayPoint.lat, replayPoint.lon) : null;


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
            aria-pressed={selected?.label === h.label}
            aria-label={`${h.label} coverage hub: ${counts[h.label]} tradesmen live now. Activate to open coverage details.`}
            className="pointer-events-auto cursor-pointer [&:focus-visible_.hub-ring]:opacity-100"
            onClick={() => setSelected(h)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelected(h);
              }
            }}
          >
            <circle
              cx={h.x}
              cy={h.y}
              r="26"
              className="hub-ring fill-none stroke-accent opacity-0"
              strokeWidth="4"
              strokeDasharray="6 6"
            />

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

        {/* Last 30 minutes of movement */}
        {trackPath && (
          <path
            d={trackPath}
            fill="none"
            className="stroke-accent"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="10 10"
            opacity="0.55"
          />
        )}

        {/* Replay ghost */}
        {ghost && (
          <g>
            <circle cx={ghost.x} cy={ghost.y} r="20" className="fill-accent" opacity="0.25" />
            <circle cx={ghost.x} cy={ghost.y} r="9" className="fill-accent" />
            <text
              x={ghost.x + 18}
              y={ghost.y - 14}
              className="fill-foreground font-display"
              fontSize="15"
              fontWeight="600"
            >
              Replay
            </text>
          </g>
        )}

        {/* Your live GPS position */}

        {me && (
          <g
            style={{
              transform: `translate(${me.x}px, ${me.y}px)`,
              transition: reduced ? undefined : "transform 900ms ease-out",
            }}
          >
            {/* Accuracy halo — bigger circle means a less certain fix */}
            <circle
              r={accuracyR}
              className="fill-accent stroke-accent"
              strokeWidth="2"
              opacity="0.16"
              style={{ transition: reduced ? undefined : "r 900ms ease-out" }}
            />
            {!reduced && (
              <circle
                r="24"
                className="fill-none stroke-accent"
                strokeWidth="3"
                style={{ animation: "map-ping 2.4s ease-out infinite" }}
              />
            )}
            <circle r="11" className="fill-accent" />
            <circle r="4" className="fill-accent-foreground" />
            <text
              x={20}
              y={6}
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
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
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
            aria-pressed={playing}
            aria-label={playing ? "Pause live field feed" : "Play live field feed"}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="sr-only" role="status">
          Live field feed {playing ? "playing" : "paused"}.
        </p>

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
            aria-labelledby="hub-panel-title"
            tabIndex={-1}
            ref={(el) => el?.focus()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelected(null);
            }}
            className="pointer-events-auto mt-8 max-w-sm rounded-md border border-border-strong bg-card/95 p-5 shadow-lift backdrop-blur animate-fade-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" aria-hidden="true" /> {selected.postcode} coverage
                </p>
                <h2 id="hub-panel-title" className="mt-1 text-2xl">
                  {selected.label}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={`Close ${selected.label} coverage panel`}
                className="rounded-sm p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm" aria-live="polite">
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
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Radio className="h-3 w-3" aria-hidden="true" />
              {connected ? "Live over realtime connection" : "Reconnecting…"}
            </p>
          </div>
        )}


        {/* GPS consent / opt-out */}
        <div className="pointer-events-auto mt-8 max-w-xl">
          {consent === "unknown" ? (
            <section
              aria-labelledby="gps-consent-title"
              className="rounded-md border border-border-strong bg-card/95 p-5 shadow-lift backdrop-blur"
            >
              <p id="gps-consent-title" className="eyebrow flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Privacy — location consent
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
                  className="rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Use my location
                </button>
                <button
                  type="button"
                  onClick={deny}
                  className="rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  No thanks
                </button>
              </div>
            </section>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/80 px-4 py-3 text-sm backdrop-blur">
              {consent === "granted" && band && (
                <span
                  className="flex shrink-0 items-end gap-[3px]"
                  aria-hidden="true"
                  title={`Signal ${band.label}`}
                >
                  {[1, 2, 3].map((b) => (
                    <span
                      key={b}
                      className={`w-1 rounded-[1px] ${
                        b <= band.bars
                          ? band.tone === "good"
                            ? "bg-primary"
                            : band.tone === "fair"
                              ? "bg-accent"
                              : "bg-muted-foreground"
                          : "bg-border-strong"
                      }`}
                      style={{ height: `${5 + b * 4}px` }}
                    />
                  ))}
                </span>
              )}
              <span className="text-muted-foreground" role="status">
                {consent === "granted"
                  ? error
                    ? `Live GPS unavailable: ${error}`
                    : fix && band
                      ? `Live GPS on · ${band.label} signal · accurate to ~${Math.round(fix.accuracy)}m · smoothed marker · updated ${relTime(fix.at, now)}`
                      : "Live GPS on · waiting for a fix…"
                  : "Live GPS off — showing the standard coverage map."}
              </span>
              <button
                type="button"
                onClick={consent === "granted" ? deny : reset}
                className="ml-auto rounded-sm border border-border-strong px-3 py-1.5 font-display text-xs font-semibold hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {consent === "granted" ? "Turn off GPS" : "Change choice"}
              </button>
            </div>
          )}
        </div>

        {/* Replay timeline + share link */}
        {consent === "granted" && (
          <div className="pointer-events-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
            <section
              aria-labelledby="replay-title"
              className="rounded-md border border-border-strong bg-card/90 p-4 backdrop-blur"
            >
              <p id="replay-title" className="eyebrow flex items-center gap-1.5">
                <History className="h-3 w-3" aria-hidden="true" /> Replay last 30 minutes
              </p>
              {track.length < 2 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Collecting your movement — the replay unlocks once we have a
                  couple of fixes.
                </p>
              ) : (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (replaying) return setReplaying(false);
                        setReplayIdx((i) =>
                          i === null || i >= track.length - 1 ? 0 : i,
                        );
                        setReplaying(true);
                      }}
                      aria-pressed={replaying}
                      aria-label={replaying ? "Pause GPS replay" : "Play GPS replay"}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {replaying ? (
                        <Pause className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Play className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={track.length - 1}
                      step={1}
                      value={replayIdx ?? track.length - 1}
                      onChange={(e) => {
                        setReplaying(false);
                        setReplayIdx(Number(e.target.value));
                      }}
                      aria-label="Scrub through your recorded GPS positions"
                      aria-valuetext={
                        replayPoint
                          ? `Position from ${relTime(replayPoint.at, now || Date.now())}`
                          : "Latest position"
                      }
                      className="h-2 w-full cursor-pointer accent-[var(--color-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReplaying(false);
                        setReplayIdx(null);
                      }}
                      className="shrink-0 rounded-sm border border-border-strong px-2.5 py-1.5 font-display text-xs font-semibold hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      Live
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className="text-xs text-muted-foreground"
                      id="replay-speed-label"
                    >
                      Speed
                    </span>
                    <div
                      role="group"
                      aria-labelledby="replay-speed-label"
                      className="flex overflow-hidden rounded-sm border border-border-strong"
                    >
                      {[0.5, 1, 2].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSpeed(s)}
                          aria-pressed={speed === s}
                          aria-label={`Play replay at ${s} times speed`}
                          className={`px-2.5 py-1.5 font-display text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                            speed === s
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-surface"
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => exportTrack("gpx")}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-border-strong px-2.5 py-1.5 font-display text-xs font-semibold hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      GPX
                    </button>
                    <button
                      type="button"
                      onClick={() => exportTrack("kml")}
                      className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong px-2.5 py-1.5 font-display text-xs font-semibold hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      KML
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground" role="status">
                    {replayPoint
                      ? `Showing position from ${relTime(replayPoint.at, now || Date.now())} · ${track.length} fixes recorded · ${speed}x`
                      : `Following your live position · ${track.length} fixes recorded · ${speed}x`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Download the last 30 minutes as GPX or KML for maps and
                    route apps.
                  </p>
                </>
              )}
            </section>

            <section
              aria-labelledby="share-title"
              className="rounded-md border border-border-strong bg-card/90 p-4 backdrop-blur"
            >
              <p id="share-title" className="eyebrow flex items-center gap-1.5">
                <Link2 className="h-3 w-3" aria-hidden="true" /> Temporary share link
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="share-expiry">
                  Share link expiry
                </label>
                <select
                  id="share-expiry"
                  value={shareMs}
                  onChange={(e) => setShareMs(Number(e.target.value))}
                  className="rounded-sm border border-border-strong bg-surface px-2.5 py-2 font-display text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {SHARE_DURATIONS.map((d) => (
                    <option key={d.ms} value={d.ms}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={makeShareLink}
                  disabled={!fix}
                  className="inline-flex items-center gap-2 rounded-sm bg-primary px-3.5 py-2 font-display text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {copied ? "Link copied" : share ? "New link" : "Generate link"}
                </button>
                {share && (
                  <button
                    type="button"
                    onClick={revokeShareLink}
                    aria-label="Revoke the share link now"
                    className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong px-3 py-2 font-display text-xs font-semibold hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Revoke now
                  </button>
                )}
              </div>
              {share && (
                <p className="mt-3 flex items-center gap-2 text-xs">
                  <span className="rounded-sm bg-surface px-2 py-1 font-display font-semibold text-primary tabular-nums">
                    {countdown(share.exp - (now || Date.now()))}
                  </span>
                  <span className="text-muted-foreground">
                    remaining · expires{" "}
                    {new Date(share.exp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
              )}
              <p className="mt-2 break-all text-xs text-muted-foreground" role="status">
                {!fix
                  ? "Waiting for a GPS fix before a link can be created."
                  : share
                    ? share.url
                    : revoked
                      ? "Share link revoked — the old link no longer opens your position."
                      : "Creates a link that carries your current position and expires automatically. Nothing is stored on our servers."}
              </p>
            </section>
          </div>
        )}

      </div>
    </div>
  );
}
