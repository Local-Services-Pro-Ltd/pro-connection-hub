import type { GpsFix } from "@/hooks/use-gps-consent";

function iso(ts: number) {
  return new Date(ts).toISOString();
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function toGpx(track: GpsFix[], name = "Last 30 minutes"): string {
  const pts = track
    .map(
      (f) =>
        `      <trkpt lat="${f.lat.toFixed(6)}" lon="${f.lon.toFixed(6)}">\n` +
        `        <time>${iso(f.at)}</time>\n` +
        `        <hdop>${(f.accuracy / 5).toFixed(2)}</hdop>\n` +
        `      </trkpt>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Tradesman Finder" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name><time>${iso(Date.now())}</time></metadata>
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function toKml(track: GpsFix[], name = "Last 30 minutes"): string {
  const coords = track
    .map((f) => `${f.lon.toFixed(6)},${f.lat.toFixed(6)},0`)
    .join(" ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${esc(name)}</name>
    <Placemark>
      <name>${esc(name)}</name>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>
`;
}

export function downloadText(filename: string, mime: string, text: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function accuracyBand(accuracy: number): {
  label: string;
  tone: "good" | "fair" | "poor";
  bars: number;
} {
  if (accuracy <= 15) return { label: "Strong", tone: "good", bars: 3 };
  if (accuracy <= 50) return { label: "Fair", tone: "fair", bars: 2 };
  return { label: "Weak", tone: "poor", bars: 1 };
}
