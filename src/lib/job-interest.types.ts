import type { Database } from "@/integrations/supabase/types";

export type JobInterestRow = {
  id: string;
  job_id: string;
  pro_id: string;
  message: string | null;
  created_at: string;
};

type JobInterestTable = {
  Row: JobInterestRow;
  Insert: {
    id?: string;
    job_id: string;
    pro_id: string;
    message?: string | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    job_id?: string;
    pro_id?: string;
    message?: string | null;
    created_at?: string;
  };
  Relationships: [];
};

/** Local augmentation until the preview backend applies migration 0048. */
export type JobInterestDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      job_interest: JobInterestTable;
    };
  };
};
