import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useSavedPros } from "@/hooks/use-saved-pros";

/** Adds or removes a tradesperson from the visitor's local shortlist. */
export function SaveProButton({
  proId,
  company,
  className = "",
}: {
  proId: string;
  company: string;
  className?: string;
}) {
  const { isSaved, toggle } = useSavedPros();
  const saved = isSaved(proId);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${company} from your shortlist` : `Save ${company} to your shortlist`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = toggle(proId);
        toast.success(now ? `${company} saved to your shortlist` : `${company} removed`);
      }}
      className={`grid h-9 w-9 place-items-center rounded-sm border border-border-strong bg-background/85 backdrop-blur transition hover:border-primary hover:text-primary ${saved ? "text-primary" : "text-muted-foreground"} ${className}`}
    >
      <Heart className={`h-4 w-4 ${saved ? "fill-primary" : ""}`} />
    </button>
  );
}
