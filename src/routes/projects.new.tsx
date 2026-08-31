import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHero, Section } from "@/components/layout-bits";
import { createProject } from "@/lib/projects.functions";
import { tradesQuery } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import type { Upload } from "@/components/project-photo-uploader";

const PhotoUploader = lazy(() => import("@/components/project-photo-uploader"));

const field =
  "mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

const MAX_PHOTOS = 8;


export const Route = createFileRoute("/projects/new")({
  head: () => ({
    meta: [
      { title: "Post a project — budget, dates and photos | TradesmanFinder" },
      {
        name: "description",
        content:
          "List your home project with a budget, target dates and photos. Vetted UK firms apply directly once it clears review.",
      },
      { property: "og:title", content: "Post a project | TradesmanFinder" },
      {
        property: "og:description",
        content: "List your job with budget, dates and photos — firms apply directly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewProject,
});



function NewProject() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: trades } = useQuery(tradesQuery);
  const create = useServerFn(createProject);

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    tradeSlug: "",
    postcode: "",
    budgetMin: "",
    budgetMax: "",
    startDate: "",
    endDate: "",
    contactName: "",
    contactEmail: "",
    notifyApplications: true,
  });

  useEffect(() => {
    if (!loading && !user)
      navigate({
        to: "/signin",
        search: { redirect: "/projects/new" },
        replace: true,
      });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user?.email && !form.contactEmail)
      setForm((f) => ({ ...f, contactEmail: user.email ?? "" }));
  }, [user, form.contactEmail]);




  const submit = useMutation({
    mutationFn: async () =>
      create({
        data: {
          title: form.title,
          description: form.description,
          tradeSlug: form.tradeSlug || undefined,
          postcode: form.postcode,
          budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
          budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          photos: uploads.map((u) => u.path),
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          notifyApplications: form.notifyApplications,
        },
      }),
    onSuccess: (row) => {
      toast.success(`Posting ${row.reference} sent for review`);
      navigate({ to: "/account" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || !user) {
    return (
      <Section>
        <p className="text-muted-foreground">Loading…</p>
      </Section>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Post a project"
        title="Tell firms what you need doing."
        sub="Budget, dates and photos make quotes far more accurate. We review every posting before vetted firms can see it."
      />

      <Section>
        <form
          className="mx-auto max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <label className="block text-sm">
            Project title
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Rear kitchen extension"
              className={field}
            />
          </label>

          <label className="mt-5 block text-sm">
            What needs doing
            <textarea
              required
              rows={6}
              minLength={40}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Scope, sizes, materials, access, anything a price depends on."
              className={field}
            />
          </label>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm">
              Trade
              <select
                value={form.tradeSlug}
                onChange={(e) =>
                  setForm({ ...form, tradeSlug: e.target.value })
                }
                className={field}
              >
                <option value="">Not sure / general</option>
                {(trades ?? []).map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Postcode
              <input
                required
                value={form.postcode}
                onChange={(e) =>
                  setForm({ ...form, postcode: e.target.value })
                }
                className={field}
              />
            </label>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm">
              Budget from (£)
              <input
                type="number"
                min={0}
                value={form.budgetMin}
                onChange={(e) =>
                  setForm({ ...form, budgetMin: e.target.value })
                }
                className={field}
              />
            </label>
            <label className="block text-sm">
              Budget up to (£)
              <input
                type="number"
                min={0}
                value={form.budgetMax}
                onChange={(e) =>
                  setForm({ ...form, budgetMax: e.target.value })
                }
                className={field}
              />
            </label>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm">
              Ideal start date
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
                className={field}
              />
            </label>
            <label className="block text-sm">
              Finish by
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className={field}
              />
            </label>
          </div>

          <div className="mt-7">
            <p className="eyebrow">Photos (up to {MAX_PHOTOS})</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Photos of the space are the single biggest thing that improves
              quote accuracy. They're only shown once the posting is approved.
            </p>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-sm border border-border-strong px-4 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary">
              <ImagePlus className="h-4 w-4" />
              {uploading ? "Uploading…" : "Add photos"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            {uploads.length > 0 && (
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {uploads.map((u) => (
                  <li key={u.path} className="relative">
                    <img
                      src={u.preview}
                      alt={`Project photo: ${u.name}`}
                      className="aspect-square w-full rounded-sm border border-border object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${u.name}`}
                      onClick={() => {
                        void supabase.storage
                          .from("project-photos")
                          .remove([u.path]);
                        setUploads((list) =>
                          list.filter((x) => x.path !== u.path),
                        );
                      }}
                      className="absolute right-1 top-1 rounded-sm bg-background/90 p-1 text-muted-foreground hover:text-primary"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm">
              Contact name
              <input
                required
                value={form.contactName}
                onChange={(e) =>
                  setForm({ ...form, contactName: e.target.value })
                }
                className={field}
              />
            </label>
            <label className="block text-sm">
              Contact email
              <input
                required
                type="email"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm({ ...form, contactEmail: e.target.value })
                }
                className={field}
              />
            </label>
          </div>

          <label className="mt-5 flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.notifyApplications}
              onChange={(e) =>
                setForm({ ...form, notifyApplications: e.target.checked })
              }
              className="mt-1"
            />
            Email me whenever a vetted firm applies to this project.
          </label>

          <button
            type="submit"
            disabled={submit.isPending || uploading}
            className="mt-8 w-full rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
          >
            {submit.isPending ? "Sending for review…" : "Submit project"}
          </button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            You can track it any time from{" "}
            <Link to="/account" className="text-primary hover:underline">
              your account
            </Link>
            .
          </p>
        </form>
      </Section>
    </>
  );
}
