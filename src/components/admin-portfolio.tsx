import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ProjectGallery } from "@/components/project-gallery";
import {
  adminCreatePortfolio,
  adminDeletePortfolio,
  adminListPortfolioQueue,
  adminReviewPortfolio,
  adminSetPortfolioVisibility,
} from "@/lib/portfolio.functions";
import type { AdminPortfolioItem } from "@/lib/portfolio.shared";
import type { PortfolioStatus } from "@/lib/portfolio.types";
import { uploadPortfolioPhoto, type UploadedPortfolioPhoto } from "@/lib/portfolio-image";

const button =
  "rounded-sm border border-border-strong px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-50";

export function PortfolioReviewQueue() {
  const [status, setStatus] = useState<PortfolioStatus>("pending");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const list = useServerFn(adminListPortfolioQueue);
  const review = useServerFn(adminReviewPortfolio);
  const queryClient = useQueryClient();
  const projects = useQuery({
    queryKey: ["admin-portfolio-queue", status],
    queryFn: () => list({ data: { status } }),
  });
  const mutation = useMutation({
    mutationFn: ({
      project,
      decision,
    }: {
      project: AdminPortfolioItem;
      decision: "approved" | "rejected";
    }) => review({ data: { id: project.id, decision, note: notes[project.id] ?? "" } }),
    onSuccess: (_, { decision }) => {
      toast.success(decision === "approved" ? "Job approved" : "Job returned to the firm");
      setRejecting(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-portfolio-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-portfolio-firm"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const rows = projects.data?.projects ?? [];
  return (
    <section className="mt-10 border-y border-border py-8" aria-labelledby="portfolio-review-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="portfolio-review-title" className="text-2xl">
            Review queue
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Check every photo and description before a job appears on a firm's public profile.
          </p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Portfolio review status">
          {(["pending", "approved", "rejected"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={status === item}
              onClick={() => setStatus(item)}
              className={`rounded-sm px-4 py-2 text-sm font-semibold capitalize ${status === item ? "bg-primary text-primary-foreground" : "border border-border-strong"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {projects.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading review queue…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          No {status} jobs.
        </p>
      ) : (
        <ul className="mt-6 space-y-6">
          {rows.map((project) => (
            <li key={project.id} className="rounded-md border border-border bg-surface p-4 sm:p-6">
              <div className="mb-4">
                <p className="eyebrow">
                  {project.company} · {project.firm_name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Trade: {project.trade_slug.replaceAll("-", " ")}
                </p>
              </div>
              <ProjectGallery projects={[project]} heading="" />
              {project.reviewer_note ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Previous reviewer note: {project.reviewer_note}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ project, decision: "approved" })}
                  className="rounded-sm bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setRejecting(rejecting === project.id ? null : project.id)}
                  className={button}
                >
                  Reject
                </button>
              </div>
              {rejecting === project.id ? (
                <div className="mt-4 max-w-xl">
                  <label className="text-sm font-semibold" htmlFor={`reject-${project.id}`}>
                    What needs to change?
                  </label>
                  <textarea
                    id={`reject-${project.id}`}
                    rows={3}
                    maxLength={600}
                    value={notes[project.id] ?? ""}
                    onChange={(event) => setNotes({ ...notes, [project.id]: event.target.value })}
                    className="mt-2 w-full rounded-sm border border-border-strong bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={mutation.isPending || !notes[project.id]?.trim()}
                    onClick={() => mutation.mutate({ project, decision: "rejected" })}
                    className="mt-3 rounded-sm bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                  >
                    Reject and notify firm
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminProjectEditor({ proId, tradeSlug }: { proId: string; tradeSlug: string }) {
  const queryClient = useQueryClient();
  const list = useServerFn(adminListPortfolioQueue);
  const create = useServerFn(adminCreatePortfolio);
  const toggle = useServerFn(adminSetPortfolioVisibility);
  const remove = useServerFn(adminDeletePortfolio);
  const { data } = useQuery({
    queryKey: ["admin-portfolio-firm", proId],
    queryFn: () => list({ data: { status: "all", proId } }),
  });
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [before, setBefore] = useState<UploadedPortfolioPhoto | null>(null);
  const [after, setAfter] = useState<UploadedPortfolioPhoto | null>(null);
  const [busy, setBusy] = useState<"before" | "after" | null>(null);
  const [progress, setProgress] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-portfolio-firm"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-portfolio-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["pro-projects"] });
    void queryClient.invalidateQueries({ queryKey: ["trade-projects"] });
  };
  async function upload(file: File, which: "before" | "after") {
    setBusy(which);
    try {
      const photo = await uploadPortfolioPhoto(proId, file, setProgress);
      if (which === "before") setBefore(photo);
      else setAfter(photo);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!after) throw new Error("An after photo is required.");
      return create({
        data: {
          proId,
          title,
          summary,
          tradeSlug,
          beforePath: before?.path ?? null,
          afterPath: after.path,
          extraPaths: [],
          approved: true,
        },
      });
    },
    onSuccess: () => {
      setTitle("");
      setSummary("");
      setBefore(null);
      setAfter(null);
      refresh();
      toast.success("Project approved and published");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const action = useMutation({
    mutationFn: ({
      project,
      action: kind,
    }: {
      project: AdminPortfolioItem;
      action: "toggle" | "delete";
    }) =>
      kind === "toggle"
        ? toggle({ data: { id: project.id, published: !project.published } })
        : remove({ data: { id: project.id } }),
    onSuccess: () => {
      setConfirmDelete(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const rows = data?.projects ?? [];
  return (
    <div>
      <h2 className="text-2xl">Add work for this firm</h2>
      <div className="mt-6 space-y-4 rounded-md border border-border bg-card p-6">
        <input
          value={title}
          maxLength={80}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Project title"
          className="w-full rounded-sm border border-border-strong bg-background px-4 py-3 text-sm"
        />
        <textarea
          value={summary}
          maxLength={400}
          onChange={(event) => setSummary(event.target.value)}
          rows={3}
          placeholder="What the job involved, in a sentence or two."
          className="w-full rounded-sm border border-border-strong bg-background px-4 py-3 text-sm"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {(["before", "after"] as const).map((which) => {
            const photo = which === "before" ? before : after;
            return (
              <div key={which} className="rounded-sm border border-border p-4">
                <p className="eyebrow">
                  {which} photo{which === "after" ? " (required)" : ""}
                </p>
                {photo ? (
                  <img
                    src={photo.preview}
                    alt={`${which} preview`}
                    className="mt-3 aspect-[4/3] w-full rounded-sm object-cover"
                  />
                ) : null}
                <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-border-strong px-4 py-2.5 text-sm font-semibold hover:border-primary hover:text-primary">
                  <Upload className="h-4 w-4" />
                  {busy === which ? `Uploading… ${progress}%` : "Upload"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(file, which);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !title.trim() || !after || rows.length >= 24}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Publishing…" : "Approve & publish project"}
        </button>
      </div>
      <ul className="mt-6 space-y-3">
        {rows.map((project) => (
          <li key={project.id} className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-4">
              <img
                src={project.after}
                alt={`${project.title} — after`}
                className="h-16 w-20 shrink-0 rounded-sm object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{project.title}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {project.status} · {project.published ? "shown" : "hidden"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => action.mutate({ project, action: "toggle" })}
                className={button}
              >
                {project.published ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                aria-label={`Delete ${project.title}`}
                onClick={() => setConfirmDelete(project.id)}
                className="rounded-sm border border-border-strong p-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {confirmDelete === project.id ? (
              <div className="mt-3 flex items-center gap-3 text-sm">
                <span>Delete this job and its photos?</span>
                <button
                  type="button"
                  className="text-destructive underline"
                  onClick={() => action.mutate({ project, action: "delete" })}
                >
                  Delete
                </button>
                <button type="button" className="underline" onClick={() => setConfirmDelete(null)}>
                  Cancel
                </button>
              </div>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            No projects yet for this firm.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
