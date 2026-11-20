import { supabase } from "@/integrations/supabase/client";

const MAX_ORIGINAL_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export type UploadedPortfolioPhoto = { path: string; preview: string };

async function imageSource(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("We couldn't read that image. Try a different photo."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressPortfolioImage(file: File): Promise<Blob> {
  if (!ALLOWED.has(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.");
  if (file.size > MAX_ORIGINAL_BYTES)
    throw new Error("That photo is over 8 MB. Choose a smaller original.");
  const source = await imageSource(file);
  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, 2000 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser couldn't prepare that photo. Try another browser.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82),
  );
  if (!blob) throw new Error("We couldn't compress that photo. Try a different image.");
  return blob;
}

export async function uploadPortfolioPhoto(
  proId: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<UploadedPortfolioPhoto> {
  onProgress(10);
  const blob = await compressPortfolioImage(file);
  onProgress(40);
  const path = `${proId}/${crypto.randomUUID()}.webp`;
  const preview = URL.createObjectURL(blob);
  const { error } = await supabase.storage.from("pro-projects").upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  onProgress(80);
  if (error) {
    URL.revokeObjectURL(preview);
    throw new Error(error.message || "That photo couldn't be uploaded. Please try again.");
  }
  onProgress(100);
  return { path, preview };
}
