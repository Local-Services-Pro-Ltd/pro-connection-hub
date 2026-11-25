import { supabase } from "@/integrations/supabase/client";
import { attachJobPhotos, createJobPhotoUploads } from "@/lib/job-photos.functions";
import { compressPortfolioImage } from "@/lib/portfolio-image";

export const MAX_JOB_PHOTOS = 4;

/**
 * Shrinks each photo in the browser, uploads it with a one-off link from the
 * server, then records what arrived. Returns how many photos were attached.
 * The job is already saved when this runs, so a failure here never loses it.
 */
export async function uploadJobPhotos(jobId: string, files: File[]): Promise<number> {
  const chosen = files.slice(0, MAX_JOB_PHOTOS);
  if (!chosen.length) return 0;
  const blobs = await Promise.all(chosen.map((file) => compressPortfolioImage(file)));
  const { uploads } = await createJobPhotoUploads({ data: { jobId, count: blobs.length } });
  const paths: string[] = [];
  for (const [index, upload] of uploads.entries()) {
    const blob = blobs[index];
    if (!blob) continue;
    const { error } = await supabase.storage
      .from("job-photos")
      .uploadToSignedUrl(upload.path, upload.token, blob, { contentType: "image/webp" });
    if (!error) paths.push(upload.path);
  }
  if (!paths.length) throw new Error("The photos couldn't be uploaded.");
  const result = await attachJobPhotos({ data: { jobId, paths } });
  return result.count;
}
