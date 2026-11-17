-- Same-area job matching regression. Run with a privileged connection
-- (match_pros is server-only). Changes are rolled back.
BEGIN;

DO $$
DECLARE ids text[];
BEGIN
  ids := ARRAY(SELECT pro_id FROM public.match_pros('plumber', 'HP6 6AA', NULL, NULL, 50, true));
  IF 'keystone-london' = ANY(ids) THEN RAISE EXCEPTION 'hp6_plumber_returned_london_firm'; END IF;

  ids := ARRAY(SELECT pro_id FROM public.match_pros('roofer', 'HP6 6AA', NULL, NULL, 50, true));
  IF NOT EXISTS (SELECT 1 FROM public.pros WHERE id = ANY(ids) AND company ILIKE 'Stanley & Son Roofing%') THEN
    RAISE EXCEPTION 'hp6_roofer_missing_stanley';
  END IF;

  ids := ARRAY(SELECT pro_id FROM public.match_pros('painter-decorator', 'SG12 9AA', NULL, NULL, 50, true));
  IF NOT EXISTS (SELECT 1 FROM public.pros WHERE id = ANY(ids) AND company = 'Exact Property Care') THEN
    RAISE EXCEPTION 'sg12_painter_missing_exact_property_care';
  END IF;

  -- EN1 sits in London and Hertfordshire; both kinds of firm are eligible.
  IF public.area_slugs_for_postcode('EN1 1AA') <> ARRAY['london', 'hertfordshire'] THEN
    RAISE EXCEPTION 'en1_area_map_wrong';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.match_pros('plumber', 'EN1 1AA', NULL, NULL, 50, true) m
                 JOIN public.pros p ON p.id = m.pro_id WHERE p.area_slug = 'london')
     OR NOT EXISTS (SELECT 1 FROM public.match_pros('painter-decorator', 'EN1 1AA', NULL, NULL, 50, true) m
                 JOIN public.pros p ON p.id = m.pro_id WHERE p.area_slug = 'hertfordshire') THEN
    RAISE EXCEPTION 'en1_should_match_london_and_hertfordshire';
  END IF;

  IF public.area_slugs_for_postcode('SL1 1AA') <> ARRAY['berkshire'] THEN
    RAISE EXCEPTION 'sl1_should_be_berkshire_only';
  END IF;
  IF public.postcode_letters('HP6 6AA') <> 'HP' OR public.postcode_outward('HP6 6AA') <> 'HP6' THEN
    RAISE EXCEPTION 'postcode_parsing_wrong';
  END IF;
END $$;

-- Coming-soon area returns nothing, from both overloads.
UPDATE public.areas SET status = 'coming_soon' WHERE slug IN ('buckinghamshire', 'hertfordshire');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.match_pros('roofer', 'HP6 6AA', NULL, NULL, 50, true))
     OR EXISTS (SELECT 1 FROM public.match_pros('roofer', 'HP6 6AA', NULL, NULL, 50)) THEN
    RAISE EXCEPTION 'coming_soon_area_returned_matches';
  END IF;
END $$;

ROLLBACK;
