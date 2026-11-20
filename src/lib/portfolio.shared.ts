import type { PortfolioProjectRow, PortfolioStatus } from "@/lib/portfolio.types";

export type PublicPortfolioItem = {
  id: string;
  title: string;
  summary: string;
  trade_slug: string;
  completed_on: string | null;
  before: string | null;
  after: string;
  extras: string[];
};

export type MyPortfolioItem = PublicPortfolioItem & {
  pro_id: string;
  before_path: string | null;
  after_path: string;
  extra_paths: string[];
  published: boolean;
  status: PortfolioStatus;
  reviewer_note: string | null;
  sort_order: number;
};

export type AdminPortfolioItem = MyPortfolioItem & {
  firm_name: string;
  company: string;
};

/** Storage values are object paths only, inside the owning firm's folder. */
export function isPortfolioPath(proId: string, path: string): boolean {
  if (!proId || !path || path.length > 500 || !path.startsWith(`${proId}/`)) return false;
  if (/^(?:https?:)?\/\//i.test(path) || /[\\?#]/.test(path) || path.includes("//")) return false;
  const parts = path.split("/");
  return (
    parts.length >= 2 &&
    parts.every((part) => part && part !== "." && part !== "..") &&
    /^[A-Za-z0-9_-]+$/.test(parts[0]!) &&
    parts.slice(1).every((part) => /^[A-Za-z0-9_.-]+$/.test(part)) &&
    /\.(?:jpe?g|png|webp)$/i.test(parts.at(-1)!)
  );
}

export function requirePortfolioPath(proId: string, path: string): string {
  const cleaned = path.trim();
  if (!isPortfolioPath(proId, cleaned)) throw new Error("A photo does not belong to this firm.");
  return cleaned;
}

export function projectPhotoPaths(
  row: Pick<PortfolioProjectRow, "pro_id" | "before_url" | "after_url" | "extra_photos">,
): string[] {
  return [row.before_url, row.after_url, ...(row.extra_photos ?? [])].filter(
    (path): path is string => Boolean(path && isPortfolioPath(row.pro_id, path)),
  );
}

/** Public DTO construction is a second approval guard after the database filters. */
export function publicPortfolioItem(
  row: PortfolioProjectRow,
  signedUrls: Record<string, string>,
): PublicPortfolioItem | null {
  if (row.status !== "approved" || !row.published || !row.after_url) return null;
  const after = signedUrls[row.after_url];
  if (!after || !isPortfolioPath(row.pro_id, row.after_url)) return null;
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    trade_slug: row.trade_slug,
    completed_on: row.completed_on,
    before: row.before_url ? (signedUrls[row.before_url] ?? null) : null,
    after,
    extras: (row.extra_photos ?? []).flatMap((path) => {
      const url = signedUrls[path];
      return url && isPortfolioPath(row.pro_id, path) ? [url] : [];
    }),
  };
}

export function myPortfolioItem(
  row: PortfolioProjectRow,
  signedUrls: Record<string, string>,
): MyPortfolioItem | null {
  if (!row.after_url) return null;
  const base = publicPortfolioItem({ ...row, status: "approved", published: true }, signedUrls);
  if (!base) return null;
  return {
    ...base,
    pro_id: row.pro_id,
    before_path: row.before_url,
    after_path: row.after_url,
    extra_paths: row.extra_photos ?? [],
    published: row.published,
    status: row.status,
    reviewer_note: row.reviewer_note,
    sort_order: row.sort_order,
  };
}
