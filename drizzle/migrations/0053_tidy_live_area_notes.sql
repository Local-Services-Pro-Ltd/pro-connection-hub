-- Three areas went live but still carried their old "Opening …" notes.
-- The public pages already hide those notes for live areas; make the stored
-- data match by describing the area instead, as Kent and Surrey do.
UPDATE public.areas SET note = 'Reading, Slough, Bracknell, Maidenhead and Newbury'
 WHERE slug = 'berkshire' AND status = 'live' AND note LIKE 'Opening%';
UPDATE public.areas SET note = 'Aylesbury, High Wycombe, Amersham and Milton Keynes'
 WHERE slug = 'buckinghamshire' AND status = 'live' AND note LIKE 'Opening%';
UPDATE public.areas SET note = 'Watford, St Albans, Stevenage, Hemel Hempstead and Ware'
 WHERE slug = 'hertfordshire' AND status = 'live' AND note LIKE 'Opening%';
