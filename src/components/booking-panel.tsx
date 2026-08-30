import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bookedSlotsQuery } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";

const HOURS = [8, 10, 13, 15];
const DAYS = 10;

/** Next N working days x fixed visit windows, from tomorrow onwards. */
function buildSlots(): Date[] {
  const out: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);
  while (out.length < DAYS * HOURS.length) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      for (const h of HOURS) {
        const d = new Date(cursor);
        d.setHours(h, 0, 0, 0);
        out.push(d);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

const reasons: Record<string, string> = {
  unknown_pro: "That tradesperson isn't taking bookings right now.",
  invalid_slot: "Pick a time in the future.",
  invalid_email: "Enter a valid email address.",
  invalid_name: "Enter your name.",
  rate_limited: "Too many booking requests — try again later.",
  slot_taken: "Someone just took that slot. Choose another.",
};

export function BookingPanel({
  proId,
  proName,
  postcode = "",
}: {
  proId: string;
  proName: string;
  postcode?: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const slots = useMemo(buildSlots, []);
  const { data: taken } = useQuery(bookedSlotsQuery(proId));
  const [selected, setSelected] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, Date[]>();
    for (const s of slots) {
      const key = s.toDateString();
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].slice(0, DAYS);
  }, [slots]);

  const booking = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a time slot first.");
      const { data, error } = await supabase.rpc("request_booking", {
        p_pro_id: proId,
        p_slot_start: selected.toISOString(),
        p_contact_name: name.trim(),
        p_contact_email: email.trim(),
        p_notes: notes.trim(),
        ...(phone.trim() ? { p_contact_phone: phone.trim() } : {}),
        ...(postcode ? { p_postcode: postcode } : {}),
      });
      if (error) throw error;
      const res = data as { ok: boolean; reason?: string; reference?: string };
      if (!res.ok)
        throw new Error(reasons[res.reason ?? ""] ?? "Couldn't book that slot.");
      return res.reference!;
    },
    onSuccess: (ref) => {
      setReference(ref);
      void queryClient.invalidateQueries({ queryKey: ["booked-slots", proId] });
      toast.success("Slot requested");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (reference) {
    return (
      <div className="rounded-md border border-border bg-card p-6">
        <div className="grid h-10 w-10 place-items-center rounded-sm bg-primary/15">
          <Check className="h-5 w-5 text-primary" />
        </div>
        <h3 className="mt-4 text-xl">Slot requested</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {proName.split(" ")[0]} has your request for{" "}
          <strong className="text-foreground">
            {selected?.toLocaleString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          . Reference{" "}
          <strong className="font-display text-foreground">{reference}</strong>.
          You'll get a confirmation once it's accepted.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-6">
      <p className="eyebrow flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-primary" />
        Book a visit
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Pick a slot rather than waiting on a callback. Free to request, and you
        can cancel any time.
      </p>

      <div className="mt-5 max-h-72 space-y-4 overflow-y-auto pr-1">
        {byDay.map(([day, times]) => (
          <div key={day}>
            <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {new Date(day).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {times.map((t) => {
                const isTaken = taken?.has(t.toISOString()) ?? false;
                const isSelected = selected?.getTime() === t.getTime();
                return (
                  <button
                    key={t.toISOString()}
                    type="button"
                    disabled={isTaken}
                    onClick={() => setSelected(t)}
                    className={`rounded-sm border px-3 py-1.5 text-sm transition ${
                      isTaken
                        ? "cursor-not-allowed border-border text-muted-foreground line-through opacity-60"
                        : isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border-strong hover:border-primary hover:text-primary"
                    }`}
                  >
                    {t.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <form
        className="mt-5 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          booking.mutate();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What needs doing?"
          className="rounded-sm border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={booking.isPending || !selected}
          className="rounded-sm bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
        >
          {booking.isPending
            ? "Requesting…"
            : selected
              ? `Request ${selected.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${selected.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
              : "Choose a slot"}
        </button>
      </form>
    </div>
  );
}
