import { useEffect, useMemo } from "react";
import { ImagePlus, X } from "lucide-react";
import { MAX_JOB_PHOTOS } from "@/lib/job-photo-upload";

/** Photos the homeowner added to a job, shown to them and to firms that can see the job. */
export function JobPhotoStrip({ photos, label }: { photos: string[]; label?: string }) {
  if (!photos.length) return null;
  return (
    <div className="mt-4">
      {label ? (
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      ) : null}
      <ul className="mt-2 flex flex-wrap gap-2">
        {photos.map((url, index) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer" className="block">
              <img
                src={url}
                alt={`Photo ${index + 1} of the job`}
                loading="lazy"
                decoding="async"
                width={160}
                height={120}
                className="h-24 w-32 rounded-sm border border-border object-cover hover:border-primary"
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Photo picker for the post-a-job form. Nothing is uploaded until the job is posted. */
export function JobPhotoPicker({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  const remaining = MAX_JOB_PHOTOS - files.length;

  return (
    <fieldset>
      <legend className="eyebrow">Photos (optional)</legend>
      <p className="mt-2 text-sm text-muted-foreground">
        Up to {MAX_JOB_PHOTOS} photos help firms price the job without a visit. Firms in your trade
        and area can see them, so leave out faces, paperwork and anything showing your address.
      </p>
      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="relative">
              <img
                src={previews[index]}
                alt={`Chosen photo ${index + 1}`}
                className="h-24 w-32 rounded-sm border border-border object-cover"
              />
              <button
                type="button"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-sm bg-background/90 text-foreground hover:text-primary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {remaining > 0 && (
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-sm border border-border-strong px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary">
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {files.length ? "Add another photo" : "Add photos"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(event) => {
              const added = Array.from(event.target.files ?? []);
              onChange([...files, ...added].slice(0, MAX_JOB_PHOTOS));
              event.target.value = "";
            }}
          />
        </label>
      )}
    </fieldset>
  );
}
