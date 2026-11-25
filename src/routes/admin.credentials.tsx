import { createFileRoute, Link } from "@tanstack/react-router";
import {
  adminDocumentLink,
  adminListPendingDocuments,
  adminReviewDocument,
} from "@/lib/firm-documents.functions";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CircleAlert, Clock3, Lock, Plus } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { useAuth } from "@/hooks/use-auth";
import { adminProsQuery, isAdminQuery, type Credential } from "@/lib/queries";
import {
  adminAddCredential,
  adminListCredentials,
  adminSetCredentialVerified,
} from "@/lib/credential-admin.functions";
import { CREDENTIAL_KINDS, REGISTERS, credentialState, type CredentialKind } from "@/lib/registers";

export const Route = createFileRoute("/admin/credentials")({
  head: () => ({
    meta: [
      { title: "Firm credentials — admin | TradesmanFinder" },
      {
        name: "description",
        content: "Add firm credentials and record official-register verification checks.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: ({ error }) => (
    <Section>
      <p role="alert" className="text-muted-foreground">
        {error.message}
      </p>
    </Section>
  ),
  component: AdminCredentials,
});

function Locked({ title, body }: { title: string; body: string }) {
  return (
    <Section>
      <div className="mx-auto max-w-lg rounded-md border border-border bg-card p-10 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-sm bg-primary/15">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mt-6 text-2xl">{title}</h1>
        <p className="mt-3 text-muted-foreground">{body}</p>
        <Link
          to="/signin"
          search={{}}
          className="mt-6 inline-flex rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
        >
          Sign in
        </Link>
      </div>
    </Section>
  );
}

function AdminCredentials() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isPending: checkingRole } = useQuery({
    ...isAdminQuery(user?.id),
    enabled: !loading,
  });

  if (loading || (user && checkingRole)) {
    return (
      <Section>
        <p className="text-muted-foreground">Checking your access…</p>
      </Section>
    );
  }
  if (!user) {
    return (
      <Locked
        title="Admin sign-in required"
        body="Sign in with your admin account to manage firm credentials."
      />
    );
  }
  if (!isAdmin) {
    return (
      <Locked
        title="Not an admin account"
        body="This account doesn't have admin access. Credential checks are restricted to site admins."
      />
    );
  }
  return <CredentialManager />;
}

function CredentialManager() {
  const { data: pros, isPending } = useQuery(adminProsQuery);
  const [proId, setProId] = useState("");
  const active = (pros ?? []).find((pro) => pro.id === proId) ?? null;

  return (
    <Section>
      <SectionHead
        eyebrow="Admin"
        title="Firm credentials"
        sub="Add the credentials a firm has supplied, then record when each official-register check is complete."
      />
      <PendingDocuments onOpenFirm={setProId} />
      <label className="mt-10 block max-w-xl">
        <span className="eyebrow">Tradesperson</span>
        <select
          value={proId}
          onChange={(event) => setProId(event.target.value)}
          disabled={isPending}
          className="mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-3 text-sm"
        >
          <option value="">Choose a listing…</option>
          {(pros ?? []).map((pro) => (
            <option key={pro.id} value={pro.id}>
              {pro.company} — {pro.name} ({pro.published ? "published" : "draft"})
            </option>
          ))}
        </select>
      </label>
      {active && <CredentialEditor key={active.id} proId={active.id} company={active.company} />}
    </Section>
  );
}

function CredentialEditor({ proId, company }: { proId: string; company: string }) {
  const queryClient = useQueryClient();
  const { data: credentials, isPending } = useQuery({
    queryKey: ["admin", "credentials", proId],
    queryFn: () => adminListCredentials({ data: { proId } }),
  });
  const [kind, setKind] = useState<CredentialKind>("companies_house");
  const [label, setLabel] = useState(REGISTERS.companies_house.label);
  const [reference, setReference] = useState("");
  const [expiresOn, setExpiresOn] = useState("");

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "credentials", proId] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "pros"] }),
      queryClient.invalidateQueries({ queryKey: ["pro-trust"] }),
      queryClient.invalidateQueries({ queryKey: ["pro", proId] }),
    ]);
  };

  const add = useMutation({
    mutationFn: () =>
      adminAddCredential({
        data: { proId, kind, label, reference, expiresOn },
      }),
    onSuccess: async () => {
      setReference("");
      setExpiresOn("");
      await refresh();
      toast.success("Credential added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const verify = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) =>
      adminSetCredentialVerified({ data: { id, verified } }),
    onSuccess: async (credential) => {
      await refresh();
      toast.success(credential.verified ? "Credential verified" : "Credential unverified");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function changeKind(next: CredentialKind) {
    setLabel((current) => (current === REGISTERS[kind].label ? REGISTERS[next].label : current));
    setKind(next);
  }

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <h2 className="text-2xl">Checks for {company}</h2>
        {isPending ? (
          <p className="mt-5 text-sm text-muted-foreground">Loading credentials…</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {(credentials ?? []).map((credential) => (
              <CredentialRow
                key={credential.id}
                credential={credential}
                busy={verify.isPending}
                onToggle={(verified) => verify.mutate({ id: credential.id, verified })}
              />
            ))}
            {(credentials ?? []).length === 0 && (
              <li className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
                No credentials yet for this firm.
              </li>
            )}
          </ul>
        )}
      </div>

      <form
        className="h-fit rounded-md border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <h2 className="text-xl">Add a credential</h2>
        <label className="mt-5 block text-sm">
          Kind
          <select
            value={kind}
            onChange={(event) => changeKind(event.target.value as CredentialKind)}
            className="mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-3 text-sm"
          >
            {CREDENTIAL_KINDS.map((value) => (
              <option key={value} value={value}>
                {REGISTERS[value].label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm">
          Label
          <input
            required
            maxLength={160}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-3 text-sm"
          />
        </label>
        <label className="mt-4 block text-sm">
          Reference
          <input
            maxLength={120}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-3 text-sm"
          />
        </label>
        <label className="mt-4 block text-sm">
          Expiry date
          <input
            type="date"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
            className="mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-3 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={add.isPending}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {add.isPending ? "Adding…" : "Add credential"}
        </button>
      </form>
    </div>
  );
}

function CredentialRow({
  credential,
  busy,
  onToggle,
}: {
  credential: Credential;
  busy: boolean;
  onToggle: (verified: boolean) => void;
}) {
  const state = credentialState(credential);
  const Icon = state === "verified" ? Check : state === "expired" ? CircleAlert : Clock3;
  return (
    <li className="rounded-md border border-border bg-card p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
      <div>
        <div className="flex items-center gap-2">
          <Icon
            className={`h-4 w-4 ${
              state === "verified"
                ? "text-success"
                : state === "expired"
                  ? "text-primary"
                  : "text-muted-foreground"
            }`}
            aria-hidden="true"
          />
          <h3 className="font-display font-semibold">{credential.label}</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {REGISTERS[credential.kind as CredentialKind]?.label ?? credential.kind} · {state}
          {credential.reference ? ` · Ref ${credential.reference}` : ""}
          {credential.expires_on ? ` · Expires ${credential.expires_on}` : ""}
        </p>
        {credential.verified_at && (
          <p className="mt-1 text-xs text-muted-foreground">
            Verification recorded {new Date(credential.verified_at).toLocaleString("en-GB")}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => onToggle(!credential.verified)}
        className="mt-4 inline-flex h-10 shrink-0 items-center rounded-sm border border-border-strong px-4 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60 sm:mt-0"
      >
        {credential.verified ? "Unverify" : "Verify"}
      </button>
    </li>
  );
}

/** What firms have sent from their dashboards and nobody has checked yet. */
function PendingDocuments({ onOpenFirm }: { onOpenFirm: (proId: string) => void }) {
  const queryClient = useQueryClient();
  const { data: pending, isPending } = useQuery({
    queryKey: ["admin", "pending-documents"],
    queryFn: () => adminListPendingDocuments(),
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const openDocument = useMutation({
    mutationFn: (id: string) => adminDocumentLink({ data: { id } }),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener"),
    onError: (error: Error) => toast.error(error.message),
  });
  const review = useMutation({
    mutationFn: (input: { id: string; decision: "verify" | "return" }) =>
      adminReviewDocument({ data: { ...input, note: notes[input.id] ?? "" } }),
    onSuccess: async (result) => {
      toast.success(
        `${result.verified ? "Marked as checked" : "Sent back to the firm"}. ${
          result.emailed ? "The firm has been emailed." : "The firm has no email address on file."
        }`,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "pending-documents"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "credentials"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-8">
      <h2 className="text-2xl">Sent by firms, waiting for a check</h2>
      {isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : (pending ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing is waiting.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {(pending ?? []).map((doc) => (
            <li key={doc.id} className="rounded-md border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-semibold">
                    {doc.company} · {doc.label}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {doc.reference ? `Number ${doc.reference} · ` : ""}
                    {doc.expires_on ? `Expires ${doc.expires_on} · ` : ""}
                    {doc.submitted_at
                      ? `Sent ${new Date(doc.submitted_at).toLocaleDateString("en-GB")}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenFirm(doc.pro_id)}
                  className="text-sm text-primary underline underline-offset-4"
                >
                  All checks for this firm
                </button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {doc.kind === "insurance"
                  ? "Open the certificate and confirm the firm's name, that it is public liability cover, and that the expiry date matches."
                  : "Look the number up on the official register and confirm it belongs to this firm and is current."}
              </p>
              <label className="mt-3 block text-sm">
                <span className="text-muted-foreground">
                  If you send it back, tell the firm what to put right
                </span>
                <textarea
                  rows={2}
                  maxLength={600}
                  value={notes[doc.id] ?? ""}
                  onChange={(event) =>
                    setNotes((all) => ({ ...all, [doc.id]: event.target.value }))
                  }
                  className="mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-3">
                {doc.has_document && (
                  <button
                    type="button"
                    disabled={openDocument.isPending}
                    onClick={() => openDocument.mutate(doc.id)}
                    className="rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
                  >
                    Open the document
                  </button>
                )}
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: doc.id, decision: "verify" })}
                  className="rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
                >
                  Mark as checked
                </button>
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: doc.id, decision: "return" })}
                  className="rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  Send back
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
