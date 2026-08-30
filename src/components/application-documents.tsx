import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, FileUp, Loader2, Paperclip } from "lucide-react";
import { uploadApplicationDocument } from "@/lib/applications.functions";
import {
  ACCEPT_ATTRIBUTE,
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABEL,
  DOCUMENT_STATUS_LABEL,
  documentProgress,
  formatBytes,
  validateDocumentFile,
  type ApplicationDocument,
  type DocumentKind,
} from "@/lib/application-verification";

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("We couldn't read that file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function DocumentTracker({
  token,
  documents,
  onChange,
  requestedKinds = [],
}: {
  token: string;
  documents: ApplicationDocument[];
  onChange: () => void;
  requestedKinds?: string[];
}) {
  const upload = useServerFn(uploadApplicationDocument);
  const [kind, setKind] = useState<DocumentKind>("insurance");
  const inputRef = useRef<HTMLInputElement>(null);
  const progress = documentProgress(documents);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const dataBase64 = await toBase64(file);
      return upload({
        data: {
          token,
          kind,
          fileName: file.name,
          mimeType: file.type,
          dataBase64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Document uploaded — we'll check it.");
      if (inputRef.current) inputRef.current.value = "";
      onChange();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = validateDocumentFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    if (problem) {
      toast.error(problem);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    mutation.mutate(file);
  };

  return (
    <div className="rounded-md border border-border bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-xl">Your documents</h3>
        <span className="eyebrow !mb-0">
          {progress.sent} of {progress.requiredTotal} required sent ·{" "}
          {progress.verified} verified
        </span>
      </div>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label="Document verification progress"
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {progress.missing.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Still needed: {progress.missing.join(", ")}.
        </p>
      )}

      <ul className="mt-5 grid gap-3">
        {DOCUMENT_KINDS.map((defn) => {
          const files = documents.filter((d) => d.kind === defn.key);
          const requested = requestedKinds.includes(defn.key);
          return (
            <li
              key={defn.key}
              className={`rounded-sm border p-4 ${
                requested ? "border-primary" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-sm font-semibold">
                  {defn.label}
                  {defn.required && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      required
                    </span>
                  )}
                  {requested && (
                    <span className="ml-2 text-xs font-normal text-primary">
                      requested by reviewer
                    </span>
                  )}
                </p>
                <span className="text-xs text-muted-foreground">
                  {files.length === 0 ? "Not sent" : `${files.length} file(s)`}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{defn.hint}</p>
              {files.length > 0 && (
                <ul className="mt-3 grid gap-1.5">
                  {files.map((file) => (
                    <li
                      key={file.id}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      {file.status === "verified" ? (
                        <CheckCircle2
                          className="h-4 w-4 text-success"
                          aria-hidden="true"
                        />
                      ) : file.status === "rejected" ? (
                        <CircleAlert
                          className="h-4 w-4 text-destructive"
                          aria-hidden="true"
                        />
                      ) : (
                        <Paperclip
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                      <span>{file.file_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(file.size_bytes)} ·{" "}
                        {DOCUMENT_STATUS_LABEL[file.status] ?? file.status}
                        {file.reviewer_note ? ` · ${file.reviewer_note}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5">
        <label className="block">
          <span className="eyebrow">Document type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as DocumentKind)}
            className="mt-2 rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {DOCUMENT_KINDS.map((d) => (
              <option key={d.key} value={d.key}>
                {DOCUMENT_KIND_LABEL[d.key]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">File</span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            disabled={mutation.isPending}
            onChange={(e) => pick(e.target.files?.[0])}
            className="mt-2 block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:rounded-sm file:border file:border-border-strong file:bg-transparent file:px-3 file:py-2 file:font-display file:text-xs file:font-semibold file:uppercase file:tracking-widest"
          />
        </label>
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{" "}
              Uploading…
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4" aria-hidden="true" /> PDF or photo, up
              to 8MB.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
