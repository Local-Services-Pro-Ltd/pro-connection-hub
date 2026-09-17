-- Every listed pro must sit in a currently live area (London, Kent, Surrey).
UPDATE public.pros SET area = 'Maidstone', area_slug = 'kent' WHERE id = 'marcus-webb';
UPDATE public.pros SET area = 'Guildford', area_slug = 'surrey' WHERE id = 'priya-shah';
UPDATE public.pros SET area = 'Canterbury', area_slug = 'kent' WHERE id = 'tom-halloran';
UPDATE public.pros SET area = 'Woking', area_slug = 'surrey' WHERE id = 'sian-roberts';
UPDATE public.pros SET area = 'London', area_slug = 'london' WHERE id = 'alan-petrie';
UPDATE public.pros SET area = 'Tunbridge Wells', area_slug = 'kent' WHERE id = 'greg-mullen';
UPDATE public.pros SET area = 'Epsom', area_slug = 'surrey' WHERE id = 'nadia-hussain';
UPDATE public.pros SET area = 'London', area_slug = 'london' WHERE id = 'bill-carter';
UPDATE public.pros SET area = 'Dartford', area_slug = 'kent' WHERE id = 'emma-clyde';

-- Safety net: never show a profile outside a live area.
UPDATE public.pros p SET published = false
WHERE p.published = true
  AND (p.area_slug IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.areas a WHERE a.slug = p.area_slug AND a.status = 'live'));
