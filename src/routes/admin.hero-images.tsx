import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, RotateCcw, Save, Upload } from "lucide-react";
import { Section, SectionHead } from "@/components/layout-bits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  isAdminQuery,
  tradesQuery,
  tradeHeroImagesQuery,
  type TradeHeroImage,
} from "@/lib/queries";
import { tradeAlt, tradeFocal, tradeHero } from "@/lib/trade-media";

const BUCKET = "trade-heroes";
/** Signed-URL lifetime for uploaded heroes (10 years, effectively permanent). */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

export const Route = createFileRoute("/admin/hero-images")({
  head: () => ({
    meta: [
      { title: "Trade hero images — admin | TradesmanFinder" },
      {
        name: "description",
        content:
          "Upload or swap the hero photo, focal point and alt text for any trade page without a code change.",
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
  component: AdminHeroImages,
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

function AdminHeroImages() {
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
        body="Sign in with your admin account to manage trade hero images."
      />
    );
  }
  if (!isAdmin) {
    return (
      <Locked
        title="Not an admin account"
        body="Only site admins can change the photography on trade pages."
      />
    );
  }
  return <HeroBoard />;
}

type Draft = {
  imageUrl: string;
  altText: string;
  focal: string;
  focalMobile: string;
};

function HeroBoard() {
  const queryClient = useQueryClient();
  const { data: trades, isPending } = useQuery(tradesQuery);
  const { data: overrides } = useQuery(tradeHeroImagesQuery);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const byslug = useMemo(() => {
    const m: Record<string, TradeHeroImage> = {};
    for (const o of overrides ?? []) m[o.slug] = o;
    return m;
  }, [overrides]);

  const list = (trades ?? []).filter((t) =>
    t.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const active = selected ?? list[0]?.slug ?? null;
  const trade = (trades ?? []).find((t) => t.slug === active) ?? null;

  return (
    <Section>
      <SectionHead
        eyebrow="Admin"
        title="Trade hero images"
        sub="Upload a photo, set where the crop should centre and write the alt text for any trade page. Changes go live immediately — no code change needed."
        aside={
          <Link
            to="/admin/featured"
            className="whitespace-nowrap rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary"
          >
            Featured firms
          </Link>
        }
      />

      {isPending ? (
        <p className="mt-8 text-muted-foreground">Loading trades…</p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div>
            <label className="eyebrow" htmlFor="hero-filter">
              Find a trade
            </label>
            <input
              id="hero-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Plumber, roofer…"
              className="mt-2 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
            />
            <ul className="mt-4 max-h-[520px] overflow-y-auto rounded-md border border-border">
              {list.map((t) => (
                <li key={t.slug}>
                  <button
                    type="button"
                    onClick={() => setSelected(t.slug)}
                    className={`flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left text-sm last:border-b-0 ${
                      t.slug === active
                        ? "bg-primary/10 font-semibold text-primary"
                        : "hover:bg-surface"
                    }`}
                  >
                    <span className="truncate">{t.name}</span>
                    {byslug[t.slug]?.image_url ? (
                      <span className="shrink-0 rounded-sm bg-primary/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-primary">
                        custom
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
              {list.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted-foreground">
                  No trades match that search.
                </li>
              )}
            </ul>
          </div>

          {trade ? (
            <HeroEditor
              key={trade.slug}
              slug={trade.slug}
              name={trade.name}
              override={byslug[trade.slug] ?? null}
              onSaved={() =>
                queryClient.invalidateQueries({ queryKey: ["trade-hero-images"] })
              }
            />
          ) : null}
        </div>
      )}
    </Section>
  );
}

function HeroEditor({
  slug,
  name,
  override,
  onSaved,
}: {
  slug: string;
  name: string;
  override: TradeHeroImage | null;
  onSaved: () => void;
}) {
  const fallbackFocal = tradeFocal(slug);
  const [draft, setDraft] = useState<Draft>({
    imageUrl: override?.image_url ?? "",
    altText: override?.alt_text ?? "",
    focal: override?.focal ?? fallbackFocal.focal,
    focalMobile: override?.focal_mobile ?? fallbackFocal.focalMobile,
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setDraft({
      imageUrl: override?.image_url ?? "",
      altText: override?.alt_text ?? "",
      focal: override?.focal ?? fallbackFocal.focal,
      focalMobile: override?.focal_mobile ?? fallbackFocal.focalMobile,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override?.slug, override?.image_url]);

  const previewSrc = draft.imageUrl || tradeHero(slug);
  const previewAlt = draft.altText.trim() || tradeAlt(slug, name);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trade_hero_images").upsert({
        slug,
        image_url: draft.imageUrl.trim() || null,
        alt_text: draft.altText.trim() || null,
        focal: draft.focal.trim() || fallbackFocal.focal,
        focal_mobile: draft.focalMobile.trim() || fallbackFocal.focalMobile,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${name} hero updated.`);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save the hero."),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("trade_hero_images")
        .delete()
        .eq("slug", slug);
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft({
        imageUrl: "",
        altText: "",
        focal: fallbackFocal.focal,
        focalMobile: fallbackFocal.focalMobile,
      });
      toast.success(`${name} reverted to the built-in photo.`);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't reset the hero."),
  });

  async function upload(file: File) {
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${slug}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (signErr || !data?.signedUrl) throw signErr ?? new Error("No URL");
      setDraft((d) => ({ ...d, imageUrl: data.signedUrl }));
      toast.success("Uploaded — check the preview, then save.");
    } catch (e) {
      toast.error((e as Error).message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const altLength = previewAlt.length;

  return (
    <div className="rounded-md border border-border bg-card p-6">
      <h2 className="text-2xl">{name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        /trades/{slug}
        {override?.image_url ? " — using an uploaded photo" : " — using the built-in photo"}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <p className="eyebrow">Desktop crop preview (16:6)</p>
          <img
            src={previewSrc}
            alt={previewAlt}
            className="mt-2 aspect-[16/6] w-full rounded-sm border border-border object-cover"
            style={{ objectPosition: draft.focal }}
          />
        </div>
        <div>
          <p className="eyebrow">Mobile crop</p>
          <img
            src={previewSrc}
            alt=""
            aria-hidden="true"
            className="mt-2 aspect-[3/4] w-full rounded-sm border border-border object-cover"
            style={{ objectPosition: draft.focalMobile }}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="eyebrow">Image URL</span>
          <input
            value={draft.imageUrl}
            onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
            placeholder="Upload below, or paste an https:// image URL"
            className="mt-2 w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="eyebrow">Alt text (describe what's happening)</span>
          <textarea
            value={draft.altText}
            onChange={(e) => setDraft({ ...draft, altText: e.target.value })}
            rows={2}
            placeholder={tradeAlt(slug, name)}
            className="mt-2 w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
          />
          <span
            className={`mt-1 block text-xs ${
              altLength > 125 ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {altLength}/125 characters — don't start with "image of", and don't
            repeat the page heading.
          </span>
        </label>

        <label className="block">
          <span className="eyebrow">Focal point — desktop</span>
          <input
            value={draft.focal}
            onChange={(e) => setDraft({ ...draft, focal: e.target.value })}
            placeholder="50% 45%"
            className="mt-2 w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Focal point — mobile</span>
          <input
            value={draft.focalMobile}
            onChange={(e) =>
              setDraft({ ...draft, focalMobile: e.target.value })
            }
            placeholder="60% 45%"
            className="mt-2 w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm"
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Focal points are CSS <code>object-position</code> values: first number is
        left → right, second is top → bottom. Put the subject's face at roughly
        35–45% from the top.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-border-strong px-4 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary">
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => reset.mutate()}
          disabled={reset.isPending || !override}
          className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2.5 font-display text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Revert to built-in
        </button>
      </div>
    </div>
  );
}
