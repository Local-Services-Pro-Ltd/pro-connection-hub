import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileDown, Printer } from "lucide-react";
import {
  getApplicationEvidencePack,
  type EvidencePack,
} from "@/lib/applications.functions";
import {
  CHECK_OUTCOME_LABEL,
  DOCUMENT_KIND_LABEL,
  DOCUMENT_STATUS_LABEL,
  formatBytes,
} from "@/lib/application-verification";

const btn =
  "rounded-sm border border-border-strong px-3 py-2 font-display text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-50";

function csvCell(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function buildCsv(pack: EvidencePack) {
  const rows: string[][] = [["Section", "Field", "Value", "Detail", "Recorded"]];
  const a = pack.application;
  const detail: Array<[string, unknown]> = [
    ["Reference", a.reference],
    ["Company", a.company],
    ["Contact", a.contact_name],
    ["Email", a.email],
    ["Phone", a.phone],
    ["Trade", a.trade_slug],
    ["Postcode", a.postcode],
    ["Years trading", a.years],
    ["Website", a.website],
    ["Companies House", a.companies_house],
    ["Insurer", a.insurance_provider],
    ["Insurance expiry", a.insurance_expiry],
    ["Accreditations", a.accreditations],
    ["Status", a.status],
    ["Priority", a.priority],
    ["Submitted", a.created_at],
    ["Decided", a.reviewed_at],
    ["Checks last run", a.verified_at],
  ];
  for (const [field, value] of detail)
    rows.push(["Application", field, String(value ?? ""), "", ""]);

  for (const check of pack.verification?.checks ?? [])
    rows.push([
      "Automated check",
      check.label,
      CHECK_OUTCOME_LABEL[check.outcome],
      check.detail,
      pack.verification?.checked_at ?? "",
    ]);

  for (const doc of pack.documents)
    rows.push([
      "Document",
      DOCUMENT_KIND_LABEL[doc.kind] ?? doc.kind,
      DOCUMENT_STATUS_LABEL[doc.status] ?? doc.status,
      `${doc.file_name} (${formatBytes(doc.size_bytes)})${doc.reviewer_note ? ` — ${doc.reviewer_note}` : ""}`,
      doc.created_at,
    ]);

  for (const event of pack.timeline)
    rows.push([
      "Timeline",
      event.action,
      event.to_status,
      `${event.reviewer_note ?? ""}${event.changed_by_email ? ` — ${event.changed_by_email}` : ""}`,
      event.created_at,
    ]);

  for (const reminder of pack.reminders)
    rows.push([
      "Reminder",
      reminder.kind,
      "sent",
      reminder.detail ?? "",
      reminder.created_at,
    ]);

  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function buildHtml(pack: EvidencePack) {
  const a = pack.application;
  const esc = (v: unknown) =>
    String(v ?? "—").replace(/[<>&]/g, (c) =>
      c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
    );
  const section = (title: string, body: string) =>
    `<h2>${title}</h2>${body}`;
  const rows = (items: string[][]) =>
    `<table><tbody>${items
      .map(
        (r) =>
          `<tr>${r.map((c, i) => `<td class="${i === 0 ? "k" : ""}">${esc(c)}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody></table>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Verification evidence — ${esc(a.company)} (${esc(a.reference)})</title>
<style>
 body{font:14px/1.5 Helvetica,Arial,sans-serif;color:#111;margin:32px;max-width:820px}
 h1{font-size:22px;margin:0 0 4px} h2{font-size:14px;text-transform:uppercase;letter-spacing:1.5px;margin:28px 0 8px}
 table{border-collapse:collapse;width:100%} td{border-bottom:1px solid #ddd;padding:6px 8px;vertical-align:top}
 td.k{width:210px;color:#555} .meta{color:#666;font-size:12px}
</style></head><body>
<h1>Verification evidence pack</h1>
<p class="meta">${esc(a.company)} · ${esc(a.reference)} · generated ${new Date(pack.generated_at).toLocaleString("en-GB")}</p>
${section(
  "Application",
  rows([
    ["Contact", `${a.contact_name} · ${a.email}${a.phone ? ` · ${a.phone}` : ""}`],
    ["Trade / area", `${a.trade_slug ?? "—"} · ${a.postcode}`],
    ["Years trading", String(a.years)],
    ["Companies House", a.companies_house ?? "—"],
    ["Insurance", `${a.insurance_provider ?? "—"} · expires ${a.insurance_expiry ?? "—"}`],
    ["Accreditations", a.accreditations ?? "—"],
    ["Status", `${a.status} (${a.priority} priority)`],
    ["Submitted", new Date(a.created_at).toLocaleString("en-GB")],
    ["Decided", a.reviewed_at ? new Date(a.reviewed_at).toLocaleString("en-GB") : "—"],
  ]),
)}
${section(
  "Automated checks",
  pack.verification
    ? rows(
        pack.verification.checks.map((c) => [
          c.label,
          `${CHECK_OUTCOME_LABEL[c.outcome]} — ${c.detail}`,
        ]),
      )
    : "<p>No checks recorded.</p>",
)}
${section(
  "Documents",
  pack.documents.length
    ? rows(
        pack.documents.map((d) => [
          DOCUMENT_KIND_LABEL[d.kind] ?? d.kind,
          `${d.file_name} (${formatBytes(d.size_bytes)}) — ${DOCUMENT_STATUS_LABEL[d.status] ?? d.status}${d.reviewer_note ? ` — ${d.reviewer_note}` : ""}`,
        ]),
      )
    : "<p>No documents on file.</p>",
)}
${section(
  "Timeline",
  rows(
    pack.timeline.map((e) => [
      new Date(e.created_at).toLocaleString("en-GB"),
      `${e.action} → ${e.to_status}${e.reviewer_note ? ` — ${e.reviewer_note}` : ""}${e.changed_by_email ? ` (${e.changed_by_email})` : ""}`,
    ]),
  ),
)}
${section(
  "Reminders sent",
  pack.reminders.length
    ? rows(
        pack.reminders.map((r) => [
          new Date(r.created_at).toLocaleString("en-GB"),
          `${r.kind}${r.detail ? ` — ${r.detail}` : ""}`,
        ]),
      )
    : "<p>None.</p>",
)}
</body></html>`;
}

/** Admin-only CSV / print-to-PDF export of one application's evidence. */
export function EvidencePackExport({
  applicationId,
  reference,
}: {
  applicationId: string;
  reference: string | null;
}) {
  const load = useServerFn(getApplicationEvidencePack);
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);

  async function get() {
    return (await load({ data: { id: applicationId } })) as EvidencePack;
  }

  async function exportCsv() {
    setBusy("csv");
    try {
      const pack = await get();
      const blob = new Blob([buildCsv(pack)], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `evidence-${reference ?? applicationId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy("pdf");
    try {
      const pack = await get();
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Allow pop-ups to open the printable evidence pack.");
        return;
      }
      win.document.write(buildHtml(pack));
      win.document.close();
      win.focus();
      win.print();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={btn} disabled={busy !== null} onClick={exportCsv}>
        <FileDown className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
        {busy === "csv" ? "Building…" : "Evidence CSV"}
      </button>
      <button className={btn} disabled={busy !== null} onClick={exportPdf}>
        <Printer className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
        {busy === "pdf" ? "Building…" : "Evidence PDF"}
      </button>
    </div>
  );
}
