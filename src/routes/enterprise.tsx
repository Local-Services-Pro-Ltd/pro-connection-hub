import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Section } from "@/components/layout-bits";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/enterprise")({
  head: () => {
    const description =
      "Multi-team outfits and larger works: talk to us about Contractor plans, team profiles and account management on TradesmanFinder.";
    return {
      meta: [
        { title: "Contractor & multi-team plans | TradesmanFinder" },
        { name: "description", content: description },
        {
          property: "og:title",
          content: "Contractor & multi-team plans — TradesmanFinder",
        },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        {
          name: "twitter:title",
          content: "Contractor & multi-team plans — TradesmanFinder",
        },
        { name: "twitter:description", content: description },
      ],
    };
  },
  component: Enterprise,
});

const field =
  "mt-2 w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary";

function Enterprise() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("feedback").insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: `[Contractor / multi-team enquiry]\n${message.trim()}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSent(true);
      toast.success("Thanks — we'll come back to you shortly");
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  });

  return (
    <Section>
      <div className="mx-auto max-w-xl">
        <p className="eyebrow">Contractor & multi-team</p>
        <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
          Running more than a couple of vans?
        </h1>
        <p className="mt-4 text-muted-foreground">
          Contractor plans cover unlimited trade categories and postcode areas,
          team profiles and a named account manager. They're arranged directly
          with us at the moment — tell us a little about the outfit and we'll
          set you up.
        </p>

        {sent ? (
          <div className="mt-10 rounded-md border border-border bg-card p-8">
            <div className="grid h-12 w-12 place-items-center rounded-sm bg-primary/15">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mt-6 text-2xl">Enquiry received</h2>
            <p className="mt-3 text-muted-foreground">
              We'll be in touch by email within one working day.
            </p>
            <Link
              to="/for-tradesmen"
              className="mt-6 inline-flex rounded-sm border border-border-strong px-5 py-3 font-display text-sm font-semibold hover:border-primary hover:text-primary"
            >
              Back to membership
            </Link>
          </div>
        ) : (
          <form
            className="mt-10 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div>
              <label htmlFor="ent-name" className="text-sm font-medium">
                Your name
              </label>
              <input
                id="ent-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="ent-email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="ent-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="ent-message" className="text-sm font-medium">
                Trades, team size and areas covered
              </label>
              <textarea
                id="ent-message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. 12-strong building and M&E team across south London and north Kent"
                className={field}
              />
            </div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
            >
              {mutation.isPending ? "Sending…" : "Send enquiry"}
            </button>
          </form>
        )}
      </div>
    </Section>
  );
}
