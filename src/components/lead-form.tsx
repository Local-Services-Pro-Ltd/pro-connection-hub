import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Mail } from "lucide-react";
import { HumanCheck, useHumanCheck } from "@/components/human-check";
import { sendProLead } from "@/lib/leads.functions";
import { budgetBands } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";

const field =
  "mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

const timings = [
  "As soon as possible",
  "Within a week",
  "Within a month",
  "Just planning",
];

/**
 * Direct enquiry to one firm. Everything the homeowner types is sent through
 * a server function that spam-gates the request, records the lead and emails
 * both sides — the firm's address is never exposed to the browser.
 */
export function LeadForm({
  proId,
  proName,
  company,
}: {
  proId: string;
  proName: string;
  company: string;
}) {
  const { user } = useAuth();
  const send = useServerFn(sendProLead);
  const check = useHumanCheck();
  const [sent, setSent] = useState<{ reference: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    postcode: "",
    message: "",
    budgetBand: "any",
    timing: timings[0] as string,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      send({
        data: {
          proId,
          name: form.name,
          email: form.email || (user?.email ?? ""),
          phone: form.phone,
          postcode: form.postcode,
          message: form.message,
          budgetBand:
            budgetBands.find((b) => b.value === form.budgetBand)?.label ??
            undefined,
          timing: form.timing,
          checkToken: check.state.token,
          checkAnswer: check.state.answer,
          website: check.state.website,
        },
      }),
    onSuccess: (result) => {
      setSent({ reference: result.reference });
      toast.success(`Enquiry sent to ${result.company}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      check.refresh();
    },
  });

  if (sent) {
    return (
      <div className="rounded-md border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-success">
          <Check className="h-5 w-5" />
          <p className="font-display font-semibold">Enquiry sent</p>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {proName.split(" ")[0]} has your details and we've emailed you a copy.
          Your reference is{" "}
          <strong className="text-foreground">{sent.reference}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form
      className="rounded-md border border-border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="eyebrow flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" /> Message this firm
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Send the job straight to {company}. Free, no obligation, and you'll get
        a copy by email.
      </p>

      <label className="mt-5 block text-sm">
        Your name
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={field}
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Email
          <input
            required
            type="email"
            value={form.email}
            placeholder={user?.email ?? ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={field}
          />
        </label>
        <label className="block text-sm">
          Phone (optional)
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={field}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Job postcode
          <input
            required
            value={form.postcode}
            onChange={(e) => setForm({ ...form, postcode: e.target.value })}
            className={field}
          />
        </label>
        <label className="block text-sm">
          When
          <select
            value={form.timing}
            onChange={(e) => setForm({ ...form, timing: e.target.value })}
            className={field}
          >
            {timings.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm">
        Budget
        <select
          value={form.budgetBand}
          onChange={(e) => setForm({ ...form, budgetBand: e.target.value })}
          className={field}
        >
          {budgetBands.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-sm">
        About the job
        <textarea
          required
          rows={4}
          minLength={20}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="What needs doing, rough sizes, anything a quote depends on."
          className={field}
        />
      </label>

      <div className="mt-5">
        <HumanCheck {...check} inputClassName={field} />
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="mt-6 w-full rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
      >
        {mutation.isPending ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
