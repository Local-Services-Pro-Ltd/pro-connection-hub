export type FirmJob = {
  id: string;
  reference: string;
  title: string;
  description: string;
  timing: string;
  budget_band: string;
  created_at: string;
  postcode_district: string;
  interested: boolean;
  /** Short-lived links to the homeowner's photos of the job. */
  photos: string[];
};

export type FirmJobSource = Omit<FirmJob, "postcode_district" | "interested" | "photos"> & {
  postcode: string;
  contact_name?: string;
  contact_email?: string;
  user_id?: string | null;
};

/** The only job fields a firm can receive; contact fields never cross this boundary. */
export function firmJobView(
  job: FirmJobSource,
  interested: boolean,
  photos: string[] = [],
): FirmJob {
  return {
    id: job.id,
    reference: job.reference,
    title: job.title,
    description: job.description,
    timing: job.timing,
    budget_band: job.budget_band,
    created_at: job.created_at,
    postcode_district: postcodeDistrict(job.postcode),
    interested,
    photos,
  };
}

export function postcodeDistrict(postcode: string): string {
  const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
  return cleaned.length > 3 ? cleaned.slice(0, -3) : "";
}
