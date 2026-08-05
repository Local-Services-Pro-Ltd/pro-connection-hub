import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { PageHero, Section } from "@/components/layout-bits";
import { trades } from "@/lib/site-data";

export const Route = createFileRoute("/post-job")({
  head: () => ({
    meta: [
      { title: "Post a job free — get up to 3 quotes | TradesmanFinder" },
      {
        name: "description",
        content:
          "Describe your job in two minutes and get quotes from up to three vetted local tradesmen. Free to post, no obligation.",
      },
      { property: "og:title", content: "Post a job free — TradesmanFinder" },
      {
        property: "og:description",
        content: "Two minutes to post. Up to three quotes from vetted trades.",
      },
    ],
  }),
  component: PostJob,
});

const field =
  "w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary";

function PostJob() {
  const [sent, setSent] = useState(false);

  return (
    <>
      <PageHero
        eyebrow="Post a job"
        title="Tell us what needs doing."
        sub="Two minutes. Free. Up to three vetted local trades will come back to you — usually the same day."
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          {sent ? (
            <div className="rounded-md border border-border bg-card p-10">
              <div className="grid h-12 w-12 place-items-center rounded-sm bg-primary/15">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mt-6 text-2xl">Job posted</h2>
              <p className="mt-3 max-w-md text-muted-foreground">
                This is a demo, so nothing has been sent. On the live site, up
                to three matched trades would be notified immediately.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-6 rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary"
              >
                Post another job
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
                toast.success("Job posted — matching local trades now");
              }}
              className="space-y-6 rounded-md border border-border bg-card p-6 lg:p-9"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow">Trade needed</span>
                  <select required className={`${field} mt-2`}>
                    <option value="">Choose a trade</option>
                    {trades.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="eyebrow">Postcode</span>
                  <input
                    required
                    placeholder="e.g. BS1 4DJ"
                    className={`${field} mt-2`}
                  />
                </label>
              </div>

              <label className="block">
                <span className="eyebrow">Job title</span>
                <input
                  required
                  placeholder="Replace leaking bathroom radiator"
                  className={`${field} mt-2`}
                />
              </label>

              <label className="block">
                <span className="eyebrow">Describe the job</span>
                <textarea
                  required
                  rows={6}
                  placeholder="What needs doing, access details, anything a trade should know before quoting."
                  className={`${field} mt-2 resize-y`}
                />
              </label>

              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow">When</span>
                  <select className={`${field} mt-2`}>
                    <option>As soon as possible</option>
                    <option>Within 2 weeks</option>
                    <option>Within a month</option>
                    <option>Flexible / planning ahead</option>
                  </select>
                </label>
                <label className="block">
                  <span className="eyebrow">Budget guide</span>
                  <select className={`${field} mt-2`}>
                    <option>Not sure yet</option>
                    <option>Under £500</option>
                    <option>£500 – £2,000</option>
                    <option>£2,000 – £10,000</option>
                    <option>£10,000+</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow">Your name</span>
                  <input required className={`${field} mt-2`} />
                </label>
                <label className="block">
                  <span className="eyebrow">Email</span>
                  <input required type="email" className={`${field} mt-2`} />
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-sm bg-primary px-6 py-3.5 font-display font-semibold text-primary-foreground shadow-ember transition-all hover:brightness-110"
              >
                Post job — free
              </button>
            </form>
          )}

          <aside className="h-fit space-y-6 rounded-md border border-border bg-surface p-6 lg:sticky lg:top-24">
            <div>
              <p className="eyebrow">What happens next</p>
              <ol className="mt-4 space-y-4 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">1.</strong> We match your
                  job to vetted trades covering your postcode.
                </li>
                <li>
                  <strong className="text-foreground">2.</strong> Up to three of
                  them contact you with a price and availability.
                </li>
                <li>
                  <strong className="text-foreground">3.</strong> You choose —
                  or you don't. There's no fee either way.
                </li>
              </ol>
            </div>
            <div className="border-t border-border pt-6 text-sm text-muted-foreground">
              We never sell your details, and your phone number is only shared
              with trades you choose to speak to.
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
