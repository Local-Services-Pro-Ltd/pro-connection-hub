import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { JOB_PHOTO_BUCKET, MAX_JOB_PHOTOS } from "@/lib/job-photos.server";

/**
 * Photos on a posted job. Homeowners can post without an account, so the
 * browser cannot be given general upload rights. Instead, straight after the
 * job is saved, the server hands back one-off upload links for that job only.
 * Knowing the job id (which the browser chose moments ago) is the proof.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FRESH_MS = 30 * 60 * 1000;

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The photos column is newer than the generated database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function freshJob(jobId: string) {
  const db = await adminDb();
  const { data } = await db
    .from("jobs")
    .select("id, photos, created_at")
    .eq("id", jobId)
    .maybeSingle();
  if (!data) throw new Error("We couldn't find that job.");
  if (Date.now() - new Date(data.created_at).getTime() > FRESH_MS)
    throw new Error("Photos can only be added straight after posting a job.");
  return data as { id: string; photos: string[] | null; created_at: string };
}

export const createJobPhotoUploads = createServerFn({ method: "POST" })
  .inputValidator((input: { jobId: string; count: number }) => {
    const jobId = (input.jobId ?? "").trim().toLowerCase();
    if (!UUID.test(jobId)) throw new Error("We couldn't find that job.");
    const count = Math.round(Number(input.count));
    if (!(count >= 1 && count <= MAX_JOB_PHOTOS))
      throw new Error(`You can add up to ${MAX_JOB_PHOTOS} photos.`);
    return { jobId, count };
  })
  .handler(async ({ data }) => {
    const db = await adminDb();
    const forwarded = getRequestHeader("x-forwarded-for") ?? "";
    const ip = (forwarded.split(",")[0] ?? "").trim() || "unknown";
    const ipKey = createHash("sha256").update(ip).digest("hex").slice(0, 32);
    const { data: allowed, error: limitError } = await db.rpc("hit_rate_limit", {
      p_bucket: `job-photos:${ipKey}`,
      p_limit: 20,
      p_window_seconds: 3600,
    });
    if (!limitError && allowed === false)
      throw new Error("Too many uploads in a short time. Please try again later.");

    const job = await freshJob(data.jobId);
    if ((job.photos ?? []).length + data.count > MAX_JOB_PHOTOS)
      throw new Error(`You can add up to ${MAX_JOB_PHOTOS} photos.`);

    const uploads: { path: string; token: string }[] = [];
    for (let i = 0; i < data.count; i += 1) {
      const path = `${job.id}/${crypto.randomUUID()}.webp`;
      const { data: signed, error } = await db.storage
        .from(JOB_PHOTO_BUCKET)
        .createSignedUploadUrl(path);
      if (error || !signed?.token) {
        console.error("[job-photos] upload link failed", error);
        throw new Error("We couldn't prepare the photo upload. Your job is still posted.");
      }
      uploads.push({ path, token: signed.token });
    }
    return { uploads };
  });

/** Record the photos that actually arrived. Paths outside the job's folder are ignored. */
export const attachJobPhotos = createServerFn({ method: "POST" })
  .inputValidator((input: { jobId: string; paths: string[] }) => {
    const jobId = (input.jobId ?? "").trim().toLowerCase();
    if (!UUID.test(jobId)) throw new Error("We couldn't find that job.");
    const paths = (input.paths ?? [])
      .filter((path) => typeof path === "string")
      .slice(0, MAX_JOB_PHOTOS);
    return { jobId, paths };
  })
  .handler(async ({ data }) => {
    const job = await freshJob(data.jobId);
    const db = await adminDb();
    const { data: stored } = await db.storage.from(JOB_PHOTO_BUCKET).list(job.id, { limit: 20 });
    const present = new Set(
      ((stored ?? []) as { name: string }[]).map((object) => `${job.id}/${object.name}`),
    );
    const photos = [...new Set([...(job.photos ?? []), ...data.paths])]
      .filter((path) => path.startsWith(`${job.id}/`) && present.has(path))
      .slice(0, MAX_JOB_PHOTOS);
    const { error } = await db.from("jobs").update({ photos }).eq("id", job.id);
    if (error) throw new Error("We couldn't attach the photos. Your job is still posted.");
    return { count: photos.length };
  });
