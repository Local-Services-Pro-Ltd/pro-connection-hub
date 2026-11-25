/** Short-lived viewing links for job photos. Server only. */

export const JOB_PHOTO_BUCKET = "job-photos";
export const MAX_JOB_PHOTOS = 4;

/**
 * Only paths inside the job's own folder are signed, so a job row that was
 * somehow pointed at another job's files can never expose them.
 */
export async function signJobPhotos(
  jobId: string,
  paths: string[] | null | undefined,
): Promise<string[]> {
  const list = (paths ?? [])
    .filter((path) => typeof path === "string" && path.startsWith(`${jobId}/`))
    .slice(0, MAX_JOB_PHOTOS);
  if (!list.length) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from(JOB_PHOTO_BUCKET)
    .createSignedUrls(list, 3600);
  if (error) {
    console.error("[job-photos] signing failed", error.message);
    return [];
  }
  return (data ?? []).flatMap((item) => (item.signedUrl ? [item.signedUrl] : []));
}
