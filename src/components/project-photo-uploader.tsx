import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type Upload = { path: string; name: string; preview: string };

const MAX_BYTES = 8 * 1024 * 1024;

export default function ProjectPhotoUploader({
  userId,
  uploads,
  setUploads,
  maxPhotos,
  onUploadingChange,
}: {
  userId: string;
  uploads: Upload[];
  setUploads: React.Dispatch<React.SetStateAction<Upload[]>>;
  maxPhotos: number;
  onUploadingChange: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const setBusy = (busy: boolean) => {
    setUploading(busy);
    onUploadingChange(busy);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, maxPhotos - uploads.length)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} isn't an image.`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} is over 8MB.`);
          continue;
        }
        const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage
          .from("project-photos")
          .upload(path, file, { contentType: file.type });
        if (error) {
          toast.error(`Couldn't upload ${file.name}.`);
          continue;
        }
        setUploads((u) => [
          ...u,
          { path, name: file.name, preview: URL.createObjectURL(file) },
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
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
                loading="lazy"
                decoding="async"
                width={320}
                height={320}
                className="aspect-square w-full rounded-sm border border-border object-cover"
              />
              <button
                type="button"
                aria-label={`Remove ${u.name}`}
                onClick={() => {
                  void supabase.storage.from("project-photos").remove([u.path]);
                  setUploads((list) => list.filter((x) => x.path !== u.path));
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
  );
}
