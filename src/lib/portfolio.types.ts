import type { Database } from "@/integrations/supabase/types";

export type PortfolioStatus = "pending" | "approved" | "rejected";

export type PortfolioProjectRow = {
  id: string;
  pro_id: string;
  trade_slug: string;
  title: string;
  summary: string;
  before_url: string | null;
  after_url: string | null;
  extra_photos: string[];
  completed_on: string | null;
  sort_order: number;
  published: boolean;
  status: PortfolioStatus;
  reviewer_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

type ExistingTable = Database["public"]["Tables"]["pro_projects"];
type PortfolioTable = {
  Row: PortfolioProjectRow;
  Insert: Omit<
    PortfolioProjectRow,
    | "id"
    | "created_at"
    | "updated_at"
    | "status"
    | "extra_photos"
    | "reviewed_at"
    | "reviewer_note"
    | "reviewed_by"
  > & {
    id?: string;
    created_at?: string;
    updated_at?: string;
    status?: PortfolioStatus;
    extra_photos?: string[];
    reviewed_at?: string | null;
    reviewer_note?: string | null;
    reviewed_by?: string | null;
  };
  Update: Partial<PortfolioProjectRow>;
  Relationships: ExistingTable["Relationships"];
};

/** Local augmentation until the preview backend applies migration 0050. */
export type PortfolioDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "pro_projects"> & {
      pro_projects: PortfolioTable;
    };
  };
};
