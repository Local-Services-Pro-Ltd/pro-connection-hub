import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { JobPhotoStrip } from "@/components/job-photos";
import { listMyQuotes, saveMyQuote, withdrawMyQuote } from "@/lib/quotes.functions";
import {
  QUOTE_STATUS_LABEL,
  gbp,
  longDate,
  quoteTotals,
  toPence,
  type FirmQuote,
} from "@/lib/quotes.shared";

const card = "rounded-md border border-border bg-card p-6";
const label = "block text-xs uppercase tracking-widest text-muted-foreground";
const field =
  "mt-2 w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

/** The firm's Quotes tab: invitations to answer, and quotes already sent. */
export function QuoteManager() {
  const list = useServerFn(listMyQuotes);
  const quotes = useQuery({ queryKey: ["my-quotes"], queryFn: () => list({}) });
  const [openId, setOpenId] = useState<string | null>(null);

  if (quotes.isPending) return <p className="text-muted-foreground">Loading your quotes…</p>;
  if (quotes.isError)
    return (
      <p role="alert" className="text-muted-foreground">
        {quotes.error.message}
      </p>
    );
  if (quotes.data.length === 0)
    return (
      <div className={`${card} max-w-2xl`}>
        <h2 className="text-xl">No invitations yet</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          When you register interest in a job under Jobs near you, the homeowner can invite you to
          quote. Invitations appear here and we email you as well. A homeowner can invite up to
          three firms. You can be invited once we have checked your public liability insurance.
        </p>
      </div>
    );

  return (
    <ul className="grid gap-4">
      {quotes.data.map((quote) => (
        <li key={quote.id} className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg">{quote.job.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {quote.job.reference} · {quote.job.timing}
                {quote.job.postcode ? ` · ${quote.job.postcode}` : ""}
              </p>
            </div>
            <span
              className={`rounded-sm px-2.5 py-1 text-xs font-semibold ${
                quote.status === "accepted"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {QUOTE_STATUS_LABEL[quote.status]}
            </span>
          </div>
          <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {quote.job.description}
          </p>
          <JobPhotoStrip photos={quote.job.photos} label="Photos from the homeowner" />
          {quote.job.contact_name ? (
            <p className="mt-4 text-sm">
              Homeowner: <strong>{quote.job.contact_name}</strong> ·{" "}
              <a
                href={`mailto:${quote.job.contact_email}`}
                className="text-primary hover:underline"
              >
                {quote.job.contact_email}
              </a>
            </p>
          ) : null}
          {quote.status !== "invited" && quote.status !== "draft" ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Your quote: <strong className="text-foreground">{gbp(quote.total_pence)}</strong>
              {quote.vat_registered ? " including VAT" : ""}
              {quote.sent_at ? ` · sent ${longDate(quote.sent_at)}` : ""}
              {quote.status === "sent"
                ? quote.viewed_at
                  ? " · seen by the homeowner"
                  : " · not yet seen"
                : ""}
            </p>
          ) : null}

          {["invited", "draft", "sent"].includes(quote.status) &&
            (openId === quote.id ? (
              <QuoteForm quote={quote} onClose={() => setOpenId(null)} />
            ) : (
              <button
                type="button"
                onClick={() => setOpenId(quote.id)}
                className="mt-5 rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110"
              >
                {quote.status === "invited"
                  ? "Write your quote"
                  : quote.status === "draft"
                    ? "Continue your quote"
                    : "Change your quote"}
              </button>
            ))}
        </li>
      ))}
    </ul>
  );
}

type Line = { kind: "labour" | "materials"; description: string; amount: string };

function QuoteForm({ quote, onClose }: { quote: FirmQuote; onClose: () => void }) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveMyQuote);
  const withdraw = useServerFn(withdrawMyQuote);
  const pounds = (pence: number) => (pence ? String(pence / 100) : "");
  const [form, setForm] = useState({
    labour: pounds(quote.labour_pence),
    materials: pounds(quote.materials_pence),
    vatRegistered: quote.vat_registered,
    startDate: quote.start_date ?? "",
    durationDays: quote.duration_days ? String(quote.duration_days) : "",
    warranty: quote.warranty,
    paymentSchedule: quote.payment_schedule,
    exclusions: quote.exclusions,
    possibleExtras: quote.possible_extras,
    notes: quote.notes,
    expiresOn: quote.expires_on ?? "",
  });
  const [lines, setLines] = useState<Line[]>(
    quote.items.map((item) => ({
      kind: item.kind,
      description: item.description,
      amount: pounds(item.amount_pence),
    })),
  );
  const set = (key: keyof typeof form) => (value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const lineSum = (kind: Line["kind"]) =>
    lines
      .filter((line) => line.kind === kind && line.description.trim())
      .reduce((total, line) => total + toPence(Number(line.amount)), 0);
  const has = (kind: Line["kind"]) =>
    lines.some((line) => line.kind === kind && line.description.trim());
  const labourPence = has("labour") ? lineSum("labour") : toPence(Number(form.labour));
  const materialsPence = has("materials") ? lineSum("materials") : toPence(Number(form.materials));
  const totals = quoteTotals(labourPence, materialsPence, form.vatRegistered);

  const submit = useMutation({
    mutationFn: (sendNow: boolean) =>
      save({
        data: {
          quoteId: quote.id,
          labour: Number(form.labour) || 0,
          materials: Number(form.materials) || 0,
          vatRegistered: form.vatRegistered,
          startDate: form.startDate || null,
          durationDays: form.durationDays ? Number(form.durationDays) : null,
          warranty: form.warranty,
          paymentSchedule: form.paymentSchedule,
          exclusions: form.exclusions,
          possibleExtras: form.possibleExtras,
          notes: form.notes,
          expiresOn: form.expiresOn || null,
          items: lines.map((line) => ({ ...line, amount: Number(line.amount) || 0 })),
          send: sendNow,
        },
      }),
    onSuccess: async (result) => {
      toast.success(
        result.sent ? "Quote sent. We've emailed the homeowner." : "Draft saved. Not sent yet.",
      );
      await queryClient.invalidateQueries({ queryKey: ["my-quotes"] });
      if (result.sent) onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const stepBack = useMutation({
    mutationFn: () => withdraw({ data: { quoteId: quote.id } }),
    onSuccess: async () => {
      toast.success("You've withdrawn from this job.");
      await queryClient.invalidateQueries({ queryKey: ["my-quotes"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="mt-6 border-t border-border pt-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate(true);
      }}
    >
      <h3 className="text-xl">Your quote</h3>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The homeowner sees these headings in the same order from every firm. Enter prices before
        VAT. Nothing is sent until you choose Send quote.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label>
          <span className={label}>Labour (£, before VAT)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={has("labour") ? String(labourPence / 100) : form.labour}
            disabled={has("labour")}
            onChange={(event) => set("labour")(event.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className={label}>Materials (£, before VAT)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={has("materials") ? String(materialsPence / 100) : form.materials}
            disabled={has("materials")}
            onChange={(event) => set("materials")(event.target.value)}
            className={field}
          />
        </label>
      </div>

      <fieldset className="mt-6">
        <legend className={label}>Price breakdown (optional)</legend>
        <p className="mt-2 text-sm text-muted-foreground">
          Add lines if you want to show how the price is made up. Lines replace the totals above.
        </p>
        <ul className="mt-3 grid gap-3">
          {lines.map((line, index) => (
            <li key={index} className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_130px_auto]">
              <select
                aria-label="Line type"
                value={line.kind}
                onChange={(event) =>
                  setLines((all) =>
                    all.map((row, i) =>
                      i === index ? { ...row, kind: event.target.value as Line["kind"] } : row,
                    ),
                  )
                }
                className={field.replace("mt-2 ", "")}
              >
                <option value="labour">Labour</option>
                <option value="materials">Materials</option>
              </select>
              <input
                aria-label="What it is"
                placeholder="e.g. Supply and fit mixer tap"
                maxLength={200}
                value={line.description}
                onChange={(event) =>
                  setLines((all) =>
                    all.map((row, i) =>
                      i === index ? { ...row, description: event.target.value } : row,
                    ),
                  )
                }
                className={field.replace("mt-2 ", "")}
              />
              <input
                aria-label="Amount in pounds"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="£"
                value={line.amount}
                onChange={(event) =>
                  setLines((all) =>
                    all.map((row, i) =>
                      i === index ? { ...row, amount: event.target.value } : row,
                    ),
                  )
                }
                className={field.replace("mt-2 ", "")}
              />
              <button
                type="button"
                aria-label="Remove this line"
                onClick={() => setLines((all) => all.filter((_, i) => i !== index))}
                className="grid h-10 w-10 place-items-center rounded-sm border border-border-strong hover:border-primary hover:text-primary"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {lines.length < 20 && (
          <button
            type="button"
            onClick={() =>
              setLines((all) => [...all, { kind: "labour", description: "", amount: "" }])
            }
            className="mt-3 inline-flex items-center gap-2 rounded-sm border border-border-strong px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a line
          </button>
        )}
      </fieldset>

      <label className="mt-6 flex items-start gap-3">
        <input
          type="checkbox"
          checked={form.vatRegistered}
          onChange={(event) => set("vatRegistered")(event.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span className="text-sm">
          My firm is VAT registered. Add 20% VAT to this quote.
          <span className="block text-muted-foreground">
            Leave unticked if you are not VAT registered. If a different VAT rate applies to this
            job, say so under Notes.
          </span>
        </span>
      </label>

      <div className="mt-6 rounded-md border border-border bg-surface p-5" aria-live="polite">
        <dl className="grid gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Labour</dt>
            <dd className="mt-1">{gbp(labourPence)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Materials</dt>
            <dd className="mt-1">{gbp(materialsPence)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">VAT</dt>
            <dd className="mt-1">{form.vatRegistered ? gbp(totals.vat) : "Not VAT registered"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total the homeowner pays</dt>
            <dd className="mt-1 font-display text-2xl">{gbp(totals.total)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <label>
          <span className={label}>Estimated start date</span>
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => set("startDate")(event.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className={label}>Working days</span>
          <input
            type="number"
            min="1"
            max="730"
            inputMode="numeric"
            value={form.durationDays}
            onChange={(event) => set("durationDays")(event.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className={label}>Quote valid until</span>
          <input
            type="date"
            value={form.expiresOn}
            onChange={(event) => set("expiresOn")(event.target.value)}
            className={field}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label>
          <span className={label}>Payment schedule</span>
          <textarea
            rows={3}
            maxLength={800}
            placeholder="e.g. 20% deposit on booking, balance on completion"
            value={form.paymentSchedule}
            onChange={(event) => set("paymentSchedule")(event.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className={label}>Warranty (optional)</span>
          <textarea
            rows={3}
            maxLength={500}
            placeholder="e.g. 12 months on workmanship; manufacturer's warranty on parts"
            value={form.warranty}
            onChange={(event) => set("warranty")(event.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className={label}>Not included</span>
          <textarea
            rows={3}
            maxLength={1200}
            placeholder="e.g. Making good plaster, decorating, skip hire"
            value={form.exclusions}
            onChange={(event) => set("exclusions")(event.target.value)}
            className={field}
          />
        </label>
        <label>
          <span className={label}>Could cost more if</span>
          <textarea
            rows={3}
            maxLength={1200}
            placeholder="e.g. Pipework behind the wall needs replacing: about £150 extra"
            value={form.possibleExtras}
            onChange={(event) => set("possibleExtras")(event.target.value)}
            className={field}
          />
        </label>
      </div>
      <label className="mt-5 block">
        <span className={label}>Notes for the homeowner (optional)</span>
        <textarea
          rows={3}
          maxLength={1200}
          value={form.notes}
          onChange={(event) => set("notes")(event.target.value)}
          className={field}
        />
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submit.isPending}
          className="rounded-sm bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
        >
          {submit.isPending
            ? "Saving…"
            : quote.status === "sent"
              ? "Send updated quote"
              : "Send quote"}
        </button>
        {quote.status !== "sent" && (
          <button
            type="button"
            disabled={submit.isPending}
            onClick={() => submit.mutate(false)}
            className="rounded-sm border border-border-strong px-5 py-2.5 font-display text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
          >
            Save draft
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
        <button
          type="button"
          disabled={stepBack.isPending}
          onClick={() => stepBack.mutate()}
          className="ml-auto rounded-sm px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
        >
          I can't quote for this job
        </button>
      </div>
    </form>
  );
}
