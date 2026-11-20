-- Work gallery (portfolio): firms manage before/after jobs from their dashboard,
-- an admin approves each job before it appears on the public profile.
--
--   status     pending | approved | rejected  (only admins can set approved/rejected)
--   published  the firm's own "show on my profile" switch
--   public sees a job only when status = 'approved' AND published AND the firm is published.
--
-- Photos are stored as object paths in the private `pro-projects` bucket
-- ({pro_id}/...), never as long-lived signed URLs; the server signs them on read.

ALTER TABLE public.pro_projects
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS extra_photos text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(extra_photos) <= 6),
  ADD COLUMN IF NOT EXISTS reviewer_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.pro_projects ALTER COLUMN published SET DEFAULT true;

-- Non-admins (the firm) can edit content and toggle `published`, but can never
-- approve. Any change to what the public would see sends the job back for review.
CREATE OR REPLACE FUNCTION public.enforce_project_publish_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.reviewer_note := NULL;
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
    RETURN NEW;
  END IF;

  -- Review fields are admin-only.
  NEW.reviewer_note := OLD.reviewer_note;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.pro_id := OLD.pro_id;

  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.before_url IS DISTINCT FROM OLD.before_url
     OR NEW.after_url IS DISTINCT FROM OLD.after_url
     OR NEW.extra_photos IS DISTINCT FROM OLD.extra_photos
     OR NEW.trade_slug IS DISTINCT FROM OLD.trade_slug
     OR NEW.completed_on IS DISTINCT FROM OLD.completed_on THEN
    NEW.status := 'pending';
  ELSE
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

-- Public read: approved, shown by the firm, and the firm itself is published.
DROP POLICY IF EXISTS "pro_projects public read" ON public.pro_projects;
CREATE POLICY "pro_projects public read" ON public.pro_projects FOR SELECT TO anon, authenticated
  USING (published AND status = 'approved'
         AND EXISTS (SELECT 1 FROM public.pros p WHERE p.id = pro_projects.pro_id AND p.published));

-- Storage: a firm may upload and delete images only inside its own folder.
DROP POLICY IF EXISTS "Owners upload own pro project images" ON storage.objects;
CREATE POLICY "Owners upload own pro project images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pro-projects'
              AND EXISTS (SELECT 1 FROM public.pros p
                          WHERE p.user_id = auth.uid() AND objects.name LIKE p.id || '/%'));
DROP POLICY IF EXISTS "Owners delete own pro project images" ON storage.objects;
CREATE POLICY "Owners delete own pro project images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pro-projects'
         AND EXISTS (SELECT 1 FROM public.pros p
                     WHERE p.user_id = auth.uid() AND objects.name LIKE p.id || '/%'));

-- Uploads: images only, at most 8 MB each.
UPDATE storage.buckets
   SET file_size_limit = 8388608,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'pro-projects';
