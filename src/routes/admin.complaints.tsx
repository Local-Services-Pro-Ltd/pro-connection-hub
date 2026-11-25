import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Section, SectionHead } from "@/components/layout-bits";
import { useAuth } from "@/hooks/use-auth";
import { isAdminQuery } from "@/lib/queries";
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUS_LABEL } from "@/lib/after-job.shared";
import {
  adminListComplaints,
  adminUpdateComplaint,
  type AdminComplaint,
} from "@/lib/complaints.functions";

export const Route = createFileRoute("/admin/complaints")({
  head: () => ({
    meta: [
      { title: "Complaints — admin | TradesmanFinder" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminComplaints,
});

const field =
  "mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

function AdminComplaints() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending } = useQuery({ ...isAdminQuery(user?.id), enabled: !loading });

  if (loading || (user && isPending)) {
    return (
      <Section>
        <p className="text-muted-foreground">Checking your access…</p>
      </Section>
    );
  }
  if (!user || !isAdmin) {
    return (
      <Section>
        <div className="max-w-xl rounded-md border border-border bg-card p-8">
          <h1 className="text-2xl">{user ? "Admins only" : "Sign in required"}</h1>
          <p className="mt-3 text-muted-foreground">
            {user
              ? "Your account does not hold the admin role."
              : "The admin area is only open to signed-in admins."}
          </p>
          {!user && (
            <Link
              to="/signin"
              search={{ redirect: "/admin/complaints" }}
              className="mt-6 inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
            >
              Sign in
            </Link>
          )}
        </div>
      </Section>
    );
  }
  return <Queue />;
}

function Queue() {
  const {
    data: complaints,
    isPending,
    error,
  } = useQuery({ queryKey: ["admin", "complaints"], queryFn: () => adminListComplaints() });
  const open = (complaints ?? []).filter((c) => ["received", "firm_asked"].includes(c.status));

  return (
    <Section>
      <Link to="/admin" className="text-sm text-primary hover:underline">
        ← Admin home
      </Link>
      <div className="mt-4">
        <SectionHead
          eyebrow="Admin"
          title="Complaints"
          sub="The published process: acknowledge within 2 working days, ask the firm to respond within 5 working days, then tell the homeowner the outcome. The homeowner is emailed an acknowledgement automatically."
        />
      </div>
      {isPending ? (
        <p className="mt-8 text-muted-foreground">Loading complaints…</p>
      ) : error ? (
        <p role="alert" className="mt-8 text-muted-foreground">
          {error.message}
        </p>
      ) : complaints.length === 0 ? (
        <p className="mt-8 text-muted-foreground">No problems have been reported.</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {open.length} open · {complaints.length} in total
          </p>
          <ul className="mt-4 grid gap-4">
            {complaints.map((complaint) => (
              <ComplaintRow key={complaint.id} complaint={complaint} />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function ComplaintRow({ complaint }: { complaint: AdminComplaint }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(complaint.status);
  const [firmResponse, setFirmResponse] = useState(complaint.firm_response ?? "");
  const [adminNotes, setAdminNotes] = useState(complaint.admin_notes ?? "");
  const [resolution, setResolution] = useState(complaint.resolution ?? "");
  const save = useMutation({
    mutationFn: (askFirm: boolean) =>
      adminUpdateComplaint({
        data: { id: complaint.id, status, firmResponse, adminNotes, resolution, askFirm },
      }),
    onSuccess: async (result) => {
      toast.success(
        result.asked
          ? result.emailedFirm
            ? "Saved, and the firm has been emailed."
            : "Saved, but the firm has no email address on file. Contact it another way."
          : "Saved",
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "complaints"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const category =
    COMPLAINT_CATEGORIES.find((item) => item.value === complaint.category)?.label ??
    complaint.category;

  return (
    <li className="rounded-md border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg">
            {complaint.reference} · {complaint.company}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Job {complaint.job_reference ?? "removed"} · reported{" "}
            {new Date(complaint.created_at).toLocaleDateString("en-GB")} by {complaint.contact_name}{" "}
            (
            <a href={`mailto:${complaint.contact_email}`} className="text-primary hover:underline">
              {complaint.contact_email}
            </a>
            )
          </p>
        </div>
        <span className="rounded-sm border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {COMPLAINT_STATUS_LABEL[complaint.status]}
        </span>
      </div>
      <p className="mt-4 text-sm font-medium">{category}</p>
      <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">
        {complaint.description}
      </p>
      {complaint.desired_outcome ? (
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">They would like: </span>
          {complaint.desired_outcome}
        </p>
      ) : null}
      {complaint.firm_asked_at ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Firm asked to respond on {new Date(complaint.firm_asked_at).toLocaleDateString("en-GB")}.
        </p>
      ) : null}

      <form
        className="mt-5 grid gap-4 border-t border-border pt-5"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(false);
        }}
      >
        <label>
          <span className="text-sm font-medium">The firm's response (paste it in here)</span>
          <textarea
            rows={3}
            maxLength={4000}
            value={firmResponse}
            onChange={(event) => setFirmResponse(event.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className="text-sm font-medium">Your notes (private)</span>
          <textarea
            rows={2}
            maxLength={4000}
            value={adminNotes}
            onChange={(event) => setAdminNotes(event.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className="text-sm font-medium">
            Outcome (needed before resolving or closing; tell the homeowner the same)
          </span>
          <textarea
            rows={2}
            maxLength={2000}
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            className={field}
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className="text-sm font-medium">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as AdminComplaint["status"])}
              className={field}
            >
              {Object.entries(COMPLAINT_STATUS_LABEL).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
          >
            Save
          </button>
          {complaint.status === "received" && complaint.pro_id && (
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate(true)}
              className="rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
            >
              Email the firm and ask it to respond
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Asking the firm sends it the homeowner's description, not their contact details. The
          outcome is not emailed automatically: write to the homeowner yourself once you have
          decided.
        </p>
      </form>
    </li>
  );
}
