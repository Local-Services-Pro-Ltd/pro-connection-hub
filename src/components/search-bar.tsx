import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search, MapPin } from "lucide-react";
import { tradesQuery } from "@/lib/queries";

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { data: trades } = useSuspenseQuery(tradesQuery);
  const [trade, setTrade] = useState("");
  const [place, setPlace] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (trade) {
          navigate({
            to: "/trades/$trade",
            params: { trade },
            search: place ? { area: place } : {},
          });
        } else {
          navigate({ to: "/trades" });
        }
      }}
      className={`grid gap-2 rounded-md border border-border bg-card/90 p-2 backdrop-blur-md sm:grid-cols-[1.1fr_1fr_auto] ${
        compact ? "" : "shadow-lift"
      }`}
    >
      <label className="flex min-w-0 items-center gap-2 rounded-sm px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-primary" />
        <span className="sr-only">Trade</span>
        <select
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          className="w-full bg-transparent text-sm text-foreground outline-none"
        >
          <option value="">What do you need doing?</option>
          {trades.map((t) => (
            <option key={t.slug} value={t.slug} className="bg-card">
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 items-center gap-2 rounded-sm border-border px-3 py-2.5 sm:border-l">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <span className="sr-only">Postcode or area</span>
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="Postcode or town"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 outline-none"
        />
      </label>

      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground shadow-ember transition-all hover:brightness-110"
      >
        Search
      </button>
    </form>
  );
}
