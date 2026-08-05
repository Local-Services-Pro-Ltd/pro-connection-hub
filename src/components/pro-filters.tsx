import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { areasQuery, budgetBands, availabilityLabels } from "@/lib/queries";

const control =
  "rounded-sm border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary";

export function ProFiltersBar() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const { data: areas } = useSuspenseQuery(areasQuery);

  const set = (key: string, value: string) =>
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => {
        const next = { ...prev };
        if (value) next[key] = value;
        else delete next[key];
        return next;
      },
      replace: true,
    });

  const active = ["area", "budget", "availability", "q", "sort"].filter(
    (k) => search[k],
  );

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <span className="eyebrow !mb-0">Filter results</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="sr-only">Keyword</span>
          <input
            defaultValue={search["q"] ?? ""}
            key={`q-${search["q"] ?? ""}`}
            onBlur={(e) => set("q", e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                set("q", (e.target as HTMLInputElement).value.trim());
              }
            }}
            placeholder="Name or keyword"
            className={`${control} w-full`}
          />
        </label>

        <label className="block">
          <span className="sr-only">Area</span>
          <select
            value={search["area"] ?? ""}
            onChange={(e) => set("area", e.target.value)}
            className={`${control} w-full`}
          >
            <option value="">Any area</option>
            {areas.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Budget</span>
          <select
            value={search["budget"] ?? "any"}
            onChange={(e) => set("budget", e.target.value === "any" ? "" : e.target.value)}
            className={`${control} w-full`}
          >
            {budgetBands.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Availability</span>
          <select
            value={search["availability"] ?? "any"}
            onChange={(e) =>
              set("availability", e.target.value === "any" ? "" : e.target.value)
            }
            className={`${control} w-full`}
          >
            <option value="any">Any availability</option>
            {Object.entries(availabilityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Sort by</span>
          <select
            value={search["sort"] ?? "rating"}
            onChange={(e) => set("sort", e.target.value === "rating" ? "" : e.target.value)}
            className={`${control} w-full`}
          >
            <option value="rating">Highest rated</option>
            <option value="reviews">Most reviewed</option>
            <option value="response">Fastest to reply</option>
            <option value="experience">Most experienced</option>
          </select>
        </label>
      </div>

      {active.length > 0 && (
        <button
          type="button"
          onClick={() => navigate({ to: ".", search: {}, replace: true })}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <X className="h-3.5 w-3.5" /> Clear {active.length} filter
          {active.length === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
