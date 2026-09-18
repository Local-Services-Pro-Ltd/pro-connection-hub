/**
 * TradesmanFinder brand mark: a "TF" monogram where the T's crossbar ends in
 * an open spanner jaw, on the site's ember square, with a blue dot.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="TradesmanFinder"
      className={className}
    >
      <defs>
        <mask id="tf-spanner-jaw">
          <rect x="0" y="0" width="64" height="64" fill="white" />
          {/* Open jaw: a round hole plus the slot that opens it to the left. */}
          <circle cx="13" cy="20.5" r="3.6" fill="black" />
          <rect x="1" y="17.6" width="12" height="5.8" fill="black" />
        </mask>
      </defs>

      <rect
        x="0"
        y="0"
        width="64"
        height="64"
        rx="14"
        className="fill-primary"
      />

      <g className="fill-primary-foreground" mask="url(#tf-spanner-jaw)">
        {/* Spanner head on the left tip of the T crossbar */}
        <circle cx="13" cy="20.5" r="7.4" />
        {/* T */}
        <rect x="11" y="15.5" width="26" height="10" />
        <rect x="19" y="15.5" width="10" height="33" />
        {/* F */}
        <rect x="39" y="15.5" width="18" height="10" />
        <rect x="39" y="15.5" width="9.5" height="33" />
        <rect x="39" y="29" width="14.5" height="8.5" />
      </g>

      <circle cx="51" cy="48" r="6" fill="var(--brand-blue)" />
    </svg>
  );
}
