import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, CircleAlert, Clock3, FileUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  FIRM_DOCUMENT_KINDS,
  listMyDocuments,
  myDocumentLink,
  submitMyDocument,
  type FirmDocument,
} from "@/lib/firm-documents.functions";
import { REGISTERS, type CredentialKind } from "@/lib/registers";

const card = "rounded-md border border-border bg-card p-6";
const field =
  "mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const HELP: Record<string, string> = {
  insurance:
    "Upload your current public liability certificate and its expiry date. Homeowners can invite you to quote once we have checked it.",
  companies_house: "Your company number, for example 01234567. We look it up on Companies House.",
  gas_safe: "Your Gas Safe registration number. We check it on the Gas Safe Register.",
  niceic: "Your NICEIC registration number.",
  napit: "Your NAPIT membership number.",
  fensa: "Your FENSA registration number.",
};

function longDate(iso: string | null) {
  if (!iso) return "";
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The firm's Documents tab: what we hold, what it shows as, and a way to send or renew. */
export function FirmDocuments({ proId }: { proId: string }) {
  const list = useServerFn(listMyDocuments);
  const documents = useQuery({ queryKey: ["my-documents"], queryFn: () => list({}) });
  const [adding, setAdding] = useState<CredentialKind | null>(null);

  if (documents.isPending) return <p className="text-muted-foreground">Loading your documents…</p>;
  if (documents.isError)
    return (
      <p role="alert" className="text-muted-foreground">
        {documents.error.message}
      </p>
    );

  const byKind = new Map(documents.data.map((doc) => [doc.kind, doc]));
  const others = documents.data.filter(
    (doc) => !(FIRM_DOCUMENT_KINDS as readonly string[]).includes(doc.kind),
  );

  return (
    <div className="max-w-3xl">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Send us your insurance and any registrations here. A person at TradesmanFinder checks each
        one against the document or the official register. Until then it shows on your profile as
        "Not yet checked". We remind you 30 days and 7 days before anything expires.
      </p>
      <ul className="mt-6 grid gap-4">
        {FIRM_DOCUMENT_KINDS.map((kind) => {
          const doc = byKind.get(kind);
          return (
            <li key={kind} className={card}>
              <DocumentSummary kind={kind} doc={doc} />
              {adding === kind ? (
                <DocumentForm proId={proId} kind={kind} doc={doc} onClose={() => setAdding(null)} />
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(kind)}
                  className={
                    doc
                      ? "mt-4 rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary"
                      : "mt-4 rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
                  }
                >
                  {doc ? (doc.state === "expired" ? "Send your renewal" : "Update") : "Add"}
                </button>
              )}
            </li>
          );
        })}
        {others.map((doc) => (
          <li key={doc.id} className={card}>
            <DocumentSummary kind={doc.kind} doc={doc} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocumentSummary({ kind, doc }: { kind: CredentialKind; doc: FirmDocument | undefined }) {
  const open = useServerFn(myDocumentLink);
  const view = useMutation({
    mutationFn: () => open({ data: { id: doc!.id } }),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener"),
    onError: (e: Error) => toast.error(e.message),
  });
  const title = doc?.label ?? REGISTERS[kind].label;
  if (!doc)
    return (
      <>
        <h2 className="text-lg">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{HELP[kind] ?? "Not sent yet."}</p>
      </>
    );

  const returned = Boolean(doc.review_note) && doc.state !== "verified";
  const Icon = doc.state === "verified" ? Check : doc.state === "expired" ? CircleAlert : Clock3;
  const status =
    doc.state === "verified"
      ? `Checked${doc.verified_at ? ` on ${longDate(doc.verified_at)}` : ""}`
      : doc.state === "expired"
        ? "Expired. Send us the renewal."
        : returned
          ? "Needs attention"
          : "Waiting for us to check";
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg">{title}</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold ${
            doc.state === "verified"
              ? "bg-primary/15 text-foreground"
              : "border border-border text-muted-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {status}
        </span>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {doc.reference ? (
          <div>
            <dt className="text-muted-foreground">Number</dt>
            <dd>{doc.reference}</dd>
          </div>
        ) : null}
        {doc.expires_on ? (
          <div>
            <dt className="text-muted-foreground">
              {doc.state === "expired" ? "Expired on" : "Expires on"}
            </dt>
            <dd>{longDate(doc.expires_on)}</dd>
          </div>
        ) : null}
      </dl>
      {returned ? (
        <p className="mt-3 border-l-2 border-primary pl-3 text-sm">
          <span className="font-medium">What we need: </span>
          {doc.review_note}
        </p>
      ) : null}
      {doc.has_document ? (
        <button
          type="button"
          disabled={view.isPending}
          onClick={() => view.mutate()}
          className="mt-3 text-sm text-primary underline underline-offset-4"
        >
          View the document you sent
        </button>
      ) : null}
    </>
  );
}

function DocumentForm({
  proId,
  kind,
  doc,
  onClose,
}: {
  proId: string;
  kind: CredentialKind;
  doc: FirmDocument | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const submit = useServerFn(submitMyDocument);
  const isInsurance = kind === "insurance";
  const [reference, setReference] = useState(doc?.reference ?? "");
  const [expiresOn, setExpiresOn] = useState(
    doc?.state === "expired" ? "" : (doc?.expires_on?.slice(0, 10) ?? ""),
  );
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      let documentPath = "";
      if (file) {
        if (!TYPES.includes(file.type)) throw new Error("Upload a PDF, JPG, PNG or WebP file.");
        if (file.size > MAX_BYTES)
          throw new Error("That file is over 10 MB. Please send a smaller one.");
        const extension = (file.name.split(".").pop() ?? "pdf")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        documentPath = `${proId}/${kind}-${crypto.randomUUID()}.${extension || "pdf"}`;
        const { error } = await supabase.storage
          .from("pro-credentials")
          .upload(documentPath, file, { contentType: file.type, upsert: false });
        if (error) throw new Error("That file couldn't be uploaded. Please try again.");
      }
      return submit({ data: { kind, reference, expiresOn, documentPath } });
    },
    onSuccess: async () => {
      toast.success("Sent. We'll check it and email you.");
      await queryClient.invalidateQueries({ queryKey: ["my-documents"] });
      await queryClient.invalidateQueries({ queryKey: ["my-credentials"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="mt-5 grid gap-4 border-t border-border pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <p className="text-sm text-muted-foreground">{HELP[kind]}</p>
      <label className="block text-sm">
        <span className="font-medium">
          {isInsurance ? "Policy number (optional, not shown publicly)" : "Registration number"}
        </span>
        <input
          required={!isInsurance}
          maxLength={120}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          className={field}
        />
      </label>
      {isInsurance && (
        <label className="block text-sm">
          <span className="font-medium">Expiry date</span>
          <input
            type="date"
            required
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
            className={field}
          />
        </label>
      )}
      <label className="block text-sm">
        <span className="flex items-center gap-2 font-medium">
          <FileUp className="h-4 w-4 text-primary" aria-hidden="true" />
          {isInsurance ? "Certificate" : "Certificate or card (optional)"}
        </span>
        <input
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          required={isInsurance && !doc?.has_document}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-sm file:border file:border-border-strong file:bg-background file:px-3 file:py-2 file:text-sm"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          PDF, JPG, PNG or WebP, up to 10 MB. Only TradesmanFinder staff can open it.
        </span>
      </label>
      {doc?.state === "verified" ? (
        <p className="text-sm text-muted-foreground">
          This is currently shown as checked. Sending new details puts it back to "Not yet checked"
          until we have looked at them.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
        >
          {save.isPending ? "Sending…" : "Send for checking"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
