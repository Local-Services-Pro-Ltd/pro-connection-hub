import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Stores the visitor's current directory filters against their account so the
 * same search is one click away from /account.
 */
export function SaveSearchButton({
  label,
  tradeSlug,
  area,
  filters,
}: {
  label: string;
  tradeSlug?: string | undefined;
  area?: string | undefined;
  filters: Record<string, unknown>;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to save this search.");
      const { error } = await supabase.from("saved_searches").insert({
        user_id: user.id,
        label: label.slice(0, 120),
        trade_slug: tradeSlug ?? null,
        area: area ?? null,
        filters: filters as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Search saved to your account");
      void queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user) return null;

  return (
    <button
      type="button"
      onClick={() => save.mutate()}
      disabled={save.isPending}
      className="inline-flex items-center gap-2 rounded-sm border border-border-strong px-4 py-2 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
    >
      <BookmarkPlus className="h-4 w-4" />
      {save.isPending ? "Saving…" : "Save this search"}
    </button>
  );
}
