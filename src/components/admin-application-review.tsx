import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlarmClock, ShieldCheck } from "lucide-react";
import {
  escalateApplication,
  listApplicationDocuments,
  requestApplicationChanges,
  reviewApplicationDocument,
  runApplicationVerification,
  type ProApplication,
} from "@/lib/applications.functions";
import {
  CHECK_OUTCOME_LABEL,
  DOCUMENT_KIND_LABEL,
  DOCUMENT_STATUS_LABEL,
  REQUESTABLE_FIELDS,
  formatBytes,
  type VerificationResult,
} from "@/lib/application-verification";

const outcomeClass: Record<string, string> = {
  pass: "text-success",
  warn: "text-primary",
  fail: "text-destructive",
  unchecked: "text-muted-foreground",
};

const btn =
  "rounded-sm border border-border-strong px-3 py-2 font-display text-xs font-semibold uppercase tracking-widest hover:border-primary hover:text-primary disabled:opacity-50";

export function AdminApplicationReview({
  application,
  notify,
  onChanged,
}: {
  application: ProApplication;
  notify: boolean;
  onChanged: () => void;
}) {
  const loadDocs = useServerFn(listApplicationDocuments);
  const reviewDoc = useServerFn(reviewApplicationDocument);
  const verify = useServerFn(runApplicationVerification);
  const requestChanges = useServerFn(requestApplicationChanges);
  const escalate = useServerFn(escalateApplication);

  const [fields, setFields] = useState<string[]>(
    application.requested_fields ?? [],
  );
  const [changeNote, setChangeNote] = useState("");
  const [escalationNote, setEscalationNote] = useState("");

  const docs = useQuery({
    queryKey: ["admin-application-docs", application.id],
    queryFn: () => loadDocs({ data: { applicationId: application.id } }),
  });

  const verifyMutation = useMutation({
    mutationFn: () => verify({ data: { id: application.id } }),
    onSuccess: (result: VerificationResult) => {
      toast.success(`Checks complete — ${CHECK_OUTCOME_LABEL[result.overall]}.`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const docMutation = useMutation({
    mutationFn: (vars: { id: string; status: string }) =>
      reviewDoc({ data: vars }),
    onSuccess: () => {
      void docs.refetch();
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changesMutation = useMutation({
    mutationFn: () =>
      requestChanges({
        data: {
          id: application.id,
          fields,
          note: changeNote,
          notify,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r.notified
          ? "Change request sent — the firm has been emailed."
          : "Change request recorded.",
      );
      setChangeNote("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const escalateMutation = useMutation({
    mutationFn: () =>
      escalate({
        data: { id: application.id, note: escalationNote, priority: "urgent", dueInHours: 24 },
      }),
    onSuccess: () => {
      toast.success("Escalated — due within 24 hours.");
      setEscalationNote("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verification = application.verification as
    | VerificationResult
    | Record<string, never>;

  return (
    <div className="mt-5 grid gap-5 border-t border-border pt-5">
      {/* Automated checks */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest">
            Automated checks
          </h3>
          <button
            className={btn}
            disabled={verifyMutation.isPending}
            onClick={() => verifyMutation.mutate()}
          >
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            {verifyMutation.isPending ? "Checking…" : "Run checks"}
          </button>
          {application.verified_at && (
            <span className="text-xs text-muted-foreground">
              Last run {new Date(application.verified_at).toLocaleString("en-GB")}
            </span>
          )}
        </div>
        {"checks" in verification && verification.checks.length > 0 ? (
          <ul className="mt-3 grid gap-1.5 text-sm">
            {verification.checks.map((c) => (
              <li key={c.key} className="flex flex-wrap gap-2">
                <span className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {c.label}
                </span>
                <span className={outcomeClass[c.outcome]}>
                  {CHECK_OUTCOME_LABEL[c.outcome]}
                </span>
                <span className="text-muted-foreground">{c.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No checks run yet.
          </p>
        )}
      </div>

      {/* Documents */}
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest">
          Documents
        </h3>
        <ul className="mt-3 grid gap-2 text-sm">
          {(docs.data ?? []).map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center gap-2 border-b border-border pb-2 last:border-0"
            >
              <span className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {DOCUMENT_KIND_LABEL[doc.kind] ?? doc.kind}
              </span>
              {doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  {doc.file_name}
                </a>
              ) : (
                <span>{doc.file_name}</span>
              )}
              <span className="text-xs text-muted-foreground">
                {formatBytes(doc.size_bytes)} ·{" "}
                {DOCUMENT_STATUS_LABEL[doc.status] ?? doc.status}
              </span>
              <button
                className={`${btn} ml-auto`}
                disabled={docMutation.isPending}
                onClick={() =>
                  docMutation.mutate({ id: doc.id, status: "verified" })
                }
              >
                Verify
              </button>
              <button
                className={btn}
                disabled={docMutation.isPending}
                onClick={() =>
                  docMutation.mutate({ id: doc.id, status: "rejected" })
                }
              >
                Reject
              </button>
            </li>
          ))}
          {(docs.data ?? []).length === 0 && (
            <li className="text-muted-foreground">
              {docs.isPending ? "Loading documents…" : "Nothing uploaded yet."}
            </li>
          )}
        </ul>
      </div>

      {/* Request changes */}
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest">
          Request changes
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {REQUESTABLE_FIELDS.map((f) => {
            const on = fields.includes(f.key);
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setFields((cur) =>
                    on ? cur.filter((k) => k !== f.key) : [...cur, f.key],
                  )
                }
                className={`rounded-sm border px-3 py-1.5 text-xs ${
                  on
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="What exactly is missing?"
            className="w-72 rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            className={btn}
            disabled={changesMutation.isPending || fields.length === 0}
            onClick={() => changesMutation.mutate()}
          >
            {changesMutation.isPending ? "Sending…" : "Ask the firm"}
          </button>
        </div>
      </div>

      {/* Escalation */}
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-widest">
          Escalation
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={escalationNote}
            onChange={(e) => setEscalationNote(e.target.value)}
            placeholder="Why is this stuck?"
            className="w-72 rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            className={btn}
            disabled={escalateMutation.isPending}
            onClick={() => escalateMutation.mutate()}
          >
            <AlarmClock className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            {escalateMutation.isPending ? "Escalating…" : "Escalate (24h)"}
          </button>
          {application.escalated_at && (
            <span className="text-xs text-primary">
              Escalated{" "}
              {new Date(application.escalated_at).toLocaleString("en-GB")}
              {application.escalation_note
                ? ` — ${application.escalation_note}`
                : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
