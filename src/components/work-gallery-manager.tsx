import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Pro } from "@/lib/queries";
import { tradesQuery } from "@/lib/queries";
import {
  deleteMyPortfolio,
  listMyPortfolio,
  moveMyPortfolio,
  saveMyPortfolio,
  setMyPortfolioVisibility,
} from "@/lib/portfolio.functions";
import type { MyPortfolioItem } from "@/lib/portfolio.shared";
import { uploadPortfolioPhoto, type UploadedPortfolioPhoto } from "@/lib/portfolio-image";

const field =
  "mt-2 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary";
const label = "block text-xs font-semibold uppercase tracking-widest text-muted-foreground";
const secondaryButton =
  "inline-flex items-center justify-center rounded-sm border border-border-strong px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-50";

type FormState = {
  id: string | null;
  title: string;
  summary: string;
  tradeSlug: string;
  month: string;
  before: UploadedPortfolioPhoto | null;
  after: UploadedPortfolioPhoto | null;
  extras: UploadedPortfolioPhoto[];
};

const emptyForm = (trade: string): FormState => ({
  id: null,
  title: "",
  summary: "",
  tradeSlug: trade,
  month: "",
  before: null,
  after: null,
  extras: [],
});

export function WorkGalleryManager({ pro }: { pro: Pro }) {
  const queryClient = useQueryClient();
  const list = useServerFn(listMyPortfolio);
  const save = useServerFn(saveMyPortfolio);
  const toggle = useServerFn(setMyPortfolioVisibility);
  const move = useServerFn(moveMyPortfolio);
  const remove = useServerFn(deleteMyPortfolio);
  const projects = useQuery({ queryKey: ["my-portfolio"], queryFn: () => list({}) });
  const trades = useQuery(tradesQuery);
  const [form, setForm] = useState<FormState>(() => emptyForm(pro.trade_slug));
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-portfolio"] });
    void queryClient.invalidateQueries({ queryKey: ["pro-projects"] });
    void queryClient.invalidateQueries({ queryKey: ["trade-projects"] });
  };

  async function upload(file: File, slot: "before" | "after" | "extra") {
    const key = `${slot}-${crypto.randomUUID()}`;
    setProgress((current) => ({ ...current, [key]: 0 }));
    try {
      const photo = await uploadPortfolioPhoto(pro.id, file, (value) =>
        setProgress((current) => ({ ...current, [key]: value })),
      );
      setForm((current) =>
        slot === "extra"
          ? { ...current, extras: [...current.extras, photo].slice(0, 6) }
          : { ...current, [slot]: photo },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That photo couldn't be uploaded.");
    } finally {
      window.setTimeout(
        () =>
          setProgress((current) => {
            const next = { ...current };
            delete next[key];
            return next;
          }),
        600,
      );
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Give the job a title.");
      if (!form.after) throw new Error("An after photo is required.");
      return save({
        data: {
          ...(form.id ? { id: form.id } : {}),
          title: form.title,
          summary: form.summary,
          tradeSlug: form.tradeSlug,
          completedOn: form.month ? `${form.month}-01` : null,
          beforePath: form.before?.path ?? null,
          afterPath: form.after.path,
          extraPaths: form.extras.map((photo) => photo.path),
        },
      });
    },
    onSuccess: () => {
      setForm(emptyForm(pro.trade_slug));
      refresh();
      toast.success("Sent for review — it'll appear on your profile once approved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const action = useMutation({
    mutationFn: async ({
      kind,
      project,
      direction,
    }: {
      kind: "toggle" | "move" | "delete";
      project: MyPortfolioItem;
      direction?: "up" | "down";
    }) => {
      if (kind === "toggle")
        return toggle({ data: { id: project.id, published: !project.published } });
      if (kind === "move")
        return move({ data: { id: project.id, direction: direction ?? "down" } });
      return remove({ data: { id: project.id } });
    },
    onSuccess: (_, variables) => {
      if (variables.kind === "delete") setConfirmDelete(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function edit(project: MyPortfolioItem) {
    setForm({
      id: project.id,
      title: project.title,
      summary: project.summary,
      tradeSlug: project.trade_slug,
      month: project.completed_on?.slice(0, 7) ?? "",
      before:
        project.before_path && project.before
          ? { path: project.before_path, preview: project.before }
          : null,
      after: { path: project.after_path, preview: project.after },
      extras: project.extra_paths.flatMap((path, index) =>
        project.extras[index] ? [{ path, preview: project.extras[index]! }] : [],
      ),
    });
    document
      .getElementById("work-gallery-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const rows = projects.data?.projects ?? [];
  return (
    <div className="space-y-10">
      <div className="max-w-3xl">
        <h2 className="text-2xl">Work gallery</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Show homeowners your best work. Each job is checked by our team before it appears on your
          profile, usually within 2 working days.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <li>· Use your own photos of work you completed</li>
          <li>· Don't show house numbers, number plates or people's faces</li>
          <li>· Bright, landscape photos work best</li>
        </ul>
      </div>

      <form
        id="work-gallery-form"
        className="scroll-mt-24 space-y-5 rounded-md border border-border bg-card p-5 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg">{form.id ? "Edit job" : "Add a completed job"}</h3>
          {form.id ? (
            <button
              type="button"
              className="text-sm text-primary underline"
              onClick={() => setForm(emptyForm(pro.trade_slug))}
            >
              Cancel editing
            </button>
          ) : null}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={label}>
            Title (required)
            <input
              required
              maxLength={80}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className={field}
            />
          </label>
          <label className={label}>
            Trade
            <select
              value={form.tradeSlug}
              onChange={(event) => setForm({ ...form, tradeSlug: event.target.value })}
              className={field}
            >
              {(trades.data ?? []).map((trade) => (
                <option key={trade.slug} value={trade.slug}>
                  {trade.name}
                </option>
              ))}
              {!trades.data?.some((trade) => trade.slug === pro.trade_slug) ? (
                <option value={pro.trade_slug}>{pro.trade_slug.replaceAll("-", " ")}</option>
              ) : null}
            </select>
          </label>
        </div>
        <label className={label}>
          Short description
          <textarea
            maxLength={400}
            rows={4}
            value={form.summary}
            onChange={(event) => setForm({ ...form, summary: event.target.value })}
            className={`${field} resize-y`}
          />
        </label>
        <label className={`${label} max-w-xs`}>
          Month completed (optional)
          <input
            type="month"
            value={form.month}
            onChange={(event) => setForm({ ...form, month: event.target.value })}
            className={field}
          />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <PhotoInput
            label="Before photo (optional)"
            photo={form.before}
            onFile={(file) => void upload(file, "before")}
            onRemove={() => setForm({ ...form, before: null })}
          />
          <PhotoInput
            label="After photo (required)"
            photo={form.after}
            onFile={(file) => void upload(file, "after")}
            onRemove={() => setForm({ ...form, after: null })}
          />
        </div>
        <div>
          <span className={label}>Extra photos (up to 6)</span>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {form.extras.map((photo, index) => (
              <Thumbnail
                key={photo.path}
                photo={photo}
                alt={`Extra photo ${index + 1}`}
                onRemove={() =>
                  setForm({
                    ...form,
                    extras: form.extras.filter((item) => item.path !== photo.path),
                  })
                }
              />
            ))}
            {form.extras.length < 6 ? (
              <UploadButton multiple onFile={(file) => void upload(file, "extra")} />
            ) : null}
          </div>
        </div>
        {Object.entries(progress).map(([key, value]) => (
          <div key={key} className="max-w-md" role="status">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${value}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Preparing and uploading photo… {value}%
            </p>
          </div>
        ))}
        <button
          type="submit"
          disabled={
            saveMutation.isPending ||
            Object.keys(progress).length > 0 ||
            (!form.id && rows.length >= 24)
          }
          className="rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saveMutation.isPending
            ? "Saving…"
            : form.id
              ? "Save and send for review"
              : "Add to work gallery"}
        </button>
        {!form.id && rows.length >= 24 ? (
          <p className="text-sm text-muted-foreground">
            You've reached the 24-job limit. Delete a job before adding another.
          </p>
        ) : null}
      </form>

      <div>
        <h3 className="text-lg">Your jobs</h3>
        {projects.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading your work gallery…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No jobs added yet. Before-and-after photos are the single biggest driver of enquiries.
          </p>
        ) : (
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((project, index) => {
              const hidden = project.status === "approved" && !project.published;
              const status = hidden
                ? "Hidden"
                : project.status === "pending"
                  ? "Awaiting review"
                  : project.status === "approved"
                    ? "Live on your profile"
                    : "Not approved";
              return (
                <li
                  key={project.id}
                  className="overflow-hidden rounded-md border border-border bg-card"
                >
                  <img
                    src={project.after}
                    alt={`${project.title} — after`}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="p-4">
                    <span
                      className={`inline-flex rounded-sm px-2 py-1 text-xs font-semibold ${project.status === "approved" && !hidden ? "bg-success/15 text-success" : project.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
                    >
                      {status}
                    </span>
                    <h4 className="mt-3 text-base">{project.title}</h4>
                    {project.status === "rejected" && project.reviewer_note ? (
                      <p className="mt-2 text-sm text-destructive">{project.reviewer_note}</p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => edit(project)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => action.mutate({ kind: "toggle", project })}
                      >
                        {project.published ? "Hide from profile" : "Show on profile"}
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${project.title} up`}
                        disabled={index === 0}
                        className={secondaryButton}
                        onClick={() => action.mutate({ kind: "move", project, direction: "up" })}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${project.title} down`}
                        disabled={index === rows.length - 1}
                        className={secondaryButton}
                        onClick={() => action.mutate({ kind: "move", project, direction: "down" })}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                    {confirmDelete === project.id ? (
                      <div className="mt-4 rounded-sm border border-destructive/40 p-3">
                        <p className="text-sm">Delete this job and its photos?</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            className="rounded-sm bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground"
                            onClick={() => action.mutate({ kind: "delete", project })}
                          >
                            Delete job
                          </button>
                          <button
                            type="button"
                            className={secondaryButton}
                            onClick={() => setConfirmDelete(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-4 inline-flex items-center gap-2 text-sm text-destructive"
                        onClick={() => setConfirmDelete(project.id)}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PhotoInput({
  label: text,
  photo,
  onFile,
  onRemove,
}: {
  label: string;
  photo: UploadedPortfolioPhoto | null;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <span className={label}>{text}</span>
      {photo ? (
        <Thumbnail photo={photo} alt={text} onRemove={onRemove} />
      ) : (
        <UploadButton onFile={onFile} />
      )}
    </div>
  );
}

function UploadButton({
  onFile,
  multiple = false,
}: {
  onFile: (file: File) => void;
  multiple?: boolean;
}) {
  return (
    <label className="mt-3 flex min-h-28 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-border-strong px-4 py-3 text-sm font-semibold hover:border-primary hover:text-primary">
      <Upload className="h-4 w-4" /> Choose {multiple ? "photos" : "photo"}
      <input
        type="file"
        multiple={multiple}
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          files.forEach(onFile);
          event.target.value = "";
        }}
      />
    </label>
  );
}

function Thumbnail({
  photo,
  alt,
  onRemove,
}: {
  photo: UploadedPortfolioPhoto;
  alt: string;
  onRemove: () => void;
}) {
  return (
    <div className="relative mt-3">
      <img src={photo.preview} alt={alt} className="aspect-[4/3] w-full rounded-sm object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 rounded-sm bg-background/90 px-2 py-1 text-xs font-semibold shadow-sm"
      >
        Remove
      </button>
    </div>
  );
}
